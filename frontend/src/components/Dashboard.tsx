import React, { useState, useEffect } from 'react';
import { Github, Play, RefreshCw, Terminal, CheckCircle2, AlertTriangle, Layers, GitPullRequest, AlertCircle } from 'lucide-react';
import type { User, Job } from '../types';
import { API_BASE_URL } from '../config';

interface DashboardProps {
  user: User | null;
  jobs: Job[];
  loading: boolean;
  token: string;
  onRefresh: () => void;
  onSubmitJob: (payload: {
    repo_owner: string;
    repo_name: string;
    issue_number: number;
    llm_provider: string;
  }) => Promise<Job>;
  onJobClick: (jobId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  jobs,
  loading,
  token,
  onRefresh,
  onSubmitJob,
  onJobClick,
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'solve' | 'profile'>('history');
  
  // Solve New Issue Form State
  const [issueUrl, setIssueUrl] = useState('');
  const [repoOwner, setRepoOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [issueNumber, setIssueNumber] = useState<number | ''>('');
  const [llmProvider, setLlmProvider] = useState('groq');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Profile Username Edit State
  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameUpdateError, setUsernameUpdateError] = useState<string | null>(null);
  const [usernameUpdateSuccess, setUsernameUpdateSuccess] = useState<string | null>(null);

  useEffect(() => {
    setNewUsername(user?.username || '');
  }, [user]);

  // Debounced username availability check
  useEffect(() => {
    if (!newUsername || newUsername.trim() === '' || newUsername === user?.username) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/check-username?username=${encodeURIComponent(newUsername.trim())}`);
        if (response.ok) {
          const data = await response.json();
          setUsernameAvailable(data.available);
        }
      } catch (err) {
        console.error('Error checking username', err);
      } finally {
        setCheckingUsername(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [newUsername, user?.username]);

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameUpdateError(null);
    setUsernameUpdateSuccess(null);

    if (!newUsername || newUsername.trim() === '') {
      setUsernameUpdateError('Username cannot be empty');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/username`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: newUsername.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to update username');
      }

      setUsernameUpdateSuccess('Username updated successfully!');
      onRefresh();
    } catch (err: any) {
      setUsernameUpdateError(err.message || 'Error updating username');
    }
  };

