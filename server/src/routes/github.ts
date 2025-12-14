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

        // Get today's status
        const todayStatus = await githubService.hasCommittedToday(user.github_username);

        // Get streak directly from GitHub contributions (more accurate)
        const streakData = await githubService.getCurrentStreak(user.github_username);

        // Update local log for historical tracking
        const today = new Date().toISOString().split('T')[0];
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

        // Update streak cache in database
        const existingStreak = dbHelpers.prepare('SELECT * FROM streaks WHERE user_id = ?').get(userId);
        if (existingStreak) {
            dbHelpers.prepare(
                'UPDATE streaks SET current_streak = ?, longest_streak = ?, last_commit_date = ? WHERE user_id = ?'
            ).run(streakData.currentStreak, Math.max(streakData.longestStreak, (existingStreak as any).longest_streak || 0), todayStatus.hasCommitted ? today : (existingStreak as any).last_commit_date, userId);
        } else {
            dbHelpers.prepare(
                'INSERT INTO streaks (user_id, current_streak, longest_streak, last_commit_date) VALUES (?, ?, ?, ?)'
            ).run(userId, streakData.currentStreak, streakData.longestStreak, todayStatus.hasCommitted ? today : null);
        }

        saveDatabase();

        res.json({
            hasCommitted: todayStatus.hasCommitted,
            commitCount: todayStatus.commitCount,
            currentStreak: streakData.currentStreak,
            longestStreak: streakData.longestStreak,
            username: user.github_username
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

        // Get repo notes for weighted suggestions
        const notesRows = dbHelpers.prepare('SELECT repo_full_name, priority, difficulty FROM repo_notes WHERE user_id = ?')
            .all(userId) as any[];

        const repoNotes = new Map<string, { priority?: number; difficulty?: number }>();
        for (const row of notesRows) {
            repoNotes.set(row.repo_full_name, {
                priority: row.priority,
                difficulty: row.difficulty
            });
        }

        // Get suggestion with weighted algorithm
        const suggestion = await githubService.getSuggestion(repos, excludedRepos, repoNotes);

        res.json({ suggestion });
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
