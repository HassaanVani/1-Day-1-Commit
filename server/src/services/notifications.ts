import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface EmailOptions {
    to: string;
    username: string;
    currentStreak: number;
    type: 'morning' | 'afternoon' | 'evening';
    suggestedRepo?: string;
}

export class NotificationService {

    async sendEmail({ to, username, currentStreak, type, suggestedRepo }: EmailOptions): Promise<boolean> {
        if (!resend) {
            console.log('Email service not configured, skipping email');
            return false;
        }

        const subjects = {
            morning: `🌅 Good morning, ${username}! Time for today's commit`,
            afternoon: `⏰ Reminder: You haven't committed yet today`,
            evening: `⚠️ Don't break your ${currentStreak} day streak!`
        };

        const getEmailContent = () => {
            const repoSuggestion = suggestedRepo
                ? `\n\n<p style="margin: 20px 0;"><strong>💡 Suggested repo:</strong> <a href="https://github.com/${suggestedRepo}" style="color: #58a6ff;">${suggestedRepo}</a></p>`
                : '';

            return `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; padding: 40px; }
            .container { max-width: 480px; margin: 0 auto; background: #161b22; border-radius: 12px; padding: 32px; border: 1px solid #30363d; }
            .streak { font-size: 64px; text-align: center; margin: 20px 0; }
            .streak-label { text-align: center; color: #8b949e; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
            h1 { color: #f0f6fc; font-size: 24px; margin-bottom: 16px; }
            p { color: #8b949e; line-height: 1.6; }
            .cta { display: inline-block; background: linear-gradient(135deg, #238636 0%, #2ea043 100%); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }
            a { color: #58a6ff; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="streak">🔥 ${currentStreak}</div>
            <div class="streak-label">Day Streak</div>
            <h1>${subjects[type].replace(`🌅 `, '').replace(`⏰ `, '').replace(`⚠️ `, '')}</h1>
            <p>Keep the momentum going! Even a small commit counts towards building your daily coding habit.</p>
            ${repoSuggestion}
            <a href="https://github.com" class="cta">Open GitHub →</a>
          </div>
        </body>
        </html>
      `;
        };

        try {
            await resend.emails.send({
                from: '1Day1Commit <noreply@resend.dev>',
                to,
                subject: subjects[type],
                html: getEmailContent()
            });
            return true;
        } catch (error) {
            console.error('Failed to send email:', error);
            return false;
        }
    }
}

export const notificationService = new NotificationService();
