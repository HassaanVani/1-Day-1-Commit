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

function useAuth() {
  return useContext(AuthContext)
}

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

// ------------------------------------------------------------------
// Components (Terminal Style)
// ------------------------------------------------------------------

function ActivityBar({ activeTab, onTabChange, logout }: any) {
  return (
    <div className="sidebar">
      <div
        className={`activity-item ${activeTab === 'home' ? 'active' : ''}`}
        onClick={() => onTabChange('home')}
        title="Dashboard (Ctrl+Shift+D)"
      >
        <svg className="activity-icon" viewBox="0 0 16 16"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0z" /><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3.5a.5.5 0 0 1-.5-.5v-3.5A.5.5 0 0 1 8 4z" /></svg>
      </div>
      <div
        className={`activity-item ${activeTab === 'repos' ? 'active' : ''}`}
        onClick={() => onTabChange('repos')}
        title="Source Control (Ctrl+Shift+G)"
      >
        <svg className="activity-icon" viewBox="0 0 16 16"><path fillRule="evenodd" d="M10.5 3.5a2.5 2.5 0 0 0-5 0V4h5v-.5zm1 0V4H15v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4h3.5v-.5a3.5 3.5 0 1 1 7 0zM14 5H2v9h12V5z" /></svg>
      </div>
      <div
        className={`activity-item ${activeTab === 'settings' ? 'active' : ''}`}
        onClick={() => onTabChange('settings')}
        title="Settings (Ctrl+,)"
      >
        <svg className="activity-icon" viewBox="0 0 16 16"><path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.86z" /></svg>
      </div>

      <div style={{ flex: 1 }} />

      <div className="activity-item" onClick={logout} title="Sign Out">
        <svg className="activity-icon" viewBox="0 0 16 16"><path fillRule="evenodd" d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0v2z" /><path fillRule="evenodd" d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z" /></svg>
      </div>
    </div>
  )
}

