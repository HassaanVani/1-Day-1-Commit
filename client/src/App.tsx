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
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [endpoint, userId])

  const refetch = () => {
    if (!userId) return
    setLoading(true)
    fetch(`${API_URL}${endpoint}`, {
      headers: { 'X-User-Id': userId }
    })
      .then(res => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  return { data, loading, refetch }
}

// Icons
const Icons = {
  git: <svg viewBox="0 0 16 16"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" /></svg>,
  check: <svg viewBox="0 0 16 16"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" /></svg>,
  clock: <svg viewBox="0 0 16 16"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z" /></svg>,
  home: <svg viewBox="0 0 16 16"><path d="M6.906.664a1.749 1.749 0 0 1 2.187 0l5.25 4.2c.415.332.657.835.657 1.367v7.019A1.75 1.75 0 0 1 13.25 15h-3.5a.75.75 0 0 1-.75-.75V9H7v5.25a.75.75 0 0 1-.75.75h-3.5A1.75 1.75 0 0 1 1 13.25V6.23c0-.531.242-1.034.657-1.366l5.25-4.2Z" /></svg>,
  repo: <svg viewBox="0 0 16 16"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z" /></svg>,
  gear: <svg viewBox="0 0 16 16"><path d="M8 0a8.2 8.2 0 0 1 .701.031C9.444.095 9.99.645 10.16 1.29l.288 1.107c.018.066.079.158.212.224.231.114.454.243.668.386.123.082.233.09.299.071l1.103-.303c.644-.176 1.392.021 1.82.63.27.385.506.792.704 1.218.315.675.111 1.422-.364 1.891l-.814.806c-.049.048-.098.147-.088.294a6.084 6.084 0 0 1 0 .772c-.01.147.04.246.088.294l.814.806c.475.469.679 1.216.364 1.891a7.977 7.977 0 0 1-.704 1.217c-.428.61-1.176.807-1.82.63l-1.102-.302c-.067-.019-.177-.011-.3.071a5.909 5.909 0 0 1-.668.386c-.133.066-.194.158-.211.224l-.29 1.106c-.168.646-.715 1.196-1.458 1.26a8.006 8.006 0 0 1-1.402 0c-.743-.064-1.289-.614-1.458-1.26l-.289-1.106c-.018-.066-.079-.158-.212-.224a5.738 5.738 0 0 1-.668-.386c-.123-.082-.233-.09-.299-.071l-1.103.303c-.644.176-1.392-.021-1.82-.63a8.12 8.12 0 0 1-.704-1.218c-.315-.675-.111-1.422.363-1.891l.815-.806c.049-.048.098-.147.088-.294a6.214 6.214 0 0 1 0-.772c.01-.147-.04-.246-.088-.294l-.815-.806C.635 6.045.431 5.298.746 4.623a7.92 7.92 0 0 1 .704-1.217c.428-.61 1.176-.807 1.82-.63l1.102.302c.067.019.177.011.3-.071.214-.143.437-.272.668-.386.133-.066.194-.158.211-.224l.29-1.106C6.009.645 6.556.095 7.299.03 7.53.01 7.764 0 8 0Zm-.571 1.525c-.036.003-.108.036-.137.146l-.289 1.105c-.147.561-.549.967-.998 1.189-.173.086-.34.183-.5.29-.417.278-.97.423-1.529.27l-1.103-.303c-.109-.03-.175.016-.195.045-.22.312-.412.644-.573.99-.014.031-.021.11.059.19l.815.806c.411.406.562.957.53 1.456a4.709 4.709 0 0 0 0 .582c.032.499-.119 1.05-.53 1.456l-.815.806c-.081.08-.073.159-.059.19.162.346.353.677.573.989.02.03.085.076.195.046l1.102-.303c.56-.153 1.113-.008 1.53.27.161.107.328.204.501.29.447.222.85.629.997 1.189l.289 1.105c.029.109.101.143.137.146a6.6 6.6 0 0 0 1.142 0c.036-.003.108-.036.137-.146l.289-1.105c.147-.561.549-.967.998-1.189.173-.086.34-.183.5-.29.417-.278.97-.423 1.529-.27l1.103.303c.109.029.175-.016.195-.045.22-.313.411-.644.573-.99.014-.031.021-.11-.059-.19l-.815-.806c-.411-.406-.562-.957-.53-1.456a4.709 4.709 0 0 0 0-.582c-.032-.499.119-1.05.53-1.456l.815-.806c.081-.08.073-.159.059-.19a6.464 6.464 0 0 0-.573-.989c-.02-.03-.085-.076-.195-.046l-1.102.303c-.56.153-1.113.008-1.53-.27a4.44 4.44 0 0 0-.501-.29c-.447-.222-.85-.629-.997-1.189l-.289-1.105c-.029-.11-.101-.143-.137-.146a6.6 6.6 0 0 0-1.142 0ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9.5 8a1.5 1.5 0 1 0-3.001.001A1.5 1.5 0 0 0 9.5 8Z" /></svg>,
  signOut: <svg viewBox="0 0 16 16"><path d="M2 2.75C2 1.784 2.784 1 3.75 1h2.5a.75.75 0 0 1 0 1.5h-2.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h2.5a.75.75 0 0 1 0 1.5h-2.5A1.75 1.75 0 0 1 2 13.25Zm10.44 4.5-1.97-1.97a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l1.97-1.97H6.75a.75.75 0 0 1 0-1.5Z" /></svg>,
  chevron: <svg viewBox="0 0 16 16"><path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" /></svg>,
  flame: <svg viewBox="0 0 16 16"><path d="M9.533.753V.752c.217 2.385 1.463 3.626 2.653 4.81C13.37 6.74 14.498 7.863 14.498 10c0 3.5-3 5.5-6.5 5.5S1.5 13.512 1.5 10c0-1.298.536-2.56 1.425-3.286.376-.308.862-.238 1.12.09.205.259.194.6-.015.847-.082.096-.213.239-.397.439-.492.537-.972 1.19-.972 1.91 0 1.827 1.879 3.5 4.839 3.5 2.96 0 4.839-1.673 4.839-3.5 0-1.174-.646-2.012-1.424-2.778-.78-.769-1.695-1.546-2.279-2.663-.166-.32-.09-.7.213-.895.09-.057.19-.09.297-.09h.008l.25.005c.217.007.438.02.664.047l.067.008V.753Zm-.009 9.245c.128-.126.226-.277.292-.445-.1.247-.233.476-.396.68-.22.276-.495.515-.817.698V11c0-.05-.006-.099-.017-.147 0 .148-.028.29-.082.423Z" /></svg>,
  gitBranch: <svg viewBox="0 0 16 16"><path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" /></svg>,
  issue: <svg viewBox="0 0 16 16"><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" /><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" /></svg>,
  link: <svg viewBox="0 0 16 16"><path d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z" /></svg>,
}

// ============================================
// Landing Page
// ============================================
function LandingPage() {
  const { login } = useAuth()
  const [showOutput, setShowOutput] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShowOutput(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="landing-container">
      <div className="landing-content">
        <div className="landing-hero">
          <div className="landing-logo">
            {Icons.flame}
          </div>
          <h1 className="landing-title">1 Day 1 Commit</h1>
          <p className="landing-subtitle">
            Build consistent coding habits. One commit at a time.
          </p>
        </div>

        <div className="terminal-window">
          <div className="terminal-titlebar">
            <div className="terminal-buttons">
              <span className="terminal-btn close"></span>
              <span className="terminal-btn minimize"></span>
              <span className="terminal-btn maximize"></span>
            </div>
            <span className="terminal-title">~/.config/1d1c — zsh</span>
            <div style={{ width: 52 }}></div>
          </div>

          <div className="terminal-body">
            <div className="terminal-line">
              <span className="terminal-prompt">❯</span>
              <span className="typing-container">
                <span className="terminal-command">npx 1d1c init --streak</span>
              </span>
              <span className="terminal-cursor"></span>
            </div>

            {showOutput && (
              <>
                <div className="terminal-output output-line show" style={{ animationDelay: '0s' }}>
                  <br />
                  <span style={{ color: 'var(--color-accent-emphasis)' }}>⠋</span> Initializing 1 Day 1 Commit...
                </div>
                <div className="terminal-output output-line show" style={{ animationDelay: '0.3s' }}>
                  <span className="text-success">✓</span> Connected to GitHub
                </div>
                <div className="terminal-output output-line show" style={{ animationDelay: '0.6s' }}>
                  <span className="text-success">✓</span> Loaded 47 repositories
                </div>
                <div className="terminal-output output-line show" style={{ animationDelay: '0.9s' }}>
                  <span className="text-success">✓</span> Notifications configured
                </div>
                <div className="terminal-output output-line show" style={{ animationDelay: '1.2s' }}>
                  <br />
                  <span style={{ color: 'var(--text-primary)' }}>Ready! Your streak starts now.</span>
                </div>
              </>
            )}

            <div className="terminal-stats">
              <div className="stat-item">
                <div className="stat-value">23</div>
                <div className="stat-label">Current Streak</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">156</div>
                <div className="stat-label">Total Commits</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">47</div>
                <div className="stat-label">Repositories</div>
              </div>
            </div>
          </div>
        </div>

        <div className="cta-section">
          <button className="btn-github" onClick={login}>
            {Icons.git}
            <span>Continue with GitHub</span>
          </button>
          <span className="cta-hint">Free forever • No credit card required</span>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Dashboard
// ============================================
function Dashboard() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<'home' | 'repos' | 'settings'>('home')

  const { data: todayData, refetch: refetchToday } = useApi<TodayStatus>('/api/github/today', user?.id)
  const { data: suggestionData } = useApi<{ suggestion: Repo }>('/api/github/suggestion', user?.id)
  const { data: contributionsData } = useApi<{ contributions: Contribution[] }>('/api/github/contributions', user?.id)

  if (!user) return null

  const tabs = [
    { id: 'home' as const, icon: Icons.home, label: 'Dashboard' },
    { id: 'repos' as const, icon: Icons.repo, label: 'Repositories' },
    { id: 'settings' as const, icon: Icons.gear, label: 'Settings' },
  ]

  return (
    <div className="app-layout">
      {/* Activity Bar */}
      <div className="activity-bar">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`activity-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
          >
            {tab.icon}
          </div>
        ))}

        <div className="activity-spacer" />

        <div className="activity-item" onClick={logout} title="Sign out">
          {Icons.signOut}
        </div>
      </div>

      {/* Side Panel */}
      <div className="side-panel">
        <div className="panel-header">
          Explorer
        </div>

        <div className="panel-section">
          <div className="section-header">
            {Icons.chevron}
            <span>1 DAY 1 COMMIT</span>
          </div>
          <div className="section-content">
            {activeTab === 'home' && (
              <>
                <div className="tree-item active">
                  <span className="file-icon ts"></span>
                  dashboard.tsx
                </div>
                <div className="tree-item">
                  <span className="file-icon json"></span>
                  streak.json
                </div>
              </>
            )}
            {activeTab === 'repos' && (
              <div className="tree-item active">
                <span className="file-icon json"></span>
                repositories.json
              </div>
            )}
            {activeTab === 'settings' && (
              <div className="tree-item active">
                <span className="file-icon json"></span>
                settings.json
              </div>
            )}
          </div>
        </div>

        <div className="panel-section" style={{ marginTop: 'auto' }}>
          <div className="section-header">
            {Icons.chevron}
            <span>ACCOUNT</span>
          </div>
          <div className="section-content">
            <div className="tree-item">
              <img
                src={user.avatar}
                alt=""
                style={{ width: 16, height: 16, borderRadius: '50%' }}
              />
              {user.username}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="editor-tabs">
          <div className="editor-tab active">
            {activeTab === 'home' && <>{Icons.home} dashboard.tsx</>}
            {activeTab === 'repos' && <>{Icons.repo} repositories.json</>}
            {activeTab === 'settings' && <>{Icons.gear} settings.json</>}
          </div>
        </div>

        <div className="breadcrumbs">
          <span className="breadcrumb-item">1d1c</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-item">{user.username}</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-item">
            {activeTab === 'home' && 'dashboard'}
            {activeTab === 'repos' && 'repositories'}
            {activeTab === 'settings' && 'settings'}
          </span>
        </div>

        <div className="editor-content">
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

        {/* Status Bar */}
        <div className="status-bar">
          <div className="status-bar-left">
            <div className="status-bar-item">
              {Icons.gitBranch}
              main
            </div>
            <div className="status-bar-item">
              {Icons.flame}
              {todayData?.currentStreak || 0} day streak
            </div>
          </div>
          <div className="status-bar-right">
            <div className="status-bar-item">
              {todayData?.hasCommitted ? Icons.check : Icons.clock}
              {todayData?.hasCommitted ? 'Committed' : 'Pending'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Home Tab
// ============================================
function HomeTab({ today, suggestion, contributions, onRefresh }: {
  today: TodayStatus | null
  suggestion: Repo | undefined
  contributions: Contribution[]
  onRefresh: () => void
}) {
  const hasCommitted = today?.hasCommitted || false
  const streak = today?.currentStreak || 0
  const longestStreak = today?.longestStreak || 0

  return (
    <div className="dashboard-grid">
      <div>
        {/* Status Card */}
        <div className="status-card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="status-card-header">
            <span className="status-card-title">
              {Icons.flame}
              Today's Status
            </span>
            <button
              onClick={onRefresh}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)',
                padding: '4px 12px',
                borderRadius: 6,
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              Refresh
            </button>
          </div>
          <div className="status-card-body">
            <div className={`commit-status ${hasCommitted ? 'success' : 'pending'}`}>
              <div className={`status-icon ${hasCommitted ? 'success' : 'pending'}`}>
                {hasCommitted ? Icons.check : Icons.clock}
              </div>
              <div className="status-info">
                <h3>{hasCommitted ? 'Great work!' : 'No commits yet'}</h3>
                <p>
                  {hasCommitted
                    ? `You've made ${today?.commitCount || 1} commit${(today?.commitCount || 1) > 1 ? 's' : ''} today. Keep it up!`
                    : 'Make your daily commitment to keep your streak alive.'
                  }
                </p>
              </div>
            </div>

            <div className="streak-display">
              <span className="streak-number">{streak}</span>
              <span className="streak-label">day streak</span>
            </div>
            <div className="streak-record">
              Personal best: {longestStreak} days
            </div>
          </div>
        </div>

        {/* Suggestion Card */}
        {suggestion && !hasCommitted && (
          <div className="suggestion-card" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="suggestion-label">Suggested Repository</div>
            <div className="suggestion-repo">
              <a href={suggestion.html_url} target="_blank" rel="noopener noreferrer">
                {suggestion.full_name}
              </a>
            </div>
            <div className="suggestion-meta">
              <span>{Icons.clock} {suggestion.daysSinceLastPush} days since last push</span>
              <span>{Icons.issue} {suggestion.open_issues_count} open issues</span>
            </div>
            <a
              href={suggestion.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="suggestion-action"
            >
              {Icons.link}
              Open Repository
            </a>
          </div>
        )}

        {/* Contribution Graph */}
        <ContributionGraph contributions={contributions} />
      </div>

      <div>
        {/* Quick Stats */}
        <div className="status-card">
          <div className="status-card-header">
            <span className="status-card-title">
              {Icons.gitBranch}
              Quick Stats
            </span>
          </div>
          <div className="status-card-body">
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-secondary">Current Streak</span>
                <span className="font-semibold text-success">{streak} days</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-secondary">Longest Streak</span>
                <span className="font-semibold">{longestStreak} days</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-secondary">This Week</span>
                <span className="font-semibold">{contributions.slice(-7).filter(c => c.count > 0).length} days</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-secondary">Today's Commits</span>
                <span className="font-semibold">{today?.commitCount || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Contribution Graph
// ============================================
function ContributionGraph({ contributions }: { contributions: Contribution[] }) {
  const weeks = 12
  const days = weeks * 7

  const grid = Array.from({ length: days }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1 - i))
    const dateStr = d.toISOString().split('T')[0]
    const count = contributions.find(c => c.date === dateStr)?.count || 0
    return { date: dateStr, count }
  })

  const weekGroups = []
  for (let i = 0; i < grid.length; i += 7) {
    weekGroups.push(grid.slice(i, i + 7))
  }

  const getLevel = (count: number) => {
    if (count === 0) return ''
    if (count <= 2) return 'l1'
    if (count <= 4) return 'l2'
    if (count <= 6) return 'l3'
    return 'l4'
  }

  return (
    <div className="contribution-graph">
      <div className="contribution-header">
        <span className="contribution-title">Contribution Activity</span>
        <span className="contribution-period">Last {weeks} weeks</span>
      </div>

      <div className="contribution-grid">
        {weekGroups.map((week, wi) => (
          <div key={wi} className="contribution-week">
            {week.map((day, di) => (
              <div
                key={di}
                className={`contribution-day ${getLevel(day.count)}`}
                title={`${day.date}: ${day.count} commits`}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="contribution-legend">
        <span>Less</span>
        <div className="legend-colors">
          <span style={{ background: 'var(--contrib-l0)' }}></span>
          <span style={{ background: 'var(--contrib-l1)' }}></span>
          <span style={{ background: 'var(--contrib-l2)' }}></span>
          <span style={{ background: 'var(--contrib-l3)' }}></span>
          <span style={{ background: 'var(--contrib-l4)' }}></span>
        </div>
        <span>More</span>
      </div>
    </div>
  )
}

// ============================================
// Repos Tab
// ============================================
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

  const repos = data?.repos || []

  return (
    <div className="repos-container">
      <div className="repos-header">
        <h2 className="repos-title">Repositories</h2>
        <span className="repos-count">{repos.length} repositories</span>
      </div>

      <div className="repos-list">
        {loading ? (
          <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading repositories...
          </div>
        ) : repos.length === 0 ? (
          <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No repositories found
          </div>
        ) : (
          repos.map(repo => (
            <div key={repo.id} className="repo-item">
              <div className="repo-info">
                <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="repo-name">
                  {repo.full_name}
                </a>
                <div className="repo-meta">
                  {repo.language && (
                    <span className="repo-language">
                      <span className="language-dot" style={{
                        background: repo.language === 'TypeScript' ? '#3178c6' :
                          repo.language === 'JavaScript' ? '#f1e05a' :
                            repo.language === 'Python' ? '#3572A5' :
                              repo.language === 'Rust' ? '#dea584' :
                                'var(--text-secondary)'
                      }}></span>
                      {repo.language}
                    </span>
                  )}
                  <span>Updated {new Date(repo.pushed_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="repo-actions">
                {repo.excluded && <span className="excluded-badge">Excluded</span>}
                <button
                  className={`btn-exclude ${repo.excluded ? 'include' : 'exclude'}`}
                  onClick={() => toggleExclude(repo.full_name, repo.excluded)}
                >
                  {repo.excluded ? 'Include' : 'Exclude'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ============================================
// Settings Tab
// ============================================
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

  const prefs = data?.preferences || {}

  return (
    <div className="settings-container">
      <div className="settings-section">
        <div className="settings-section-header">
          <h3 className="settings-section-title">Notifications</h3>
          <p className="settings-section-desc">Configure how you want to be reminded about your daily commits.</p>
        </div>
        <div className="settings-section-body">
          <div className="setting-row">
            <div>
              <div className="setting-label">Email Reminders</div>
              <div className="setting-desc">Receive email notifications when you haven't committed</div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={prefs.email_enabled ?? true}
                onChange={e => updatePreference('email_enabled', e.target.checked ? 1 : 0)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Skip Weekends</div>
              <div className="setting-desc">Don't send reminders on Saturday and Sunday</div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={prefs.weekends_off ?? false}
                onChange={e => updatePreference('weekends_off', e.target.checked ? 1 : 0)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">
          <h3 className="settings-section-title">Reminder Times</h3>
          <p className="settings-section-desc">Set when you want to receive your daily reminders.</p>
        </div>
        <div className="settings-section-body">
          <div className="setting-row">
            <div className="setting-label">Morning</div>
            <input
              type="time"
              className="time-input"
              value={prefs.morning_time || '09:00'}
              onChange={e => updatePreference('morning_time', e.target.value)}
            />
          </div>
          <div className="setting-row">
            <div className="setting-label">Afternoon</div>
            <input
              type="time"
              className="time-input"
              value={prefs.afternoon_time || '15:00'}
              onChange={e => updatePreference('afternoon_time', e.target.value)}
            />
          </div>
          <div className="setting-row">
            <div className="setting-label">Evening</div>
            <input
              type="time"
              className="time-input"
              value={prefs.evening_time || '20:00'}
              onChange={e => updatePreference('evening_time', e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// App
// ============================================
function App() {
  const { user } = useAuth()
  return user ? <Dashboard /> : <LandingPage />
}

export default function AppWithProvider() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  )
}
