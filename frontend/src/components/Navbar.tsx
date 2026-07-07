import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, LogOut, Github, Shield, Calendar, AlertTriangle } from 'lucide-react';
import type { User } from '../types';
import { API_BASE_URL } from '../config';

interface NavbarProps {
  user: User | null;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onLogout: () => void;
  onOpenAuthModal: (mode: 'login' | 'register') => void;
  token: string | null;
  onGithubRefresh: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  theme,
  toggleTheme,
  onLogout,
  onOpenAuthModal,
  token,
  onGithubRefresh,
}) => {
  const [profileOpen, setProfileOpen] = useState(false);
  const [githubOpen, setGithubOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  
  const profileRef = useRef<HTMLDivElement>(null);
  const githubRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdowns on outside clicks
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
      if (githubRef.current && !githubRef.current.contains(event.target as Node)) {
        setGithubOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGithubConnect = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/auth/github/login`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch github redirect url');
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      alert('Error initiating GitHub connection: ' + err);
    }
  };

  const handleGithubDisconnect = async () => {
    if (!token) return;
    setDisconnecting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/github/disconnect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to unlink account');
      setGithubOpen(false);
      onGithubRefresh();
    } catch (err) {
      alert('Error unlinking GitHub account: ' + err);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <nav className="navbar">
      <div className="nav-brand" onClick={() => navigate(user ? '/dashboard' : '/')}>
        <div className="nav-logo-icon">
          <img src="/favicon.png" alt="MendCode Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <span className="nav-title">MendCode</span>
      </div>

      <div className="nav-actions">
        {/* Theme Toggle directly on header */}
        <button 
          onClick={toggleTheme} 
          className="theme-toggle-btn" 
          aria-label="Toggle theme"
          type="button"
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {user ? (
          <>
            {/* GitHub Oauth popover button */}
            <div className="nav-menu-container" ref={githubRef}>
              {user.github_token ? (
                <button 
                  onClick={() => setGithubOpen(!githubOpen)} 
                  className="btn github-connected-badge"
                  style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                  type="button"
                >
                  <Github size={16} /> GitHub Linked
                </button>
              ) : (
                <button 
                  onClick={handleGithubConnect} 
                  className="btn btn-secondary"
                  style={{ padding: '8px 14px', fontSize: '0.85rem', borderColor: 'var(--warning-border)', color: 'var(--warning)' }}
                  type="button"
                >
                  <AlertTriangle size={15} /> Link GitHub
                </button>
              )}

              {/* GitHub Popover */}
              {githubOpen && user.github_token && (
                <div className="glass-panel dropdown-menu github-popover">
                  <div className="github-popover-title">
                    <Github size={16} /> GitHub Integration
                  </div>
                  <p className="dropdown-item-info">
                    Your account is currently linked. The agent has API authorization to query issues, clone repos, and submit PRs.
                  </p>
                  <button 
                    onClick={handleGithubDisconnect} 
                    className="btn btn-danger" 
                    style={{ width: '100%', fontSize: '0.85rem', padding: '8px 12px' }}
                    disabled={disconnecting}
                  >
                    {disconnecting ? 'Unlinking...' : 'Disconnect Account'}
                  </button>
                </div>
              )}
            </div>

            {/* Profile Dropdown Tab */}
            <div className="nav-menu-container" ref={profileRef}>
              <button 
                onClick={() => setProfileOpen(!profileOpen)} 
                className="avatar-btn"
                aria-label="User profile menu"
                type="button"
              >
                {user.username[0].toUpperCase()}
              </button>

              {/* Profile Dropdown Card */}
              {profileOpen && (
                <div className="glass-panel dropdown-menu">
                  <div className="dropdown-header">
                    <div className="dropdown-username">{user.username}</div>
                    <div className="dropdown-role">{user.role} Account</div>
                  </div>
                  
                  <div className="dropdown-item-info" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={14} /> <span>Status: Active</span>
                  </div>

                  <div className="dropdown-item-info" style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--input-border)', paddingBottom: '12px', marginBottom: '12px' }}>
                    <Calendar size={14} /> <span>Joined: {new Date(user.created_at).toLocaleDateString()}</span>
                  </div>

                  <button 
                    onClick={() => {
                      setProfileOpen(false);
                      onLogout();
                    }} 
                    className="btn btn-secondary" 
                    style={{ width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Signed out links */}
            <button 
              onClick={() => onOpenAuthModal('login')} 
              className="btn btn-secondary"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              Sign In
            </button>
            <button 
              onClick={() => onOpenAuthModal('register')} 
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              Sign Up
            </button>
          </>
        )}
      </div>
    </nav>
  );
};
