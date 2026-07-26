import React, { useState, useEffect } from 'react';
import { User as UserIcon, Shield, Calendar, Github, Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../types';
import { API_BASE_URL } from '../config';

interface ProfilePageProps {
  /** The current authenticated user session data. */
  user: User;
  /** JWT auth token for backend write operations. */
  token: string;
  /** Refresh callback to reload the user profile from database. */
  onRefresh: () => void;
}

/**
 * ProfilePage Component
 * 
 * Renders the user account profile view. Displays primary account attributes,
 * user role authorizations, registration date, and active integration connections
 * with third-party providers (such as GitHub OAuth).
 * Allows changing the username with real-time availability checks (400ms debounced).
 */
export const ProfilePage: React.FC<ProfilePageProps> = ({ user, token, onRefresh }) => {
  const navigate = useNavigate();

  // Username Edit State
  const [newUsername, setNewUsername] = useState(user.username || '');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameUpdateError, setUsernameUpdateError] = useState<string | null>(null);
  const [usernameUpdateSuccess, setUsernameUpdateSuccess] = useState<string | null>(null);

  useEffect(() => {
    setNewUsername(user.username || '');
  }, [user]);

  // Debounced username availability check
  useEffect(() => {
    if (!newUsername || newUsername.trim() === '' || newUsername === user.username) {
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
  }, [newUsername, user.username]);

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

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 20px', textAlign: 'left' }}>
      <button onClick={() => navigate(-1)} className="back-btn" style={{ marginBottom: '24px' }}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="glass-panel" style={{ textAlign: 'center', paddingTop: '40px', paddingBottom: '40px' }}>
        {/* Large Avatar */}
        <div style={{
          width: '90px',
          height: '90px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent), #f97316)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2.2rem',
          fontWeight: 800,
          color: 'white',
          margin: '0 auto 16px',
          boxShadow: '0 4px 24px rgba(253, 140, 115, 0.35)'
        }}>
          {user.username[0].toUpperCase()}
        </div>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '4px' }}>{user.username}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', wordBreak: 'break-all' }}>{user.email}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '24px' }}>
        {/* Role Card */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <UserIcon size={20} color="white" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Role</div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{user.role}</div>
          </div>
        </div>

        {/* Status Card */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Shield size={20} color="white" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Account Status</div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#22c55e' }}>Active</div>
          </div>
        </div>

        {/* Email Card (Fixed leaking layout) */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', minWidth: 0 }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Mail size={20} color="white" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', wordBreak: 'break-all' }}>{user.email}</div>
          </div>
        </div>

        {/* Joined Date Card */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Calendar size={20} color="white" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Joined</div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </div>
      </div>

      {/* Edit Profile Section */}
      <div className="glass-panel" style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', fontWeight: 700 }}>Customization Settings</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
          Update your developer alias brand name shown on generated PR summaries.
        </p>

        <form onSubmit={handleUpdateUsername}>
          {usernameUpdateError && (
            <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
              <AlertCircle size={16} />
              <span>{usernameUpdateError}</span>
            </div>
          )}

          {usernameUpdateSuccess && (
            <div className="alert alert-success" style={{ marginBottom: '16px' }}>
              <CheckCircle size={16} />
              <span>{usernameUpdateSuccess}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="profile-username">
              Developer Username / Display Name
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="profile-username"
                type="text"
                className="form-input"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Enter new display username"
                required
              />
              {checkingUsername && (
                <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Checking availability...
                </div>
              )}
            </div>
            
            {usernameAvailable === true && (
              <p style={{ color: '#22c55e', fontSize: '0.8rem', marginTop: '6px' }}>
                ✓ Username is available
              </p>
            )}
            {usernameAvailable === false && (
              <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '6px' }}>
                ✗ Username is already taken
              </p>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ marginTop: '16px' }}
            disabled={usernameAvailable === false || checkingUsername || newUsername === user.username}
          >
            Save Alias Settings
          </button>
        </form>
      </div>

      {/* GitHub Integration Section */}
      <div className="glass-panel" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Github size={20} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>GitHub Integration</h3>
          </div>
          {!user.github_token && (
            <button onClick={handleGithubConnect} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Github size={14} /> Link Account
            </button>
          )}
        </div>
        {user.github_token ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%',
              backgroundColor: '#22c55e', boxShadow: '0 0 8px rgba(34, 197, 94, 0.5)'
            }} />
            <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              GitHub account is linked. The agent can access your repositories, fetch issues, and create pull requests.
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%',
              backgroundColor: '#ef4444', boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)'
            }} />
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              GitHub account is not linked. Connect your GitHub to enable automated runs.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
