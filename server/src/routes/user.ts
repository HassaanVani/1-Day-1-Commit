import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { dbHelpers, saveDatabase } from '../db/index.js';
import { notificationService } from '../services/notifications.js';

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

    // Get reminder times
    const reminders = dbHelpers.prepare(
        'SELECT id, time, enabled, label FROM reminder_times WHERE user_id = ? ORDER BY time'
    ).all(userId);

    res.json({ preferences, reminders });
});

// Update user preferences
router.put('/preferences', (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { email_enabled, push_enabled, calendar_enabled, weekends_off } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const current = dbHelpers.prepare('SELECT * FROM preferences WHERE user_id = ?').get(userId) as any;

    if (current) {
        dbHelpers.prepare(`
            UPDATE preferences SET
                email_enabled = ?,
                push_enabled = ?,
                calendar_enabled = ?,
                weekends_off = ?
            WHERE user_id = ?
        `).run(
            email_enabled ?? current.email_enabled ?? 1,
            push_enabled ?? current.push_enabled ?? 0,
            calendar_enabled ?? current.calendar_enabled ?? 0,
            weekends_off ?? current.weekends_off ?? 0,
            userId
        );
    } else {
        dbHelpers.prepare(`
            INSERT INTO preferences (user_id, email_enabled, push_enabled, calendar_enabled, weekends_off)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            userId,
            email_enabled ?? 1,
            push_enabled ?? 0,
            calendar_enabled ?? 0,
            weekends_off ?? 0
        );
    }

    saveDatabase();

    const preferences = dbHelpers.prepare('SELECT * FROM preferences WHERE user_id = ?').get(userId);
    res.json({ preferences });
});

// ============================================
// Reminder Times
// ============================================

// Get all reminders
router.get('/reminders', (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const reminders = dbHelpers.prepare(
        'SELECT id, time, enabled, label FROM reminder_times WHERE user_id = ? ORDER BY time'
    ).all(userId);

    res.json({ reminders });
});

// Add reminder
router.post('/reminders', (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { time, label } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!time) {
        return res.status(400).json({ error: 'Time is required' });
    }

    const id = crypto.randomUUID();
    dbHelpers.prepare(
        'INSERT INTO reminder_times (id, user_id, time, enabled, label) VALUES (?, ?, ?, 1, ?)'
    ).run(id, userId, time, label || null);

    saveDatabase();
    res.json({ id, time, enabled: 1, label });
});

// Update reminder
router.put('/reminders/:id', (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;
    const { time, enabled, label } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    dbHelpers.prepare(`
        UPDATE reminder_times SET time = ?, enabled = ?, label = ?
        WHERE id = ? AND user_id = ?
    `).run(time, enabled ? 1 : 0, label || null, id, userId);

    saveDatabase();
    res.json({ success: true });
});

// Delete reminder
router.delete('/reminders/:id', (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    dbHelpers.prepare(
        'DELETE FROM reminder_times WHERE id = ? AND user_id = ?'
    ).run(id, userId);

    saveDatabase();
    res.json({ success: true });
});

// ============================================
// Repo Notes
// ============================================

// Get all notes for user
router.get('/repo-notes', (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const notes = dbHelpers.prepare(
        'SELECT id, repo_full_name, note, difficulty, priority, created_at, updated_at FROM repo_notes WHERE user_id = ?'
    ).all(userId);

    res.json({ notes });
});

// Get note for specific repo
router.get('/repo-notes/:repoName', (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const repoName = decodeURIComponent(req.params.repoName);

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const note = dbHelpers.prepare(
        'SELECT id, repo_full_name, note, difficulty, priority, created_at, updated_at FROM repo_notes WHERE user_id = ? AND repo_full_name = ?'
    ).get(userId, repoName);

    res.json({ note: note || null });
});

// Create or update repo note
router.put('/repo-notes/:repoName', (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const repoName = decodeURIComponent(req.params.repoName);
    const { note, difficulty, priority } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const existing = dbHelpers.prepare(
        'SELECT id FROM repo_notes WHERE user_id = ? AND repo_full_name = ?'
    ).get(userId, repoName) as any;

    const now = new Date().toISOString();

    if (existing) {
        dbHelpers.prepare(`
            UPDATE repo_notes SET note = ?, difficulty = ?, priority = ?, updated_at = ?
            WHERE id = ?
        `).run(note || null, difficulty || 3, priority || 3, now, existing.id);
    } else {
        const id = crypto.randomUUID();
        dbHelpers.prepare(`
            INSERT INTO repo_notes (id, user_id, repo_full_name, note, difficulty, priority, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, userId, repoName, note || null, difficulty || 3, priority || 3, now);
    }

    saveDatabase();

    const updated = dbHelpers.prepare(
        'SELECT id, repo_full_name, note, difficulty, priority, created_at, updated_at FROM repo_notes WHERE user_id = ? AND repo_full_name = ?'
    ).get(userId, repoName);

    res.json({ note: updated });
});

// Delete repo note
router.delete('/repo-notes/:repoName', (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const repoName = decodeURIComponent(req.params.repoName);

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    dbHelpers.prepare(
        'DELETE FROM repo_notes WHERE user_id = ? AND repo_full_name = ?'
    ).run(userId, repoName);

    saveDatabase();
    res.json({ success: true });
});

// ============================================
// Excluded Repos
// ============================================

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

router.post('/excluded-repos', (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { repo_full_name } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
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

// ============================================
// Push Subscriptions
// ============================================

router.post('/push-subscription', (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    const { endpoint, keys } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ error: 'Invalid subscription data' });
    }

    // Remove old subscriptions for this user
    dbHelpers.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(userId);

    // Add new subscription
    const id = crypto.randomUUID();
    dbHelpers.prepare(`
        INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
        VALUES (?, ?, ?, ?, ?)
    `).run(id, userId, endpoint, keys.p256dh, keys.auth);

    saveDatabase();
    res.json({ success: true });
});

router.delete('/push-subscription', (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    dbHelpers.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(userId);
    saveDatabase();
    res.json({ success: true });
});

// Test notification
router.post('/test-notification', async (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const user = dbHelpers.prepare('SELECT email, github_username FROM users WHERE id = ?').get(userId) as any;
    if (!user || !user.email) return res.status(400).json({ error: 'No email found' });

    try {
        await notificationService.sendEmail({
            to: user.email,
            username: user.github_username,
            currentStreak: 0,
            type: 'morning',
            suggestedRepo: 'Test Repo'
        });
        console.log(`[TEST] Sent test email to ${user.email}`);
        res.json({ success: true });
    } catch (error: any) {
        console.error('[TEST] Failed:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
