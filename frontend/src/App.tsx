import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { Dashboard } from './components/Dashboard';
import { JobDetail } from './components/JobDetail';
import { Footer } from './components/Footer';
import { TermsPage } from './components/TermsPage';
import { PrivacyPage } from './components/PrivacyPage';
import { SecurityPage } from './components/SecurityPage';
import { HowItWorksPage } from './components/HowItWorksPage';
import { ProfilePage } from './components/ProfilePage';
import type { User, Job } from './types';
import { API_BASE_URL } from './config';
import { AlertCircle, CheckCircle } from 'lucide-react';
import './App.css';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  
  // Auth Modal State
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  const navigate = useNavigate();
  const location = useLocation();
  const pollTimerRef = useRef<any>(null);

  // Theme Sync
  useEffect(() => {
    localStorage.setItem('theme', theme);
    const root = document.documentElement;
    const body = document.body;
    if (theme === 'dark') {
      root.classList.add('theme-dark');
      root.classList.remove('theme-light');
      body.classList.add('theme-dark');
      body.classList.remove('theme-light');
    } else {
      root.classList.add('theme-light');
      root.classList.remove('theme-dark');
      body.classList.add('theme-light');
      body.classList.remove('theme-dark');
    }
  }, [theme]);

  // Fetch current user details
  const fetchUser = async (authToken: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (response.ok) {
        const userData: User = await response.json();
        setUser(userData);
      } else {
        handleLogout();
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  // Fetch user jobs list
  const fetchJobs = async () => {
    if (!token) return;
    setLoadingJobs(true);
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const jobsData: Job[] = await response.json();
        jobsData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setJobs(jobsData);
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUser(token);
      fetchJobs();
    } else {
      setUser(null);
      setJobs([]);
    }
  }, [token]);

  // Polling active jobs
  useEffect(() => {
    const hasActiveJobs = jobs.some(j => j.status === 'RUNNING' || j.status === 'PENDING');
    
    if (token && hasActiveJobs) {
      if (!pollTimerRef.current) {
        pollTimerRef.current = setInterval(() => {
          fetchJobs();
        }, 3000);
      }
    } else {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [jobs, token]);

  const handleLoginSuccess = (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setJobs([]);
    navigate('/');
  };

  const handleCreateJob = async (payload: {
    repo_owner: string;
    repo_name: string;
    issue_number: number;
    llm_provider: string;
  }): Promise<Job> => {
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_BASE_URL}/jobs/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.detail || 'Failed to launch job');
    }

    const newJob: Job = await response.json();
    fetchJobs();
    return newJob;
  };

  // Route guard for protected pages
  const RequireAuth = ({ children }: { children: React.ReactNode }) => {
    const [shouldRedirect, setShouldRedirect] = useState(false);
    
    useEffect(() => {
      if (!token) {
        setAuthModalOpen(true);
        setAuthModalMode('login');
        setShouldRedirect(true);
      }
    }, [token]);

    if (shouldRedirect) {
      return <Navigate to="/" replace />;
    }
    return <>{children}</>;
  };

  // GitHub OAuth Callback handling
  const GithubCallback = () => {
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [errMsg, setErrMsg] = useState('');
    const hasRun = useRef(false);

    useEffect(() => {
      if (hasRun.current) return;
      hasRun.current = true;

      const code = new URLSearchParams(window.location.search).get('code');
      if (!code) {
        setStatus('error');
        setErrMsg('No authorization code provided from GitHub');
        return;
      }

      const exchangeCode = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/auth/github/callback?code=${code}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'OAuth exchange failed');
          }

          setStatus('success');
          if (token) fetchUser(token);
          
          setTimeout(() => {
            navigate('/dashboard');
          }, 1500);
        } catch (err: any) {
          setStatus('error');
          setErrMsg(err.message || 'Failed connecting GitHub account.');
        }
      };

      exchangeCode();
    }, []);

    return (
      <div className="auth-wrapper">
        <div className="glass-panel auth-card" style={{ padding: '40px' }}>
          {status === 'loading' && (
            <div>
              <h3>Connecting GitHub Account...</h3>
              <p className="auth-subtitle">Exchanging OAuth token handshake</p>
              <div style={{ marginTop: '24px' }}>
                <span className="badge badge-running">Processing</span>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div>
              <div className="alert alert-success" style={{ justifyContent: 'center' }}>
                <CheckCircle size={20} />
                <span>GitHub profile linked successfully!</span>
              </div>
              <p className="auth-subtitle">Redirecting to Dashboard...</p>
            </div>
          )}

          {status === 'error' && (
            <div>
              <div className="alert alert-danger" style={{ justifyContent: 'center' }}>
                <AlertCircle size={20} />
                <span>Error: {errMsg}</span>
              </div>
              <button onClick={() => navigate('/dashboard')} className="btn btn-secondary" style={{ width: '100%', marginTop: '16px' }}>
                Return to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Job Details wrapper
  const JobDetailWrapper = () => {
    const jobId = location.pathname.split('/').pop() || '';
    const job = jobs.find(j => j.id === jobId);

    if (!job) {
      return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <h3>Job Not Found</h3>
          <button onClick={() => navigate('/dashboard')} className="btn btn-secondary" style={{ marginTop: '16px' }}>
            Return to Dashboard
          </button>
        </div>
      );
    }

    return (
      <JobDetail 
        job={job} 
        token={token || ''} 
        onBack={() => navigate('/dashboard')} 
        onRefresh={fetchJobs} 
      />
    );
  };

  const handleOpenAuthModal = (mode: 'login' | 'register') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <div className="app-container">

      <Navbar 
        user={user} 
        theme={theme} 
        toggleTheme={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')} 
        onLogout={handleLogout} 
        onOpenAuthModal={handleOpenAuthModal}
        token={token}
        onGithubRefresh={() => token && fetchUser(token)}
      />

      <main className="main-content">
        <Routes>
          <Route 
            path="/" 
            element={<LandingPage onGetStartedClick={() => handleOpenAuthModal('register')} isLoggedIn={!!token} />} 
          />
          
          <Route 
            path="/dashboard" 
            element={
              <RequireAuth>
                <Dashboard 
                  user={user} 
                  jobs={jobs} 
                  loading={loadingJobs} 
                  token={token || ''}
                  onRefresh={fetchJobs} 
                  onSubmitJob={handleCreateJob} 
                  onJobClick={(id) => navigate(`/job/${id}`)}
                />
              </RequireAuth>
            } 
          />

          <Route 
            path="/job/:jobId" 
            element={
              <RequireAuth>
                <JobDetailWrapper />
              </RequireAuth>
            } 
          />

          <Route 
            path="/github/callback" 
            element={
              <RequireAuth>
                <GithubCallback />
              </RequireAuth>
            } 
          />

          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route 
            path="/profile" 
            element={
              <RequireAuth>
                {user ? (
                  <ProfilePage 
                    user={user} 
                    token={token || ''} 
                    onRefresh={() => token && fetchUser(token)} 
                  />
                ) : <div />}
              </RequireAuth>
            } 
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Footer />

      {/* Global Auth Modal Popup */}
      <AuthModal 
        isOpen={authModalOpen} 
        initialMode={authModalMode} 
        onClose={() => setAuthModalOpen(false)} 
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}

export default App;
