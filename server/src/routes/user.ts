import { Router, Request, Response } from 'express';
import { dbHelpers, saveDatabase } from '../db/index.js';

const router = Router();

// Get current user
router.get('/me', (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = dbHelpers.prepare(`
    SELECT u.id, u.github_username, u.github_avatar, u.email, u.timezone,
           s.current_streak, s.longest_streak, s.last_commit_date
    FROM users u
    LEFT JOIN streaks s ON u.id = s.user_id
    WHERE u.id = ?
  `).get(userId);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
});

// Get user preferences
router.get('/preferences', (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const preferences = dbHelpers.prepare(
        'SELECT * FROM preferences WHERE user_id = ?'
    ).get(userId);

    res.json({ preferences });
});

// Update user preferences
router.put('/preferences', (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { email_enabled, push_enabled, calendar_enabled, morning_time, afternoon_time, evening_time, weekends_off } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    // Update each field if provided
    const current = dbHelpers.prepare('SELECT * FROM preferences WHERE user_id = ?').get(userId) as any;

    dbHelpers.prepare(`
    UPDATE preferences SET
      email_enabled = ?,
      push_enabled = ?,
      calendar_enabled = ?,
      morning_time = ?,
      afternoon_time = ?,
      evening_time = ?,
      weekends_off = ?
    WHERE user_id = ?
  `).run(
        email_enabled ?? current?.email_enabled ?? 1,
        push_enabled ?? current?.push_enabled ?? 1,
        calendar_enabled ?? current?.calendar_enabled ?? 0,
        morning_time ?? current?.morning_time ?? '09:00',
        afternoon_time ?? current?.afternoon_time ?? '15:00',
        evening_time ?? current?.evening_time ?? '20:00',
        weekends_off ?? current?.weekends_off ?? 0,
        userId
    );

    saveDatabase();

    const preferences = dbHelpers.prepare('SELECT * FROM preferences WHERE user_id = ?').get(userId);
    res.json({ preferences });
});

// Get excluded repos
router.get('/excluded-repos', (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const repos = dbHelpers.prepare(
        'SELECT repo_full_name FROM excluded_repos WHERE user_id = ?'
    ).all(userId);

    res.json({ repos: repos.map((r: any) => r.repo_full_name) });
});

// Add excluded repo
router.post('/excluded-repos', (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { repo_full_name } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        // Check if already exists
        const existing = dbHelpers.prepare(
            'SELECT * FROM excluded_repos WHERE user_id = ? AND repo_full_name = ?'
        ).get(userId, repo_full_name);

        if (!existing) {
            dbHelpers.prepare(
                'INSERT INTO excluded_repos (user_id, repo_full_name) VALUES (?, ?)'
            ).run(userId, repo_full_name);
            saveDatabase();
        }
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: 'Failed to exclude repo' });
    }
});

// Remove excluded repo
router.delete('/excluded-repos/:repoName', (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const repoName = decodeURIComponent(req.params.repoName);

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    dbHelpers.prepare(
        'DELETE FROM excluded_repos WHERE user_id = ? AND repo_full_name = ?'
    ).run(userId, repoName);

    saveDatabase();
    res.json({ success: true });
});

export default router;
