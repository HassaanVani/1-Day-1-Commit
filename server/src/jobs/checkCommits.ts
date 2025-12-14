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
        SELECT email_enabled, push_enabled, weekends_off
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

        // Only notify if user hasn't committed
        if (hasCommitted) return;

        const streak = dbHelpers.prepare('SELECT current_streak FROM streaks WHERE user_id = ?')
            .get(userId) as any;
        const currentStreak = streak?.current_streak || 0;

        // Get suggestion
        const repos = await githubService.getUserRepos();
        const excludedRepos = dbHelpers.prepare('SELECT repo_full_name FROM excluded_repos WHERE user_id = ?')
            .all(userId)
            .map((r: any) => r.repo_full_name);
        const suggestion = await githubService.getSuggestion(repos, excludedRepos);

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
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    console.log(`[CRON] Checking reminders for ${currentTime}`);

    // Find all reminders that match current time
    const reminders = dbHelpers.prepare(`
        SELECT r.user_id, r.time
        FROM reminder_times r
        WHERE r.time = ? AND r.enabled = 1
    `).all(currentTime) as Reminder[];

    for (const reminder of reminders) {
        const hour = parseInt(reminder.time.split(':')[0]);
        const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
        await checkUserAndNotify(reminder.user_id, timeOfDay);
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
