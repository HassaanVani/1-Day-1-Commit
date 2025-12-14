# 1 Day 1 Commit 🔥

> Build consistent coding habits with one simple commitment: make one commit every day.

## Features

- **GitHub Integration** - Connect your GitHub account with OAuth
- **Streak Tracking** - Visual display of your current and longest streaks
- **Smart Reminders** - Email notifications at customizable times
- **Repo Suggestions** - AI-powered recommendations for neglected repos
- **Contribution Heatmap** - GitHub-style activity visualization
- **Repo Management** - Exclude repos from suggestions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Vanilla CSS (Custom Design System) |
| Backend | Node.js + Express |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Email | Resend |
| Hosting | Netlify (frontend) + Railway (backend) |

## Project Structure

```
1-day-1-commit/
├── client/          # React frontend (Vite)
│   ├── src/
│   │   ├── App.tsx       # Main application
│   │   ├── App.css       # Component styles
│   │   └── index.css     # Design system
│   └── package.json
│
├── server/          # Express backend
│   ├── src/
│   │   ├── index.ts      # Server entry
│   │   ├── db/           # Database setup
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # Business logic
│   │   └── jobs/         # Cron jobs
│   └── package.json
│
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- GitHub OAuth App
- (Optional) Resend API key for emails

### 1. Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Set Homepage URL: `http://localhost:5173`
4. Set Authorization callback: `http://localhost:5173/auth/callback`
5. Copy Client ID and generate Client Secret

### 2. Setup Backend

```bash
cd server
cp .env.example .env
# Edit .env with your credentials
npm install
npm run dev
```

### 3. Setup Frontend

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

### 4. Open the App

Visit [http://localhost:5173](http://localhost:5173)

## Environment Variables

### Server (.env)

```env
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
FRONTEND_URL=http://localhost:5173
PORT=3001
JWT_SECRET=your_jwt_secret
RESEND_API_KEY=your_resend_api_key  # Optional
```

### Client (.env)

```env
VITE_API_URL=http://localhost:3001
```

## Deployment

### Backend (Railway)

1. Create a new project on [Railway](https://railway.app)
2. Connect your GitHub repo
3. Set the root directory to `server`
4. Add environment variables
5. Deploy!

### Frontend (Netlify)

1. Create a new site on [Netlify](https://netlify.com)
2. Connect your GitHub repo
3. Set build command: `cd client && npm install && npm run build`
4. Set publish directory: `client/dist`
5. Add environment variable: `VITE_API_URL=https://your-railway-url.up.railway.app`
6. Deploy!

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/auth/github` | Start OAuth flow |
| POST | `/api/auth/github/callback` | Complete OAuth |
| GET | `/api/user/me` | Get current user |
| GET | `/api/user/preferences` | Get preferences |
| PUT | `/api/user/preferences` | Update preferences |
| GET | `/api/github/today` | Today's commit status |
| GET | `/api/github/repos` | User's repositories |
| GET | `/api/github/suggestion` | Get repo suggestion |
| GET | `/api/github/contributions` | Contribution data |

## License

MIT
