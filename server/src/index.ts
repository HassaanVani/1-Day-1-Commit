import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDatabase } from './db/index.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import githubRoutes from './routes/github.js';
import { startCronJobs } from './jobs/checkCommits.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/github', githubRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// VAPID public key for push notifications
app.get('/api/push/vapid-public-key', (req, res) => {
    const rawKey = process.env.VAPID_PUBLIC_KEY;
    const cleanKey = rawKey ? rawKey.trim() : null;

    // Log for debugging (first few chars)
    if (cleanKey) {
        console.log(`[VAPID] Sending public key starting with: ${cleanKey.substring(0, 5)}...`);
    } else {
        console.error('[VAPID] No public key found in env!');
    }

    res.json({
        publicKey: cleanKey,
        enabled: !!cleanKey
    });
});

// Start server
async function start() {
    try {
        // Initialize database
        await initDatabase();
        console.log('💾 Database initialized');

        // Start cron jobs
        startCronJobs();

        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

start();

export default app;