  const handleUrlChange = (val: string) => {
    setIssueUrl(val);
    if (!val) return;
    try {
      const match = val.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/i);
      if (match) {
        setRepoOwner(match[1]);
        setRepoName(match[2]);
        setIssueNumber(parseInt(match[3], 10));
      }
    } catch (e) {
      // ignore
    }
  };

  const handleGithubConnect = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/github/login`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to get GitHub redirect URL');
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      alert('Error initiating GitHub connection: ' + err);
    }
  };

  const handleSolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!repoOwner || !repoName || !issueNumber) {
      setSubmitError('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const createdJob = await onSubmitJob({
        repo_owner: repoOwner.trim(),
        repo_name: repoName.trim(),
        issue_number: Number(issueNumber),
        llm_provider: llmProvider,
      });
      // Redirect directly to the newly launched job page
      onJobClick(createdJob.id);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to trigger job');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: Job['status']) => {
    switch (status) {
      case 'PENDING':
        return <span className="badge badge-pending">Pending</span>;
      case 'RUNNING':
        return <span className="badge badge-running">Running</span>;
      case 'AWAITING_APPROVAL':
        return <span className="badge badge-approval">Awaiting Approval</span>;
      case 'COMPLETED':
        return <span className="badge badge-completed">Completed</span>;
      case 'FAILED':
        return <span className="badge badge-failed">Failed</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  // Stats calculation
  const totalRuns = jobs.length;
  const activeJobs = jobs.filter(j => j.status === 'RUNNING' || j.status === 'PENDING').length;
  const awaitingApproval = jobs.filter(j => j.status === 'AWAITING_APPROVAL').length;
  const completedJobs = jobs.filter(j => j.status === 'COMPLETED').length;

  return (
    <div className="dashboard-wrapper" style={{ textAlign: 'left' }}>
      
      {/* Tab Selectors */}
      <div className="dashboard-tabs-container">
        <button 
          onClick={() => setActiveTab('history')} 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
        >
          Execution History
        </button>
        <button 
          onClick={() => setActiveTab('solve')} 
          className={`tab-btn ${activeTab === 'solve' ? 'active' : ''}`}
        >
          Solve New Issue
        </button>
        <button 
          onClick={() => setActiveTab('profile')} 
          className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
        >
          My Profile
        </button>
      </div>

      {/* TAB CONTENT: HISTORY */}
      {activeTab === 'history' && (
        <div>
          {/* Stats Summary Cards */}
          <div className="stats-grid">
            <div className="glass-panel stat-card">
              <div className="stat-icon">
                <Layers size={20} />
              </div>
              <div className="stat-info">
                <div className="stat-value">{totalRuns}</div>
                <div className="stat-label">Total Jobs</div>
              </div>
            </div>

            <div className="glass-panel stat-card">
              <div className="stat-icon secondary">
                <RefreshCw size={20} />
              </div>
              <div className="stat-info">
                <div className="stat-value">{activeJobs}</div>
                <div className="stat-label">Active Runs</div>
              </div>
            </div>

            <div className="glass-panel stat-card" style={{ borderLeft: '3px solid var(--warning)' }}>
              <div className="stat-icon" style={{ background: 'var(--warning-glow)', color: 'var(--warning)' }}>
                <AlertTriangle size={20} />
              </div>
              <div className="stat-info">
                <div className="stat-value">{awaitingApproval}</div>
                <div className="stat-label">Needs Approval</div>
              </div>
            </div>

            <div className="glass-panel stat-card" style={{ borderLeft: '3px solid var(--success)' }}>
              <div className="stat-icon" style={{ background: 'var(--success-glow)', color: 'var(--success)' }}>
                <CheckCircle2 size={20} />
              </div>
              <div className="stat-info">
                <div className="stat-value">{completedJobs}</div>
                <div className="stat-label">Completed PRs</div>
              </div>
            </div>
          </div>

          {/* History Panel */}
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Previous Runs</h3>
              <button onClick={onRefresh} className="btn btn-secondary" style={{ padding: '8px 12px' }} title="Refresh lists">
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            {jobs.length === 0 ? (
              <div className="empty-state">
                <Terminal className="empty-icon" />
                <p className="empty-text">No runs found. Navigate to "Solve New Issue" to start your first AI compilation.</p>
              </div>
            ) : (
              <div className="jobs-grid">
                {jobs.map((job) => (
                  <div key={job.id} className="job-row" onClick={() => onJobClick(job.id)}>
                    <div className="job-info">
                      <div className="job-repo">
                        {job.repo_owner}/{job.repo_name} #{job.issue_number}
                      </div>
                      {job.issue_title && <div className="job-title-line">{job.issue_title}</div>}
                      <div className="job-meta">
                        <span>LLM: {job.llm_provider.toUpperCase()}</span>
                        <span>Date: {new Date(job.created_at).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="job-status-area">
                      {job.pr_url && (
                        <a 
                          href={job.pr_url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          onClick={(e) => e.stopPropagation()} 
                          style={{ color: 'var(--accent-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem' }}
                        >
                          <GitPullRequest size={14} /> PR Link
                        </a>
                      )}
                      {getStatusBadge(job.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: SOLVE NEW ISSUE */}
      {activeTab === 'solve' && (
        <div className="glass-panel" style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Launch AI Agent</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
            Provide repository locations and a target issue number. The agent will run checkout and surgical modifications.
          </p>

          {/* GitHub Connection warning */}
          {user && !user.github_token ? (
            <div className="alert alert-danger" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '1rem', marginBottom: '6px' }}>
                <AlertTriangle size={20} /> GitHub Account Required
              </div>
              <p style={{ fontSize: '0.9rem', marginBottom: '16px', lineHeight: '1.5' }}>
                You must link your GitHub profile before initiating an automated run. This allows the compiler to checkout files and submit branches.
              </p>
              <button onClick={handleGithubConnect} className="btn btn-primary">
                <Github size={16} /> Link GitHub Now
              </button>
            </div>
          ) : (
            <form onSubmit={handleSolveSubmit}>
              {submitError && (
                <div className="alert alert-danger">
                  <AlertCircle size={16} />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                <label className="form-label" htmlFor="solve-issue-url">
                  Paste GitHub Issue URL (Autofill)
                </label>
                <input
                  id="solve-issue-url"
                  type="text"
                  className="form-input"
                  placeholder="https://github.com/owner/repo/issues/123"
                  value={issueUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="solve-repo-owner">
                  Repository Owner *
                </label>
                <input
                  id="solve-repo-owner"
                  type="text"
                  className="form-input"
                  placeholder="Enter repository owner"
                  value={repoOwner}
                  onChange={(e) => setRepoOwner(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="solve-repo-name">
                  Repository Name *
                </label>
                <input
                  id="solve-repo-name"
                  type="text"
                  className="form-input"
                  placeholder="Enter repository name"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="solve-issue-number">
                  GitHub Issue Number *
                </label>
                <input
                  id="solve-issue-number"
                  type="number"
                  min="1"
                  className="form-input"
                  placeholder="Enter issue number"
                  value={issueNumber}
                  onChange={(e) => setIssueNumber(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="solve-llm-provider">
                  LLM Orchestration Provider
                </label>
                <select
                  id="solve-llm-provider"
                  className="form-select"
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value)}
                  disabled={submitting}
                >
                  <option value="groq">Groq (Llama 3.3 70B)</option>
                </select>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '16px', padding: '12px' }}
                disabled={submitting}
              >
                <Play size={16} />
                {submitting ? 'Initiating Agent Run...' : 'Execute AI Agent'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* TAB CONTENT: MY PROFILE */}
      {activeTab === 'profile' && (
        <div className="glass-panel" style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>My Profile</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
            Manage your credentials, branding name, and GitHub authentication connections.
          </p>

          {/* User metadata */}
          <div style={{ padding: '16px', background: 'var(--border)', borderRadius: 'var(--radius)', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Email Address</span>
              <span style={{ fontWeight: 700 }}>{user?.email || 'N/A (Google Sign-In)'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Current Username</span>
              <span style={{ fontWeight: 700 }}>{user?.username}</span>
            </div>
          </div>

          {/* Username edit form with live check */}
          <form onSubmit={handleUpdateUsername} style={{ marginBottom: '32px', borderBottom: '1px solid var(--border)', paddingBottom: '24px' }}>
            <h4 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Change Username</h4>
            
            {usernameUpdateError && (
              <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                <AlertCircle size={16} />
                <span>{usernameUpdateError}</span>
              </div>
            )}

            {usernameUpdateSuccess && (
              <div className="alert alert-success" style={{ marginBottom: '16px' }}>
                <CheckCircle2 size={16} />
                <span>{usernameUpdateSuccess}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="profile-username">
                New Username
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="profile-username"
                  type="text"
                  className="form-input"
                  style={{ width: '100%' }}
                  placeholder="Enter new username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Live username availability indicator */}
              <div style={{ marginTop: '8px', minHeight: '20px', fontSize: '0.85rem' }}>
                {checkingUsername && (
                  <span style={{ color: 'var(--text-secondary)' }}>Checking availability...</span>
                )}
                {!checkingUsername && usernameAvailable === true && (
                  <span style={{ color: '#22c55e', fontWeight: 600 }}>✓ Username is available</span>
                )}
                {!checkingUsername && usernameAvailable === false && (
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>✗ Username is already taken</span>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '8px 16px' }}
              disabled={loading || usernameAvailable === false || newUsername.trim() === '' || newUsername === user?.username}
            >
              Save Username
            </button>
          </form>

          {/* GitHub Connection Status */}
          <div>
            <h4 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>GitHub Integration</h4>
            {user && !user.github_token ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Disconnect / Link GitHub profile</span>
                <button onClick={handleGithubConnect} className="btn btn-primary">
                  <Github size={16} /> Link GitHub Profile
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ color: '#22c55e', fontWeight: 600, display: 'block', fontSize: '0.95rem' }}>Connected</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>MendCode is authorized to open Pull Requests on your behalf.</span>
                </div>
                <button 
                  type="button"
                  onClick={async () => {
                    if (confirm("Disconnect GitHub account?")) {
                      try {
                        const response = await fetch(`${API_BASE_URL}/auth/github/disconnect`, {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${token}` }
                        });
                        if (response.ok) {
                          onRefresh();
                        }
                      } catch (err) {
                        alert(err);
                      }
                    }
                  }} 
                  className="btn" 
                  style={{ background: 'var(--border)', borderColor: 'var(--border)', color: '#ef4444' }}
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
