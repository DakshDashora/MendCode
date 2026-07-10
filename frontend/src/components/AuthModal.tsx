import React, { useState, useEffect } from 'react';
import { X, Lock, Mail, AlertCircle, CheckCircle, Smartphone } from 'lucide-react';
import { API_BASE_URL, GOOGLE_CLIENT_ID } from '../config';
import { type TokenResponse } from '../types';

declare global {
  interface Window {
    google?: any;
  }
}

interface AuthModalProps {
  isOpen: boolean;
  initialMode: 'login' | 'register';
  onClose: () => void;
  onLoginSuccess: (token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode,
  onClose,
  onLoginSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'otp_verify'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sync mode with props when modal opens or initialMode changes
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      setSuccess(null);
      setOtp('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    }
  }, [isOpen, initialMode]);

  // Initialize and Render Google Sign-In Button
  const initializeGoogle = () => {
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleLogin,
      });

      // Let React DOM render complete before attaching Google buttons
      setTimeout(() => {
        const btnContainer = document.getElementById('google-btn');
        if (btnContainer) {
          window.google.accounts.id.renderButton(btnContainer, {
            theme: 'outline',
            size: 'large',
            width: '100%',
          });
        }
      }, 50);
    }
  };

  useEffect(() => {
    if (!isOpen || !GOOGLE_CLIENT_ID) return;

    if (window.google) {
      initializeGoogle();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
      script.onload = initializeGoogle;
      return () => {
        const check = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
        if (check) document.head.removeChild(check);
      };
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handleGoogleLogin = async (response: any) => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credential: response.credential }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Google authentication failed.');
      }

      const data: TokenResponse = await res.json();
      onLoginSuccess(data.access_token);
      setSuccess('Google Login successful!');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Google login error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: pendingEmail || email, password }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to resend verification code.');
      }

      setSuccess('A new verification code has been sent! Check your inbox and spam folder.');
    } catch (err: any) {
      setError(err.message || 'Error occurred while resending verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'register') {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Sign up failed.');
        }

        setPendingEmail(email);
        setSuccess('Verification code sent! Check your inbox (and spam folder).');
        setTimeout(() => {
          setMode('otp_verify');
          setSuccess(null);
        }, 1500);
      } else if (mode === 'otp_verify') {
        const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: pendingEmail, otp }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'OTP verification failed.');
        }

        const data: TokenResponse = await response.json();
        onLoginSuccess(data.access_token);
        setSuccess('Verification successful! Logging in...');
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        const response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData,
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Login failed. Verify credentials.');
        }

        const data: TokenResponse = await response.json();
        onLoginSuccess(data.access_token);
        setSuccess('Login successful!');
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="glass-panel auth-modal-card">
        <div className="modal-header">
          <h3>
            {mode === 'login' && 'Sign In'}
            {mode === 'register' && 'Create Account'}
            {mode === 'otp_verify' && 'Verify Account'}
          </h3>
          <button onClick={onClose} className="close-btn" aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="alert alert-danger">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <CheckCircle size={16} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === 'otp_verify' ? (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-otp">
                Verification OTP Code
              </label>
              <div style={{ position: 'relative' }}>
                <Smartphone 
                  size={18} 
                  style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} 
                />
                <input
                  id="auth-otp"
                  type="text"
                  maxLength={6}
                  className="form-input"
                  style={{ width: '100%', paddingLeft: '44px', letterSpacing: '4px', fontWeight: 'bold', fontSize: '1.1rem' }}
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  required
                  disabled={loading}
                />
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '8.5px', lineHeight: '1.4' }}>
                Check your email address <strong>{pendingEmail}</strong> for the verification code.
                <br />
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Note: If you don't see the email, please check your Spam / Junk folder.</span>
              </p>
              <div style={{ marginTop: '12px', textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    textDecoration: 'underline'
                  }}
                >
                  Resend Code
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="auth-email">
                  {mode === 'login' ? 'Username or Email' : 'Email Address'}
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail 
                    size={18} 
                    style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} 
                  />
                  <input
                    id="auth-email"
                    type={mode === 'login' ? 'text' : 'email'}
                    className="form-input"
                    style={{ width: '100%', paddingLeft: '44px' }}
                    placeholder={mode === 'login' ? 'Enter username or email' : 'Enter email address'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="auth-password">
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock 
                    size={18} 
                    style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} 
                  />
                  <input
                    id="auth-password"
                    type="password"
                    className="form-input"
                    style={{ width: '100%', paddingLeft: '44px' }}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {mode === 'register' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="auth-confirm-password">
                    Confirm Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock 
                      size={18} 
                      style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} 
                    />
                    <input
                      id="auth-confirm-password"
                      type="password"
                      className="form-input"
                      style={{ width: '100%', paddingLeft: '44px' }}
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '12px' }}
            disabled={loading}
          >
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : mode === 'otp_verify' ? 'Confirm OTP' : 'Sign Up'}
          </button>
        </form>

        {/* Google Login Options */}
        {mode !== 'otp_verify' && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0' }}>
              <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
              <span style={{ padding: '0 10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>OR</span>
              <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
            </div>

            {GOOGLE_CLIENT_ID ? (
              <div id="google-btn" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}></div>
            ) : (
              <div style={{ padding: '10px', textAlign: 'center', background: 'var(--border)', borderRadius: 'var(--radius)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Google login not configured (Missing VITE_GOOGLE_CLIENT_ID)
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button 
                type="button"
                onClick={() => setMode('register')} 
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
              >
                Create Account
              </button>
            </>
          ) : mode === 'register' ? (
            <>
              Already have an account?{' '}
              <button 
                type="button"
                onClick={() => setMode('login')} 
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
              >
                Sign In
              </button>
            </>
          ) : (
            <>
              Entered the wrong email?{' '}
              <button 
                type="button"
                onClick={() => setMode('register')} 
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
              >
                Back to Sign Up
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
