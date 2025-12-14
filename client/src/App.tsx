import { useState, useEffect, createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import './App.css'

// Types
interface User {
  id: string
  username: string
  avatar: string
  email: string
}

interface TodayStatus {
  hasCommitted: boolean
  commitCount: number
  currentStreak: number
  longestStreak: number
}

interface Repo {
  id: number
  name: string
  full_name: string
  description: string | null
  html_url: string
  pushed_at: string
  language: string | null
  open_issues_count: number
  excluded: boolean
  daysSinceLastPush?: number
}

interface Contribution {
  date: string
  count: number
}

// API Config
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Auth Context
const AuthContext = createContext<{
  user: User | null
  login: () => void
  logout: () => void
}>({
  user: null,
  login: () => { },
  logout: () => { }
})

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })

  const login = () => {
    window.location.href = `${API_URL}/api/auth/github`
  }

  const logout = () => {
    localStorage.removeItem('user')
    setUser(null)
  }

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')

    if (code) {
      fetch(`${API_URL}/api/auth/github/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      })
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user))
            setUser(data.user)
            window.history.replaceState({}, '', '/')
          }
        })
        .catch(console.error)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook for auth
function useAuth() {
  return useContext(AuthContext)
}

// Custom hook for API calls
function useApi<T>(endpoint: string, userId?: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    fetch(`${API_URL}${endpoint}`, {
      headers: { 'X-User-Id': userId }
    })
      .then(res => res.json())
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [endpoint, userId])

  return {
    data, loading, error, refetch: () => {
      if (!userId) return
      setLoading(true)
      fetch(`${API_URL}${endpoint}`, {
        headers: { 'X-User-Id': userId }
      })
        .then(res => res.json())
        .then(setData)
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    }
  }
}

// Landing Page
function LandingPage() {
  const { login } = useAuth()

  return (
    <div className="landing">
      <div className="landing-bg">
        <div className="landing-glow" />
      </div>

      <main className="landing-content">
        <div className="landing-badge animate-fade-in">
          <span className="badge-dot" />
          Build habits that compound
        </div>

        <h1 className="landing-title animate-slide-up">
          <span className="title-accent">1</span> Day
          <span className="title-accent">1</span> Commit
        </h1>

        <p className="landing-subtitle animate-slide-up" style={{ animationDelay: '100ms' }}>
          Transform your coding journey with one simple commitment.
          <br />
          Ship something small every day. Watch your skills compound.
        </p>

        <button
          className="btn-primary btn-lg animate-slide-up"
          onClick={login}
          style={{ animationDelay: '200ms' }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          Continue with GitHub
        </button>

        <div className="landing-features animate-fade-in" style={{ animationDelay: '400ms' }}>
          <div className="feature">
            <div className="feature-icon">📊</div>
            <span>Track Your Streak</span>
          </div>
          <div className="feature">
            <div className="feature-icon">🔔</div>
            <span>Smart Reminders</span>
          </div>
          <div className="feature">
            <div className="feature-icon">💡</div>
            <span>Repo Suggestions</span>
          </div>
        </div>
      </main>

      <footer className="landing-footer">
        <p className="text-tertiary">No credit card required • Free forever</p>
      </footer>
    </div>
  )
}

// Dashboard
function Dashboard() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<'home' | 'repos' | 'settings'>('home')

  const { data: todayData, refetch: refetchToday } = useApi<TodayStatus>('/api/github/today', user?.id)
  const { data: suggestionData } = useApi<{ suggestion: Repo }>('/api/github/suggestion', user?.id)
  const { data: contributionsData } = useApi<{ contributions: Contribution[] }>('/api/github/contributions', user?.id)

  if (!user) return null

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">🔥</span>
            <span className="logo-text">1D1C</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
            Home
          </button>
          <button
            className={`nav-item ${activeTab === 'repos' ? 'active' : ''}`}
            onClick={() => setActiveTab('repos')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            Repos
          </button>
          <button
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Settings
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <img src={user.avatar} alt={user.username} className="user-avatar" />
            <div className="user-info">
              <span className="user-name">{user.username}</span>
              <button className="btn-ghost btn-sm" onClick={logout}>Sign out</button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {activeTab === 'home' && (
          <HomeTab
            today={todayData}
            suggestion={suggestionData?.suggestion}
            contributions={contributionsData?.contributions || []}
            onRefresh={refetchToday}
          />
        )}
        {activeTab === 'repos' && <ReposTab userId={user.id} />}
        {activeTab === 'settings' && <SettingsTab userId={user.id} />}
      </main>
    </div>
  )
}

// Home Tab
function HomeTab({
  today,
  suggestion,
  contributions,
  onRefresh
}: {
  today: TodayStatus | null
  suggestion?: Repo
  contributions: Contribution[]
  onRefresh: () => void
}) {
  const currentStreak = today?.currentStreak ?? 0
  const hasCommitted = today?.hasCommitted ?? false

  return (
    <div className="home-tab">
      <header className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
        <button className="btn-secondary" onClick={onRefresh}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Refresh
        </button>
      </header>

      <div className="stats-grid">
        {/* Status Card */}
        <div className={`stat-card stat-card-lg ${hasCommitted ? 'committed' : 'pending'}`}>
          <div className="stat-card-glow" />
          <div className="stat-icon-large">
            {hasCommitted ? '✅' : '⏳'}
          </div>
          <div className="stat-content">
            <h3 className="stat-label">Today's Status</h3>
            <p className="stat-value-large">
              {hasCommitted ? 'Committed!' : 'Waiting for commit'}
            </p>
            {today && today.commitCount > 0 && (
              <p className="stat-detail">{today.commitCount} commit{today.commitCount > 1 ? 's' : ''} today</p>
            )}
          </div>
        </div>

        {/* Streak Card */}
        <div className="stat-card streak-card">
          <div className="streak-display">
            <span className="streak-flame animate-float">🔥</span>
            <span className="streak-number">{currentStreak}</span>
          </div>
          <div className="stat-content">
            <h3 className="stat-label">Current Streak</h3>
            <p className="stat-detail">
              Longest: {today?.longestStreak ?? 0} days
            </p>
          </div>
        </div>
      </div>

      {/* Suggestion Card */}
      {suggestion && !hasCommitted && (
        <div className="suggestion-card animate-slide-up">
          <div className="suggestion-header">
            <div className="suggestion-icon">💡</div>
            <div>
              <h3>Suggested Repository</h3>
              <p className="text-tertiary">This repo needs some attention</p>
            </div>
          </div>
          <div className="suggestion-content">
            <a href={suggestion.html_url} target="_blank" rel="noopener noreferrer" className="repo-link">
              <span className="repo-name">{suggestion.full_name}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
            <div className="repo-meta">
              {suggestion.language && (
                <span className="repo-language">
                  <span className="language-dot" />
                  {suggestion.language}
                </span>
              )}
              <span className="repo-stat">
                {suggestion.daysSinceLastPush} days since last push
              </span>
            </div>
            {suggestion.description && (
              <p className="repo-description">{suggestion.description}</p>
            )}
          </div>
        </div>
      )}

      {/* Contribution Heatmap */}
      <div className="contributions-section">
        <h3 className="section-title">Recent Activity</h3>
        <ContributionHeatmap contributions={contributions} />
      </div>
    </div>
  )
}

// Contribution Heatmap
function ContributionHeatmap({ contributions }: { contributions: Contribution[] }) {
  const today = new Date()
  const days = 84 // 12 weeks

  const getContributionLevel = (count: number): number => {
    if (count === 0) return 0
    if (count <= 2) return 1
    if (count <= 5) return 2
    if (count <= 10) return 3
    return 4
  }

  const grid = Array.from({ length: days }, (_, i) => {
    const date = new Date(today)
    date.setDate(date.getDate() - (days - 1 - i))
    const dateStr = date.toISOString().split('T')[0]
    const contribution = contributions.find(c => c.date === dateStr)
    return {
      date: dateStr,
      count: contribution?.count || 0,
      level: getContributionLevel(contribution?.count || 0)
    }
  })

  return (
    <div className="heatmap">
      <div className="heatmap-grid">
        {grid.map((day, i) => (
          <div
            key={i}
            className={`heatmap-cell level-${day.level}`}
            title={`${day.date}: ${day.count} commits`}
          />
        ))}
      </div>
      <div className="heatmap-legend">
        <span className="text-tertiary">Less</span>
        <div className="heatmap-cell level-0" />
        <div className="heatmap-cell level-1" />
        <div className="heatmap-cell level-2" />
        <div className="heatmap-cell level-3" />
        <div className="heatmap-cell level-4" />
        <span className="text-tertiary">More</span>
      </div>
    </div>
  )
}

// Repos Tab
function ReposTab({ userId }: { userId: string }) {
  const { data, loading, refetch } = useApi<{ repos: Repo[] }>('/api/github/repos', userId)

  const toggleExclude = async (repoFullName: string, currentlyExcluded: boolean) => {
    const url = `${API_URL}/api/user/excluded-repos${currentlyExcluded ? `/${encodeURIComponent(repoFullName)}` : ''}`
    await fetch(url, {
      method: currentlyExcluded ? 'DELETE' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId
      },
      body: currentlyExcluded ? undefined : JSON.stringify({ repo_full_name: repoFullName })
    })
    refetch()
  }

  return (
    <div className="repos-tab">
      <header className="page-header">
        <div>
          <h1 className="page-title">Repositories</h1>
          <p className="page-subtitle">Manage which repos appear in suggestions</p>
        </div>
      </header>

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading repositories...</p>
        </div>
      ) : (
        <div className="repos-list">
          {data?.repos.map(repo => (
            <div key={repo.id} className={`repo-item ${repo.excluded ? 'excluded' : ''}`}>
              <div className="repo-info">
                <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="repo-name-link">
                  {repo.name}
                </a>
                {repo.description && (
                  <p className="repo-description-small">{repo.description}</p>
                )}
                <div className="repo-meta">
                  {repo.language && (
                    <span className="repo-language">
                      <span className="language-dot" />
                      {repo.language}
                    </span>
                  )}
                </div>
              </div>
              <button
                className={`btn-toggle ${repo.excluded ? 'excluded' : ''}`}
                onClick={() => toggleExclude(repo.full_name, repo.excluded)}
              >
                {repo.excluded ? 'Include' : 'Exclude'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Settings Tab
function SettingsTab({ userId }: { userId: string }) {
  const { data, refetch } = useApi<{ preferences: any }>('/api/user/preferences', userId)

  const updatePreference = async (key: string, value: any) => {
    await fetch(`${API_URL}/api/user/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId
      },
      body: JSON.stringify({ [key]: value })
    })
    refetch()
  }

  const prefs = data?.preferences

  return (
    <div className="settings-tab">
      <header className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure your notification preferences</p>
        </div>
      </header>

      <div className="settings-sections">
        <section className="settings-section">
          <h3 className="section-title">Notifications</h3>

          <div className="setting-item">
            <div className="setting-info">
              <h4>Email Reminders</h4>
              <p>Receive email reminders when you haven't committed</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={prefs?.email_enabled ?? true}
                onChange={(e) => updatePreference('email_enabled', e.target.checked ? 1 : 0)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <h4>Push Notifications</h4>
              <p>Get browser push notifications</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={prefs?.push_enabled ?? true}
                onChange={(e) => updatePreference('push_enabled', e.target.checked ? 1 : 0)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <h4>Skip Weekends</h4>
              <p>Don't send reminders on Saturday and Sunday</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={prefs?.weekends_off ?? false}
                onChange={(e) => updatePreference('weekends_off', e.target.checked ? 1 : 0)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </section>

        <section className="settings-section">
          <h3 className="section-title">Reminder Times</h3>

          <div className="setting-item">
            <div className="setting-info">
              <h4>Morning Reminder</h4>
              <p>Motivational nudge to start your day</p>
            </div>
            <input
              type="time"
              className="time-input"
              value={prefs?.morning_time || '09:00'}
              onChange={(e) => updatePreference('morning_time', e.target.value)}
            />
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <h4>Afternoon Reminder</h4>
              <p>Mid-day check-in</p>
            </div>
            <input
              type="time"
              className="time-input"
              value={prefs?.afternoon_time || '15:00'}
              onChange={(e) => updatePreference('afternoon_time', e.target.value)}
            />
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <h4>Evening Reminder</h4>
              <p>Last chance before midnight</p>
            </div>
            <input
              type="time"
              className="time-input"
              value={prefs?.evening_time || '20:00'}
              onChange={(e) => updatePreference('evening_time', e.target.value)}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

// Main App
function App() {
  const { user } = useAuth()

  return user ? <Dashboard /> : <LandingPage />
}

// Wrap with provider
export default function AppWithProvider() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  )
}
