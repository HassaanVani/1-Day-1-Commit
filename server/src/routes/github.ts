import { Router, Request, Response } from 'express';
import { dbHelpers, saveDatabase } from '../db/index.js';
import { GitHubService } from '../services/github.js';

const router = Router();

// Get user's repos
router.get('/repos', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const user = dbHelpers.prepare('SELECT github_token FROM users WHERE id = ?').get(userId) as any;

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const githubService = new GitHubService(user.github_token);
        const repos = await githubService.getUserRepos();

        // Get excluded repos
        const excludedRepos = dbHelpers.prepare('SELECT repo_full_name FROM excluded_repos WHERE user_id = ?')
            .all(userId)
            .map((r: any) => r.repo_full_name);

        // Mark excluded repos
        const reposWithExclusion = repos.map(repo => ({
            ...repo,
            excluded: excludedRepos.includes(repo.full_name)
        }));

        res.json({ repos: reposWithExclusion });
    } catch (error) {
        console.error('Error fetching repos:', error);
        res.status(500).json({ error: 'Failed to fetch repos' });
    }
});

// Get today's commit status
router.get('/today', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const user = dbHelpers.prepare('SELECT github_token, github_username FROM users WHERE id = ?').get(userId) as any;

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const githubService = new GitHubService(user.github_token);
        const todayStatus = await githubService.hasCommittedToday(user.github_username);

        // Update local log
        const today = new Date().toISOString().split('T')[0];

        // Check if entry exists
        const existingLog = dbHelpers.prepare(
            'SELECT * FROM commit_log WHERE user_id = ? AND date = ?'
        ).get(userId, today);

        if (existingLog) {
            dbHelpers.prepare(
                'UPDATE commit_log SET committed = ?, commit_count = ? WHERE user_id = ? AND date = ?'
            ).run(todayStatus.hasCommitted ? 1 : 0, todayStatus.commitCount, userId, today);
        } else {
            dbHelpers.prepare(
                'INSERT INTO commit_log (user_id, date, committed, commit_count) VALUES (?, ?, ?, ?)'
            ).run(userId, today, todayStatus.hasCommitted ? 1 : 0, todayStatus.commitCount);
        }

        // Update streaks if committed
        if (todayStatus.hasCommitted) {
            const streak = dbHelpers.prepare('SELECT * FROM streaks WHERE user_id = ?').get(userId) as any;

            if (streak) {
                const lastCommitDate = streak.last_commit_date;
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];

                let newStreak = 1;
                if (lastCommitDate === yesterdayStr) {
                    newStreak = streak.current_streak + 1;
                } else if (lastCommitDate === today) {
                    newStreak = streak.current_streak;
                }

                const longestStreak = Math.max(newStreak, streak.longest_streak);

                dbHelpers.prepare(
                    'UPDATE streaks SET current_streak = ?, longest_streak = ?, last_commit_date = ? WHERE user_id = ?'
                ).run(newStreak, longestStreak, today, userId);
            }
        }

        saveDatabase();

        // Get current streak
        const streak = dbHelpers.prepare('SELECT current_streak, longest_streak FROM streaks WHERE user_id = ?').get(userId) as any;

        res.json({
            hasCommitted: todayStatus.hasCommitted,
            commitCount: todayStatus.commitCount,
            currentStreak: streak?.current_streak || 0,
            longestStreak: streak?.longest_streak || 0
        });
    } catch (error) {
        console.error('Error checking today status:', error);
        res.status(500).json({ error: 'Failed to check commit status' });
    }
});

// Get repo suggestion
router.get('/suggestion', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const user = dbHelpers.prepare('SELECT github_token FROM users WHERE id = ?').get(userId) as any;

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const githubService = new GitHubService(user.github_token);
        const repos = await githubService.getUserRepos();

        // Get excluded repos
        const excludedRepos = dbHelpers.prepare('SELECT repo_full_name FROM excluded_repos WHERE user_id = ?')
            .all(userId)
            .map((r: any) => r.repo_full_name);

        // Filter and score repos
        const suggestions = await githubService.getSuggestion(repos, excludedRepos);

        res.json({ suggestion: suggestions });
    } catch (error) {
        console.error('Error getting suggestion:', error);
        res.status(500).json({ error: 'Failed to get suggestion' });
    }
});

// Get contribution data for heatmap
router.get('/contributions', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const user = dbHelpers.prepare('SELECT github_token, github_username FROM users WHERE id = ?').get(userId) as any;

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const githubService = new GitHubService(user.github_token);
        const contributions = await githubService.getContributions(user.github_username);

        res.json({ contributions });
    } catch (error) {
        console.error('Error fetching contributions:', error);
        res.status(500).json({ error: 'Failed to fetch contributions' });
    }
});

export default router;
