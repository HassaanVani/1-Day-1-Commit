import cron from 'node-cron';
import { dbHelpers } from '../db/index.js';
import { GitHubService } from '../services/github.js';
import { notificationService } from '../services/notifications.js';

interface User {
    id: string;
    github_username: string;
    github_token: string;
    email: string;
    timezone: string;
    email_enabled: number;
    weekends_off: number;
}

// Check commits and send reminders
async function checkAndNotify(timeOfDay: 'morning' | 'afternoon' | 'evening') {
    console.log(`[CRON] Running ${timeOfDay} check at ${new Date().toISOString()}`);

    const users = dbHelpers.prepare(`
    SELECT u.id, u.github_username, u.github_token, u.email, u.timezone,
           p.email_enabled, p.weekends_off
    FROM users u
    JOIN preferences p ON u.id = p.user_id
    WHERE p.email_enabled = 1
  `).all() as User[];

    for (const user of users) {
        // Skip weekends if user opted out
        if (user.weekends_off) {
            const day = new Date().getDay();
            if (day === 0 || day === 6) continue;
        }

        try {
            const githubService = new GitHubService(user.github_token);
            const { hasCommitted } = await githubService.hasCommittedToday(user.github_username);

            // Only notify if user hasn't committed
            if (!hasCommitted && user.email) {
                const streak = dbHelpers.prepare('SELECT current_streak FROM streaks WHERE user_id = ?')
                    .get(user.id) as any;

                // Get suggestion
                const repos = await githubService.getUserRepos();
                const excludedRepos = dbHelpers.prepare('SELECT repo_full_name FROM excluded_repos WHERE user_id = ?')
                    .all(user.id)
                    .map((r: any) => r.repo_full_name);
                const suggestion = await githubService.getSuggestion(repos, excludedRepos);

                await notificationService.sendEmail({
                    to: user.email,
                    username: user.github_username,
                    currentStreak: streak?.current_streak || 0,
                    type: timeOfDay,
                    suggestedRepo: suggestion?.full_name
                });

                console.log(`[CRON] Sent ${timeOfDay} reminder to ${user.github_username}`);
            }
        } catch (error) {
            console.error(`[CRON] Error processing user ${user.github_username}:`, error);
        }
    }
}

// Schedule jobs (times in server timezone - configure per user later)
export function startCronJobs() {
    // Morning reminder at 9 AM
    cron.schedule('0 9 * * *', () => checkAndNotify('morning'));

    // Afternoon reminder at 3 PM
    cron.schedule('0 15 * * *', () => checkAndNotify('afternoon'));

    // Evening reminder at 8 PM
    cron.schedule('0 20 * * *', () => checkAndNotify('evening'));

    console.log('🕐 Cron jobs scheduled');
}
