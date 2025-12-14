import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { dbHelpers, saveDatabase } from '../db/index.js';

const router = Router();

// GitHub OAuth redirect
router.get('/github', (req: Request, res: Response) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = `${process.env.FRONTEND_URL}/auth/callback`;
    const scope = 'read:user user:email repo';

    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;
    res.redirect(authUrl);
});

// GitHub OAuth callback - exchange code for token
router.post('/github/callback', async (req: Request, res: Response) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Missing authorization code' });
    }

    try {
        // Exchange code for access token
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code
            })
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            return res.status(400).json({ error: tokenData.error_description });
        }

        const accessToken = tokenData.access_token;

        // Get user info from GitHub
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        const userData = await userResponse.json();

        // Get user email
        const emailResponse = await fetch('https://api.github.com/user/emails', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        const emails = await emailResponse.json();
        const primaryEmail = emails.find((e: any) => e.primary)?.email || emails[0]?.email;

        // Check for existing user
        const existingUser = dbHelpers.prepare(
            'SELECT * FROM users WHERE github_id = ?'
        ).get(String(userData.id));

        if (existingUser) {
            dbHelpers.prepare(`
        UPDATE users SET github_token = ?, github_username = ?, github_avatar = ?, email = ?
        WHERE github_id = ?
      `).run(accessToken, userData.login, userData.avatar_url, primaryEmail, String(userData.id));

            return res.json({
                user: {
                    id: existingUser.id,
                    username: userData.login,
                    avatar: userData.avatar_url,
                    email: primaryEmail
                }
            });
        }

        // Insert new user
        const userId = crypto.randomUUID();
        dbHelpers.prepare(`
      INSERT INTO users (id, github_id, github_username, github_token, github_avatar, email)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, String(userData.id), userData.login, accessToken, userData.avatar_url, primaryEmail);

        // Initialize preferences
        dbHelpers.prepare(`
      INSERT INTO preferences (user_id) VALUES (?)
    `).run(userId);

        // Initialize streaks
        dbHelpers.prepare(`
      INSERT INTO streaks (user_id, current_streak, longest_streak) VALUES (?, 0, 0)
    `).run(userId);

        saveDatabase();

        res.json({
            user: {
                id: userId,
                username: userData.login,
                avatar: userData.avatar_url,
                email: primaryEmail
            }
        });

    } catch (error) {
        console.error('OAuth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
    res.json({ success: true });
});

export default router;
