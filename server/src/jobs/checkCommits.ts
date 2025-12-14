import cron from 'node-cron';
import webpush from 'web-push';
import { dbHelpers } from '../db/index.js';
import { GitHubService } from '../services/github.js';
import { notificationService } from '../services/notifications.js';

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@1day1commit.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log('🔔 Web Push configured');
} else {
    console.log('⚠️ VAPID keys not configured - push notifications disabled');
}

interface User {
    id: string;
    github_username: string;
    github_token: string;
    email: string;
    timezone: string;
}

interface Preferences {
    email_enabled: number;
    push_enabled: number;
    weekends_off: number;
    email_when_committed: number;
}

interface Reminder {
    id: string;
    user_id: string;
    time: string;
    enabled: number;
}

interface PushSubscription {
    endpoint: string;
    p256dh: string;
    auth: string;
}

// Send push notification to a user
async function sendPushNotification(userId: string, title: string, body: string, url?: string): Promise<boolean> {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;

    const subscription = dbHelpers.prepare(`
        SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?
    `).get(userId) as PushSubscription | undefined;

    if (!subscription) return false;

    try {
        const payload = JSON.stringify({
            title,
            body,
            icon: '/commit.webp',
            badge: '/commit.webp',
            url: url || 'https://1day1commit.netlify.app'
        });

        await webpush.sendNotification({
            endpoint: subscription.endpoint,
            keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth
            }
        }, payload);

        console.log(`[PUSH] Sent notification to user ${userId}`);
        return true;
    } catch (error: any) {
        console.error(`[PUSH] Failed to send notification:`, error.message);
        // Remove invalid subscription
        if (error.statusCode === 410 || error.statusCode === 404) {
            dbHelpers.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(userId);
        }
        return false;
    }
}

// Check if user needs notification at current time
async function checkUserAndNotify(userId: string, timeOfDay: string) {
    const user = dbHelpers.prepare(`
        SELECT u.id, u.github_username, u.github_token, u.email
        FROM users u
        WHERE u.id = ?
    `).get(userId) as User | undefined;

    const prefs = dbHelpers.prepare(`
        SELECT email_enabled, push_enabled, weekends_off, email_when_committed
        FROM preferences
        WHERE user_id = ?
    `).get(userId) as Preferences | undefined;

    if (!user || !prefs) return;

    // Skip weekends if configured
    if (prefs.weekends_off) {
        const day = new Date().getDay();
        if (day === 0 || day === 6) return;
    }

    try {
        const githubService = new GitHubService(user.github_token);
        const { hasCommitted } = await githubService.hasCommittedToday(user.github_username);

        // Skip notification if user has committed AND doesn't want emails when committed
        if (hasCommitted && !prefs.email_when_committed) return;

        const streak = dbHelpers.prepare('SELECT current_streak FROM streaks WHERE user_id = ?')
            .get(userId) as any;
        const currentStreak = streak?.current_streak || 0;

        // Get suggestion (only if hasn't committed)
        let suggestion = null;
        if (!hasCommitted) {
            const repos = await githubService.getUserRepos();
            const excludedRepos = dbHelpers.prepare('SELECT repo_full_name FROM excluded_repos WHERE user_id = ?')
                .all(userId)
                .map((r: any) => r.repo_full_name);
            suggestion = await githubService.getSuggestion(repos, excludedRepos);
        }

        // Send email if enabled
        if (prefs.email_enabled && user.email) {
            const emailType = timeOfDay === 'morning' ? 'morning' :
                timeOfDay === 'evening' ? 'evening' : 'afternoon';
            await notificationService.sendEmail({
                to: user.email,
                username: user.github_username,
                currentStreak,
                type: emailType as 'morning' | 'afternoon' | 'evening',
                suggestedRepo: suggestion?.full_name
            });
            console.log(`[EMAIL] Sent ${timeOfDay} reminder to ${user.github_username}`);
        }

        // Send push notification if enabled
        if (prefs.push_enabled) {
            const title = currentStreak > 0
                ? `🔥 Don't break your ${currentStreak}-day streak!`
                : `📝 Time to commit`;
            const body = suggestion
                ? `Try working on ${suggestion.name}`
                : 'Make your daily commit';
            await sendPushNotification(userId, title, body, suggestion?.html_url);
        }
    } catch (error) {
        console.error(`[CRON] Error processing user ${user.github_username}:`, error);
    }
}

// Process reminders for current minute
async function processReminders() {
    const now = new Date();
    // Default server check (useful for logs)
    const serverTimeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    console.log(`[CRON] Checking reminders at UTC ${now.toISOString()} (Server Local: ${serverTimeStr})`);

    // Fetch ALL enabled reminders attached to users (to get their timezone)
    const reminders = dbHelpers.prepare(`
        SELECT r.user_id, r.time, u.timezone
        FROM reminder_times r
        JOIN users u ON r.user_id = u.id
        WHERE r.enabled = 1
    `).all() as (Reminder & { timezone: string })[];

    for (const reminder of reminders) {
        try {
            // Convert current Server Instance time to User's Local Time
            // We use 'en-GB' to force "HH:MM" format (24h) without AM/PM
            const userLocalTime = now.toLocaleTimeString('en-GB', {
                timeZone: reminder.timezone || 'UTC',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Check if user's local time matches the reminder time
            if (userLocalTime === reminder.time) {
                console.log(`[CRON] Triggering reminder for ${reminder.user_id} at ${userLocalTime} (${reminder.timezone})`);
                const hour = parseInt(reminder.time.split(':')[0]);
                const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
                await checkUserAndNotify(reminder.user_id, timeOfDay);
            }
        } catch (error) {
            console.error(`[CRON] Error processing time for user ${reminder.user_id} (TZ: ${reminder.timezone}):`, error);
        }
    }
}

// Schedule job to run every minute to check custom reminder times
export function startCronJobs() {
    // Run every minute to check for custom reminders
    cron.schedule('* * * * *', () => {
        processReminders().catch(console.error);
    });

    console.log('🕐 Cron jobs scheduled (every minute for custom reminders)');
}

// Export for manual testing
export { sendPushNotification, processReminders };
