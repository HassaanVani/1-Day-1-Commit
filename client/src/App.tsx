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
  username?: string
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
  score?: number
}

interface Contribution {
  date: string
  count: number
}

interface Reminder {
  id: string
  time: string
  enabled: number
  label?: string
}

interface RepoNote {
  id: string
  repo_full_name: string
  note: string | null
  difficulty: number
  priority: number
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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    setLoading(true)
    fetch(`${API_URL}${endpoint}`, {
      headers: { 'X-User-Id': userId }
    })
      .then(async res => {
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`API Error ${res.status}: ${text}`)
        }
        return res.json()
      })
      .then(setData)
      .catch(err => {
        console.error(`Failed to fetch ${endpoint}:`, err)
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [endpoint, userId])

  const refetch = () => {
    if (!userId) return
    setLoading(true)
    fetch(`${API_URL}${endpoint}`, {
      headers: { 'X-User-Id': userId }
    })
      .then(async res => {
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`API Error ${res.status}: ${text}`)
        }
        return res.json()
      })
      .then(setData)
      .catch(err => {
        console.error(`Failed to fetch ${endpoint}:`, err)
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }

  return { data, loading, error, refetch }
}

// Icons (GitHub Octicons)
const Icons = {
  github: <svg viewBox="0 0 16 16"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" /></svg>,
  check: <svg viewBox="0 0 16 16"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" /></svg>,
  clock: <svg viewBox="0 0 16 16"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z" /></svg>,
  home: <svg viewBox="0 0 16 16"><path d="M6.906.664a1.749 1.749 0 0 1 2.187 0l5.25 4.2c.415.332.657.835.657 1.367v7.019A1.75 1.75 0 0 1 13.25 15h-3.5a.75.75 0 0 1-.75-.75V9H7v5.25a.75.75 0 0 1-.75.75h-3.5A1.75 1.75 0 0 1 1 13.25V6.23c0-.531.242-1.034.657-1.366l5.25-4.2Z" /></svg>,
  repo: <svg viewBox="0 0 16 16"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z" /></svg>,
  gear: <svg viewBox="0 0 16 16"><path d="M8 0a8.2 8.2 0 0 1 .701.031C9.444.095 9.99.645 10.16 1.29l.288 1.107c.018.066.079.158.212.224.231.114.454.243.668.386.123.082.233.09.299.071l1.103-.303c.644-.176 1.392.021 1.82.63.27.385.506.792.704 1.218.315.675.111 1.422-.364 1.891l-.814.806c-.049.048-.098.147-.088.294a6.084 6.084 0 0 1 0 .772c-.01.147.04.246.088.294l.814.806c.475.469.679 1.216.364 1.891a7.977 7.977 0 0 1-.704 1.217c-.428.61-1.176.807-1.82.63l-1.102-.302c-.067-.019-.177-.011-.3.071a5.909 5.909 0 0 1-.668.386c-.133.066-.194.158-.211.224l-.29 1.106c-.168.646-.715 1.196-1.458 1.26a8.006 8.006 0 0 1-1.402 0c-.743-.064-1.289-.614-1.458-1.26l-.289-1.106c-.018-.066-.079-.158-.212-.224a5.738 5.738 0 0 1-.668-.386c-.123-.082-.233-.09-.299-.071l-1.103.303c-.644.176-1.392-.021-1.82-.63a8.12 8.12 0 0 1-.704-1.218c-.315-.675-.111-1.422.363-1.891l.815-.806c.049-.048.098-.147.088-.294a6.214 6.214 0 0 1 0-.772c.01-.147-.04-.246-.088-.294l-.815-.806C.635 6.045.431 5.298.746 4.623a7.92 7.92 0 0 1 .704-1.217c.428-.61 1.176-.807 1.82-.63l1.102.302c.067.019.177.011.3-.071.214-.143.437-.272.668-.386.133-.066.194-.158.211-.224l.29-1.106C6.009.645 6.556.095 7.299.03 7.53.01 7.764 0 8 0Zm-.571 1.525c-.036.003-.108.036-.137.146l-.289 1.105c-.147.561-.549.967-.998 1.189-.173.086-.34.183-.5.29-.417.278-.97.423-1.529.27l-1.103-.303c-.109-.03-.175.016-.195.045-.22.312-.412.644-.573.99-.014.031-.021.11.059.19l.815.806c.411.406.562.957.53 1.456a4.709 4.709 0 0 0 0 .582c.032.499-.119 1.05-.53 1.456l-.815.806c-.081.08-.073.159-.059.19.162.346.353.677.573.989.02.03.085.076.195.046l1.102-.303c.56-.153 1.113-.008 1.53.27.161.107.328.204.501.29.447.222.85.629.997 1.189l.289 1.105c.029.109.101.143.137.146a6.6 6.6 0 0 0 1.142 0c.036-.003.108-.036.137-.146l.289-1.105c.147-.561.549-.967.998-1.189.173-.086.34-.183.5-.29.417-.278.97-.423 1.529-.27l1.103.303c.109.029.175-.016.195-.045.22-.313.411-.644.573-.99.014-.031.021-.11-.059-.19l-.815-.806c-.411-.406-.562-.957-.53-1.456a4.709 4.709 0 0 0 0-.582c-.032-.499.119-1.05.53-1.456l.815-.806c.081-.08.073-.159.059-.19a6.464 6.464 0 0 0-.573-.989c-.02-.03-.085-.076-.195-.046l-1.102.303c-.56.153-1.113.008-1.53-.27a4.44 4.44 0 0 0-.501-.29c-.447-.222-.85-.629-.997-1.189l-.289-1.105c-.029-.11-.101-.143-.137-.146a6.6 6.6 0 0 0-1.142 0ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9.5 8a1.5 1.5 0 1 0-3.001.001A1.5 1.5 0 0 0 9.5 8Z" /></svg>,
  signOut: <svg viewBox="0 0 16 16"><path d="M2 2.75C2 1.784 2.784 1 3.75 1h2.5a.75.75 0 0 1 0 1.5h-2.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h2.5a.75.75 0 0 1 0 1.5h-2.5A1.75 1.75 0 0 1 2 13.25Zm10.44 4.5-1.97-1.97a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l1.97-1.97H6.75a.75.75 0 0 1 0-1.5Z" /></svg>,
  flame: <svg viewBox="0 0 16 16"><path d="M9.533.753V.752c.217 2.385 1.463 3.626 2.653 4.81C13.37 6.74 14.498 7.863 14.498 10c0 3.5-3 5.5-6.5 5.5S1.5 13.512 1.5 10c0-1.298.536-2.56 1.425-3.286.376-.308.862-.238 1.12.09.205.259.194.6-.015.847-.082.096-.213.239-.397.439-.492.537-.972 1.19-.972 1.91 0 1.827 1.879 3.5 4.839 3.5 2.96 0 4.839-1.673 4.839-3.5 0-1.174-.646-2.012-1.424-2.778-.78-.769-1.695-1.546-2.279-2.663-.166-.32-.09-.7.213-.895.09-.057.19-.09.297-.09h.008l.25.005c.217.007.438.02.664.047l.067.008V.753Zm-.009 9.245c.128-.126.226-.277.292-.445-.1.247-.233.476-.396.68-.22.276-.495.515-.817.698V11c0-.05-.006-.099-.017-.147 0 .148-.028.29-.082.423Z" /></svg>,
  gitBranch: <svg viewBox="0 0 16 16"><path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" /></svg>,
  link: <svg viewBox="0 0 16 16"><path d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z" /></svg>,
  plus: <svg viewBox="0 0 16 16"><path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z" /></svg>,
  trash: <svg viewBox="0 0 16 16"><path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z" /></svg>,
  bell: <svg viewBox="0 0 16 16"><path d="M8 16a2 2 0 0 0 1.985-1.75c.017-.137-.097-.25-.235-.25h-3.5c-.138 0-.252.113-.235.25A2 2 0 0 0 8 16ZM3 5a5 5 0 0 1 10 0v2.947c0 .05.015.098.042.139l1.703 2.555A1.519 1.519 0 0 1 13.482 13H2.518a1.516 1.516 0 0 1-1.263-2.36l1.703-2.554A.255.255 0 0 0 3 7.947Zm5-3.5A3.5 3.5 0 0 0 4.5 5v2.947c0 .346-.102.683-.294.97l-1.703 2.556a.017.017 0 0 0-.003.01l.001.006c0 .002.002.004.004.006l.006.004.007.001h10.964l.007-.001.006-.004.004-.006.001-.007a.017.017 0 0 0-.003-.01l-1.703-2.554a1.745 1.745 0 0 1-.294-.97V5A3.5 3.5 0 0 0 8 1.5Z" /></svg>,
  note: <svg viewBox="0 0 16 16"><path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm6.25 3.75a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 0 1.5h-4a.75.75 0 0 1-.75-.75ZM4.5 5.25a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1-.75-.75ZM8 8a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 0 1.5h-4A.75.75 0 0 1 8 8Zm-2.75-.75a.75.75 0 0 0 0 1.5h.5a.75.75 0 0 0 0-1.5h-.5Z" /></svg>,
  sync: <svg viewBox="0 0 16 16"><path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z" /></svg>,
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
          <h1 className="landing-title">
            <span className="text-success">1</span> Day <span className="text-success">1</span> Commit
          </h1>
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
              {!showOutput && <span className="terminal-cursor"></span>}
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
            {Icons.github}
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

  const openGitHubProfile = () => {
    window.open(`https://github.com/${user.username}`, '_blank')
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            {Icons.flame}
            <span><span className="text-success">1</span>D<span className="text-success">1</span>C</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            {Icons.home}
            <span>Dashboard</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'repos' ? 'active' : ''}`}
            onClick={() => setActiveTab('repos')}
          >
            {Icons.repo}
            <span>Repositories</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            {Icons.gear}
            <span>Settings</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item user-item" onClick={openGitHubProfile}>
            <img src={user.avatar} alt="" className="user-avatar" />
            <span>{user.username}</span>
            {Icons.link}
          </button>
          <button className="nav-item" onClick={logout}>
            {Icons.signOut}
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <header className="page-header">
          <h1 className="page-title">
            {activeTab === 'home' && 'Dashboard'}
            {activeTab === 'repos' && 'Repositories'}
            {activeTab === 'settings' && 'Settings'}
          </h1>
          <div className="header-stats">
            <div className={`header-badge ${todayData?.hasCommitted ? 'success' : 'pending'}`}>
              {todayData?.hasCommitted ? Icons.check : Icons.clock}
              <span>{todayData?.hasCommitted ? 'Committed today' : 'Pending'}</span>
            </div>
            <div className="header-badge streak">
              {Icons.flame}
              <span>{todayData?.currentStreak || 0} day streak</span>
            </div>
          </div>
        </header>

        <div className="page-content">
          {activeTab === 'home' && (
            <HomeTab
              today={todayData}
              suggestion={suggestionData?.suggestion}
              contributions={contributionsData?.contributions || []}
              onRefresh={refetchToday}
              userId={user.id}
            />
          )}
          {activeTab === 'repos' && <ReposTab userId={user.id} />}
          {activeTab === 'settings' && <SettingsTab userId={user.id} />}
        </div>
      </div>
    </div>
  )
}

// ============================================
// Home Tab
// ============================================
function HomeTab({ today, suggestion, contributions, onRefresh, userId }: {
  today: TodayStatus | null
  suggestion: Repo | undefined
  contributions: Contribution[]
  onRefresh: () => void
  userId: string
}) {
  const hasCommitted = today?.hasCommitted || false
  const streak = today?.currentStreak || 0
  const longestStreak = today?.longestStreak || 0

  return (
    <div className="dashboard-grid">
      <div className="dashboard-main">
        {/* Status Card */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              {Icons.flame}
              Today's Status
            </h2>
            <button className="btn-secondary btn-sm" onClick={onRefresh}>
              {Icons.sync}
              Refresh
            </button>
          </div>
          <div className="card-body">
            <div className={`status-banner ${hasCommitted ? 'success' : 'pending'}`}>
              <div className={`status-icon ${hasCommitted ? 'success' : 'pending'}`}>
                {hasCommitted ? Icons.check : Icons.clock}
              </div>
              <div className="status-text">
                <h3>{hasCommitted ? `${today?.commitCount || 0} commits` : 'Awaiting commit'}</h3>
                <p>{hasCommitted ? 'Streak secured for today' : 'Commit to maintain streak'}</p>
              </div>
            </div>

            <div className="streak-section">
              <div className="streak-main">
                <span className="streak-number">{streak}</span>
                <span className="streak-unit">days</span>
              </div>
              <p className="streak-record">Best: {longestStreak}</p>
            </div>
          </div>
        </div>

        {/* Suggestion Card */}
        {suggestion && !hasCommitted && (
          <SuggestionCard suggestion={suggestion} userId={userId} />
        )}

        {/* Contribution Graph */}
        <ContributionGraph contributions={contributions} />
      </div>

      <div className="dashboard-sidebar">
        {/* Quick Stats */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              {Icons.gitBranch}
              Quick Stats
            </h2>
          </div>
          <div className="card-body">
            <div className="stats-list">
              <div className="stat-row">
                <span className="stat-label">Current Streak</span>
                <span className="stat-value text-success">{streak} days</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Longest Streak</span>
                <span className="stat-value">{longestStreak} days</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">This Week</span>
                <span className="stat-value">{contributions.slice(-7).filter(c => c.count > 0).length} days</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Today's Commits</span>
                <span className="stat-value">{today?.commitCount || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Suggestion Card
// ============================================
function SuggestionCard({ suggestion, userId }: { suggestion: Repo; userId: string }) {
  const [showNoteModal, setShowNoteModal] = useState(false)
  const { data: noteData } = useApi<{ note: RepoNote | null }>(`/api/user/repo-notes/${encodeURIComponent(suggestion.full_name)}`, userId)

  return (
    <>
      <div className="card suggestion-card">
        <div className="suggestion-accent"></div>
        <div className="card-body">
          <div className="suggestion-header">
            <span className="suggestion-label">Suggested Repository</span>
            <button className="btn-icon" onClick={() => setShowNoteModal(true)} title="Add note">
              {Icons.note}
            </button>
          </div>
          <h3 className="suggestion-repo">
            <a href={suggestion.html_url} target="_blank" rel="noopener noreferrer">
              {suggestion.full_name}
            </a>
          </h3>
          <div className="suggestion-meta">
            <span>{Icons.clock} {suggestion.daysSinceLastPush} days ago</span>
            {suggestion.language && <span>· {suggestion.language}</span>}
          </div>
          {noteData?.note?.note && (
            <p className="suggestion-note">{noteData.note.note}</p>
          )}
          <a
            href={suggestion.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            {Icons.link}
            Open Repository
          </a>
        </div>
      </div>

      {showNoteModal && (
        <RepoNoteModal
          repoFullName={suggestion.full_name}
          userId={userId}
          currentNote={noteData?.note || null}
          onClose={() => setShowNoteModal(false)}
        />
      )}
    </>
  )
}

// ============================================
// Repo Note Modal
// ============================================
function RepoNoteModal({ repoFullName, userId, currentNote, onClose }: {
  repoFullName: string
  userId: string
  currentNote: RepoNote | null
  onClose: () => void
}) {
  const [note, setNote] = useState(currentNote?.note || '')
  const [difficulty, setDifficulty] = useState(currentNote?.difficulty || 3)
  const [priority, setPriority] = useState(currentNote?.priority || 3)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await fetch(`${API_URL}/api/user/repo-notes/${encodeURIComponent(repoFullName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
      body: JSON.stringify({ note, difficulty, priority })
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Repository Note</h3>
          <button className="btn-icon" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p className="modal-repo">{repoFullName}</p>

          <div className="form-group">
            <label>Notes / Ideas</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="What are you planning to work on?"
              rows={4}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Difficulty (1-5)</label>
              <div className="rating-input">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    className={`rating-btn ${difficulty === n ? 'active' : ''}`}
                    onClick={() => setDifficulty(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <span className="form-hint">1 = Easy, 5 = Hard</span>
            </div>

            <div className="form-group">
              <label>Priority (1-5)</label>
              <div className="rating-input">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    className={`rating-btn ${priority === n ? 'active' : ''}`}
                    onClick={() => setPriority(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <span className="form-hint">1 = Low, 5 = High</span>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ContributionGraph({ contributions }: { contributions: Contribution[] }) {
  if (!contributions || contributions.length === 0) {
    return (
      <div className="card contribution-card">
        <div className="card-body empty-graph">
          Please refresh to load contribution data.
        </div>
      </div>
    )
  }

  // 1. Determine date range from ACTUAL data
  // Sort just in case
  const sorted = [...contributions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const firstDate = new Date(sorted[0].date)
  const lastDate = new Date() // End at today

  // 2. Align start date to the previous Sunday
  const startDate = new Date(firstDate)
  while (startDate.getDay() !== 0) {
    startDate.setDate(startDate.getDate() - 1)
  }

  // 3. Generate the full grid (52/53 weeks)
  const grid: { date: string; count: number; month: number }[][] = []
  const currentDate = new Date(startDate)
  const monthLabels: { month: string; weekIndex: number }[] = []
  let lastMonth = -1
  let weekIndex = 0

  // Generate until we pass today
  while (currentDate <= lastDate || currentDate.getDay() !== 0) {
    const week: { date: string; count: number; month: number }[] = []

    // Check for month label at start of week
    const month = currentDate.getMonth()
    if (month !== lastMonth) {
      // Only add label if it's the first week of the month mostly
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      if (d.getMonth() === month) { // simplistic check
        monthLabels.push({
          month: currentDate.toLocaleDateString('en-US', { month: 'short' }),
          weekIndex
        })
        lastMonth = month
      }
    }

    for (let d = 0; d < 7; d++) {
      const dateStr = currentDate.toISOString().split('T')[0]
      // Use efficient lookup or find
      // (Since array is size 365, .find is fast enough, but map is better if strict)
      const count = contributions.find(c => c.date === dateStr)?.count || 0

      week.push({ date: dateStr, count, month: currentDate.getMonth() })
      currentDate.setDate(currentDate.getDate() + 1)
    }
    grid.push(week)
    weekIndex++

    // Safety break
    if (weekIndex > 54) break;
  }

  const getLevel = (count: number) => {
    if (count === 0) return 'l0'
    if (count <= 3) return 'l1'
    if (count <= 6) return 'l2'
    if (count <= 9) return 'l3'
    return 'l4'
  }

  const totalContributions = contributions.reduce((sum, c) => sum + c.count, 0)
  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', '']

  // Format date for title: "6 contributions on December 14th."
  const formatTitle = (count: number, dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00') // Avoid timezone shift
    const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' }
    const dateText = date.toLocaleDateString('en-US', options)
    // Add ordinal suffix logic if needed, simplifed for now
    return `${count} contribution${count === 1 ? '' : 's'} on ${dateText}`
  }

  return (
    <div className="card contribution-card">
      <div className="card-header">
        <h2 className="card-title">{totalContributions} contributions in the last year</h2>
      </div>
      <div className="card-body">
        <div className="contribution-wrapper">
          {/* Day labels on left */}
          <div className="contribution-day-labels">
            {dayLabels.map((label, i) => (
              <span key={i} className="day-label">{label}</span>
            ))}
          </div>

          <div className="contribution-main">
            {/* Month labels on top */}
            <div className="contribution-month-labels">
              {monthLabels.map((m, i) => (
                <span
                  key={i}
                  className="month-label"
                  style={{ gridColumnStart: m.weekIndex + 1 }}
                >
                  {m.month}
                </span>
              ))}
            </div>

            {/* Contribution grid */}
            <div className="contribution-grid">
              {grid.map((week, wi) => (
                <div key={wi} className="contribution-week">
                  {week.map((day, di) => (
                    <div
                      key={di}
                      className={`contribution-day ${getLevel(day.count)}`}
                      title={formatTitle(day.count, day.date)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="contribution-footer">
          <a href="#" className="contribution-link">Learn how we count contributions</a>
          <div className="contribution-legend">
            <span>Less</span>
            <div className="legend-colors">
              <span className="l0"></span>
              <span className="l1"></span>
              <span className="l2"></span>
              <span className="l3"></span>
              <span className="l4"></span>
            </div>
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Repos Tab
// ============================================
function ReposTab({ userId }: { userId: string }) {
  const { data, loading, refetch } = useApi<{ repos: Repo[] }>('/api/github/repos', userId)
  const { data: notesData, refetch: refetchNotes } = useApi<{ notes: RepoNote[] }>('/api/user/repo-notes', userId)
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null)

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
  const notesMap = new Map((notesData?.notes || []).map(n => [n.repo_full_name, n]))

  return (
    <>
      <div className="repos-container">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">{repos.length} repositories</h2>
          </div>
          <div className="repo-list">
            {loading ? (
              <div className="loading-state">Loading repositories...</div>
            ) : repos.length === 0 ? (
              <div className="empty-state">No repositories found</div>
            ) : (
              repos.map(repo => {
                const note = notesMap.get(repo.full_name)
                return (
                  <div key={repo.id} className="repo-item">
                    <div className="repo-info">
                      <div className="repo-name-row">
                        <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="repo-name">
                          {repo.full_name}
                        </a>
                        {repo.excluded && <span className="badge badge-muted">Excluded</span>}
                        {note && <span className="badge badge-accent">Has notes</span>}
                      </div>
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
                      <button
                        className="btn-icon"
                        onClick={() => setSelectedRepo(repo.full_name)}
                        title="Edit note"
                      >
                        {Icons.note}
                      </button>
                      <button
                        className={`btn-sm ${repo.excluded ? 'btn-success' : 'btn-secondary'}`}
                        onClick={() => toggleExclude(repo.full_name, repo.excluded)}
                      >
                        {repo.excluded ? 'Include' : 'Exclude'}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {selectedRepo && (
        <RepoNoteModal
          repoFullName={selectedRepo}
          userId={userId}
          currentNote={notesMap.get(selectedRepo) || null}
          onClose={() => {
            setSelectedRepo(null)
            refetchNotes()
          }}
        />
      )}
    </>
  )
}

// ============================================
// Settings Tab
// ============================================
function SettingsTab({ userId }: { userId: string }) {
  const { data, refetch } = useApi<{ preferences: any; reminders: Reminder[] }>('/api/user/preferences', userId)
  const [newReminderTime, setNewReminderTime] = useState('')
  const [pushSupported] = useState('Notification' in window)

  const updatePreference = async (key: string, value: any) => {
    await fetch(`${API_URL}/api/user/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
      body: JSON.stringify({ [key]: value })
    })
    refetch()
  }

  const addReminder = async () => {
    if (!newReminderTime) return
    await fetch(`${API_URL}/api/user/reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
      body: JSON.stringify({ time: newReminderTime })
    })
    setNewReminderTime('')
    refetch()
  }

  const deleteReminder = async (id: string) => {
    await fetch(`${API_URL}/api/user/reminders/${id}`, {
      method: 'DELETE',
      headers: { 'X-User-Id': userId }
    })
    refetch()
  }

  const toggleReminder = async (id: string, enabled: boolean) => {
    const reminder = (data?.reminders || []).find(r => r.id === id)
    if (!reminder) return
    await fetch(`${API_URL}/api/user/reminders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
      body: JSON.stringify({ time: reminder.time, enabled: enabled ? 1 : 0 })
    })
    refetch()
  }

  const requestPushPermission = async () => {
    if (!pushSupported) return

    try {
      // Request permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return

      // Get VAPID public key from server
      const vapidRes = await fetch(`${API_URL}/api/push/vapid-public-key`)
      const { publicKey, enabled } = await vapidRes.json()

      if (!enabled || !publicKey) {
        alert('Push notifications are not configured on the server. Please contact support.')
        return
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      })

      // Send subscription to server
      const subJson = subscription.toJSON()
      await fetch(`${API_URL}/api/user/push-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys
        })
      })

      updatePreference('push_enabled', 1)
      alert('Push notifications enabled successfully!')
    } catch (error) {
      console.error('Failed to enable push notifications:', error)
      alert('Failed to enable push notifications. Please try again or check your browser settings.')
    }
  }

  // Helper to convert base64 to Uint8Array for VAPID key
  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  const prefs = data?.preferences || {}
  const reminders = data?.reminders || []

  return (
    <div className="settings-container">
      {/* Notifications */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            {Icons.bell}
            Notifications
          </h2>
        </div>
        <div className="card-body">
          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Email Reminders</span>
              <span className="setting-desc">Receive email notifications when you haven't committed</span>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={prefs.email_enabled ?? true}
                onChange={e => updatePreference('email_enabled', e.target.checked ? 1 : 0)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Push Notifications</span>
              <span className="setting-desc">
                {pushSupported
                  ? 'Receive browser push notifications'
                  : 'Not supported in this browser'}
              </span>
            </div>
            {pushSupported ? (
              prefs.push_enabled ? (
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={true}
                    onChange={() => updatePreference('push_enabled', 0)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              ) : (
                <button className="btn-secondary btn-sm" onClick={requestPushPermission}>
                  Enable
                </button>
              )
            ) : (
              <span className="badge badge-muted">Unavailable</span>
            )}
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Skip Weekends</span>
              <span className="setting-desc">Don't send reminders on Saturday and Sunday</span>
            </div>
            <label className="toggle">
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

      {/* Reminder Times */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            {Icons.clock}
            Reminder Times
          </h2>
        </div>
        <div className="card-body">
          <p className="card-desc">Set when you want to receive your daily reminders. Add as many as you need.</p>

          <div className="reminders-list">
            {reminders.length === 0 ? (
              <p className="empty-state">No reminders configured</p>
            ) : (
              reminders.map(reminder => (
                <div key={reminder.id} className="reminder-item">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={!!reminder.enabled}
                      onChange={e => toggleReminder(reminder.id, e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <span className="reminder-time">{reminder.time}</span>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => deleteReminder(reminder.id)}
                    title="Delete reminder"
                  >
                    {Icons.trash}
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="add-reminder">
            <input
              type="time"
              value={newReminderTime}
              onChange={e => setNewReminderTime(e.target.value)}
              className="time-input"
            />
            <button className="btn-primary btn-sm" onClick={addReminder} disabled={!newReminderTime}>
              {Icons.plus}
              Add Reminder
            </button>
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