function Explorer({ activeTab, user }: any) {
  return (
    <div className="secondary-sidebar">
      <div className="sidebar-header">Explorer</div>

      <div className="explorer-section">
        <div className="explorer-title">
          <span style={{ marginRight: 4 }}>▼</span> 1_DAY_1_COMMIT
        </div>

        {activeTab === 'home' && (
          <>
            <div className="explorer-item active">
              <span className="file-icon" style={{ background: 'var(--accent-blue)' }}></span>
              dashboard.tsx
            </div>
            <div className="explorer-item">
              <span className="file-icon" style={{ background: 'var(--accent-orange)' }}></span>
              streak.json
            </div>
          </>
        )}

        {activeTab === 'repos' && (
          <>
            <div className="explorer-item active">
              <span className="file-icon" style={{ background: 'var(--accent-yellow)' }}></span>
              repos.config
            </div>
          </>
        )}

        {activeTab === 'settings' && (
          <>
            <div className="explorer-item active">
              <span className="file-icon" style={{ background: 'var(--accent-green)' }}></span>
              settings.json
            </div>
          </>
        )}
      </div>

      <div className="explorer-section" style={{ marginTop: 'auto', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="explorer-title">
          TIMELINE
        </div>
        <div style={{ padding: '8px 20px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          User: {user.username}<br />
          Env: Production
        </div>
      </div>
    </div>
  )
}

function TerminalHeader({ path }: { path: string }) {
  const parts = path.split('/')
  return (
    <div className="editor-header">
      <div className="breadcrumb">
        1d1c
        {parts.map((part, i) => (
          <span key={i}>
            <span className="breadcrumb-separator">›</span>
            <span className={i === parts.length - 1 ? 'breadcrumb-current' : ''}>{part}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function TerminalInput({ command }: { command: string }) {
  return (
    <div className="terminal-input-group">
      <span className="prompt">user@1d1c:<span className="prompt-path">~</span>$</span>
      <span className="command">{command}</span>
      <span className="cursor" />
    </div>
  )
}

function LandingPage() {
  const { login } = useAuth()

  return (
    <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div className="landing-terminal">
        <div className="terminal-header">
          <div className="terminal-dot red" />
          <div className="terminal-dot yellow" />
          <div className="terminal-dot green" />
          <div style={{ marginLeft: 8, fontSize: 12, color: '#aaa' }}>bash — 80x24</div>
        </div>
        <div className="terminal-body">
          <div style={{ marginBottom: 16 }}>
            <span className="text-accent">1 Day 1 Commit</span> v1.0.0
            <br />
            Initializing habit protocols...
          </div>

          <div className="typewriter" style={{ color: 'var(--text-white)' }}>
            $ ./build_habit.sh --consistent
          </div>

          <div style={{ marginTop: 24, opacity: 0, animation: 'fadeIn 0.5s forwards 1s' }}>
            &gt; Tracking streak... <span className="text-success">[OK]</span>
            <br />
            &gt; Configuring notifications... <span className="text-success">[OK]</span>
            <br />
            &gt; Analyzing repos... <span className="text-success">[OK]</span>
          </div>

          <div style={{ marginTop: 40, opacity: 0, animation: 'fadeIn 0.5s forwards 1.5s' }}>
            <span className="text-secondary"># Ready to start?</span>
            <br />
            <br />
            <button className="btn btn-primary" onClick={login}>
              Connect with GitHub
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Dashboard() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<'home' | 'repos' | 'settings'>('home')

  const { data: todayData, refetch: refetchToday } = useApi<TodayStatus>('/api/github/today', user?.id)
  const { data: suggestionData } = useApi<{ suggestion: Repo }>('/api/github/suggestion', user?.id)
  const { data: contributionsData } = useApi<{ contributions: Contribution[] }>('/api/github/contributions', user?.id)

  if (!user) return null

  return (
    <div className="app-container">
      <ActivityBar activeTab={activeTab} onTabChange={setActiveTab} logout={logout} />
      <Explorer activeTab={activeTab} user={user} />

      <div className="main-content">
        <TerminalHeader path={`src/views/${activeTab === 'home' ? 'dashboard' : activeTab}.tsx`} />

        <div className="editor-area">
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
        </div>
      </div>
    </div>
  )
}

function HomeTab({ today, suggestion, contributions, onRefresh }: any) {
  const hasCommitted = today?.hasCommitted || false
  const streak = today?.currentStreak || 0

  return (
    <div className="dashboard-grid">
      <div className="main-panel">
        <TerminalInput command="git status" />

        <div className="panel">
          <div className="panel-header">
            <span>Current Status</span>
            <button className="btn btn-outline" style={{ padding: '2px 8px', fontSize: 10 }} onClick={onRefresh}>REFRESH</button>
          </div>
          <div className="panel-content">
            <div className="status-line">
              <span className="status-timestamp">Today</span>
              <span className={hasCommitted ? "text-success" : "text-warning"}>
                {hasCommitted ? "Changes committed to repository." : "No changes committed yet."}
              </span>
            </div>

            <div className="status-line">
              <span className="status-timestamp">Streak</span>
              <span className="text-secondary">
                On branch <span className="text-accent">main</span> via <span className="text-accent">origin/daily</span>
              </span>
            </div>

            <div style={{ fontFamily: 'monospace', margin: '20px 0', fontSize: '14px' }}>
              streak: <span className="text-success">{streak} days</span>
              <br />
              record: {today?.longestStreak} days
            </div>
          </div>
        </div>

        {suggestion && !hasCommitted && (
          <div className="panel">
            <div className="panel-header">Suggested Task</div>
            <div className="panel-content">
              <span className="text-secondary"># TODO: Push to this repository</span>
              <br />
              <a href={suggestion.html_url} target="_blank" className="text-link text-xl font-mono" style={{ textDecoration: 'none', color: 'var(--text-link)', display: 'block', margin: '8px 0' }}>
                {suggestion.full_name}
              </a>
              <div className="text-sm text-secondary">
                Last push: <span className="text-warning">{suggestion.daysSinceLastPush} days ago</span>
                {' • '}
                Issues: <span className="text-accent">{suggestion.open_issues_count} open</span>
              </div>
            </div>
          </div>
        )}

        <div className="panel">
          <div className="panel-header">Contribution Log</div>
          <div className="panel-content">
            <ContributionHeatmap contributions={contributions} />
          </div>
        </div>
      </div>

      <div className="side-panel">
        <div className="panel">
          <div className="panel-header">Properties</div>
          <div className="panel-content">
            <div className="text-xs text-secondary mb-2">WORKSPACE</div>
            <div className="text-sm">Production</div>
            <br />
            <div className="text-xs text-secondary mb-2">GIT CONFIG</div>
            <div className="text-sm">user.name: {today?.username || 'user'}</div>
            <div className="text-sm">core.editor: vscode</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ContributionHeatmap({ contributions }: { contributions: Contribution[] }) {
  const days = 84
  const grid = Array.from({ length: days }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1 - i))
    return contributions.find(c => c.date === d.toISOString().split('T')[0])?.count || 0
  })

  return (
    <div className="heatmap-container">
      <div className="heatmap-grid" style={{ flexWrap: 'wrap', maxWidth: '100%' }}>
        {grid.map((count, i) => (
          <div
            key={i}
            className={`heatmap-day l${Math.min(count > 0 ? Math.ceil(count / 2) : 0, 4)}`}
            title={`${count} commits`}
          />
        ))}
      </div>
      <div className="text-xs text-secondary" style={{ marginTop: 8, textAlign: 'right' }}>
        Last 12 Weeks
      </div>
    </div>
  )
}

function ReposTab({ userId }: { userId: string }) {
  const { data, loading, refetch } = useApi<{ repos: Repo[] }>('/api/github/repos', userId)

  const toggleExclude = async (repoFullName: string, currentlyExcluded: boolean) => {
    const url = `${API_URL}/api/user/excluded-repos${currentlyExcluded ? `/${encodeURIComponent(repoFullName)}` : ''}`
    await fetch(url, {
      method: currentlyExcluded ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
      body: currentlyExcluded ? undefined : JSON.stringify({ repo_full_name: repoFullName })
    })
    refetch()
  }

  return (
    <div style={{ padding: '20px', maxWidth: '900px' }}>
      <TerminalInput command="cat .gitignore" />

      <div className="panel">
        <div className="panel-header">
          <span>Repository List</span>
          <span className="text-xs text-secondary">{data?.repos.length} repos found</span>
        </div>
        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 20 }}>Loading...</div>
          ) : (
            data?.repos.map(repo => (
              <div key={repo.id} className="repo-row">
                <div>
                  <a href={repo.html_url} target="_blank" className="repo-name">{repo.full_name}</a>
                  <span className="text-secondary text-xs" style={{ marginLeft: 8 }}>{repo.language}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {repo.excluded && <span className="text-warning text-xs">EXCLUDED</span>}
                  <button
                    className="btn btn-outline"
                    style={{ fontSize: 10, padding: '2px 6px' }}
                    onClick={() => toggleExclude(repo.full_name, repo.excluded)}
                  >
                    {repo.excluded ? '+ INCLUDE' : '- EXCLUDE'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function SettingsTab({ userId }: { userId: string }) {
  const { data, refetch } = useApi<{ preferences: any }>('/api/user/preferences', userId)

  const updatePreference = async (key: string, value: any) => {
    await fetch(`${API_URL}/api/user/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
      body: JSON.stringify({ [key]: value })
    })
    refetch()
  }

  const prefs = data?.preferences

  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <TerminalInput command="vim settings.json" />

      <div className="panel">
        <div className="panel-header">User Preferences</div>
        <div className="panel-content">
          <div className="form-group">
            <span className="text-accent font-bold mb-4 display-block">{'{'}</span>

            <div style={{ paddingLeft: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <span className="text-secondary">// Notifications</span>
                <label className="form-checkbox" style={{ marginTop: 8 }}>
                  <input type="checkbox" hidden checked={prefs?.email_enabled ?? true} onChange={e => updatePreference('email_enabled', e.target.checked ? 1 : 0)} />
                  <span className="checkbox-visual" />
                  <span className="text-primary code">"email_enabled": {String(prefs?.email_enabled ?? true)}</span>
                </label>

                <label className="form-checkbox" style={{ marginTop: 8 }}>
                  <input type="checkbox" hidden checked={prefs?.weekends_off ?? false} onChange={e => updatePreference('weekends_off', e.target.checked ? 1 : 0)} />
                  <span className="checkbox-visual" />
                  <span className="text-primary code">"weekends_off": {String(prefs?.weekends_off ?? false)}</span>
                </label>
              </div>

              <div style={{ marginBottom: 16 }}>
                <span className="text-secondary">// Schedule</span>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="text-primary code">"morning_time": "</span>
                  <input
                    type="time"
                    style={{ background: 'var(--bg-input)', border: 'none', color: 'var(--accent-orange)', fontFamily: 'monospace' }}
                    value={prefs?.morning_time || '09:00'}
                    onChange={e => updatePreference('morning_time', e.target.value)}
                  />
                  <span className="text-primary code">"</span>
                </div>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="text-primary code">"evening_time": "</span>
                  <input
                    type="time"
                    style={{ background: 'var(--bg-input)', border: 'none', color: 'var(--accent-orange)', fontFamily: 'monospace' }}
                    value={prefs?.evening_time || '20:00'}
                    onChange={e => updatePreference('evening_time', e.target.value)}
                  />
                  <span className="text-primary code">"</span>
                </div>
              </div>
            </div>

            <span className="text-accent font-bold">{'}'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function AppWithProvider() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  )
}

function App() {
  const { user } = useAuth()
  return user ? <Dashboard /> : <LandingPage />
}

export default AppWithProvider
