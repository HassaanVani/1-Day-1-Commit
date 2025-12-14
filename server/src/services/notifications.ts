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
      morning: `Daily reminder: No commits yet today`,
      afternoon: `Reminder: You haven't pushed today`,
      evening: currentStreak > 0
        ? `Your ${currentStreak}-day streak is at risk`
        : `End of day reminder: No commits today`
    };

    const getEmailContent = () => {
      const streakSection = currentStreak > 0
        ? `<div style="text-align: center; margin: 24px 0;">
                     <div style="font-size: 48px; font-weight: 700; color: #f0f6fc;">${currentStreak}</div>
                     <div style="font-size: 12px; color: #8b949e; text-transform: uppercase; letter-spacing: 1px;">day streak</div>
                   </div>`
        : '';

      const repoSuggestion = suggestedRepo
        ? `<p style="margin: 16px 0; padding: 12px; background: #21262d; border-radius: 6px; border-left: 3px solid #238636;">
                     <strong style="color: #8b949e;">Suggested:</strong> 
                     <a href="https://github.com/${suggestedRepo}" style="color: #58a6ff; text-decoration: none;">${suggestedRepo}</a>
                   </p>`
        : '';

      const timeMessage = {
        morning: "Start your day with a commit.",
        afternoon: "There's still time to code today.",
        evening: currentStreak > 0
          ? "Don't let your streak break."
          : "One commit is all it takes."
      };

      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; background: #0d1117;">
  <div style="max-width: 480px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 32px;">
      
      ${streakSection}
      
      <h1 style="color: #f0f6fc; font-size: 20px; font-weight: 600; margin: 0 0 12px 0;">
        ${timeMessage[type]}
      </h1>
      
      <p style="color: #8b949e; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
        Hi ${username}, you haven't pushed any commits today.
      </p>
      
      ${repoSuggestion}
      
      <a href="https://github.com" style="display: inline-block; background: #238636; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
        Open GitHub
      </a>
      
      <p style="color: #484f58; font-size: 12px; margin: 24px 0 0 0; border-top: 1px solid #21262d; padding-top: 16px;">
        Sent by <a href="https://1day1commit.netlify.app" style="color: #58a6ff; text-decoration: none;">1Day1Commit</a>
      </p>
    </div>
  </div>
</body>
</html>`;
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
