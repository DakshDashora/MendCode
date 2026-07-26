import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Terminal, GitBranch, ShieldCheck, Cpu, Workflow } from 'lucide-react';

interface LandingPageProps {
  onGetStartedClick: () => void;
  isLoggedIn?: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStartedClick, isLoggedIn }) => {
  const navigate = useNavigate();

  return (
    <div className="landing-wrapper">
      <section className="landing-hero">
        <div className="hero-badge">
          <Cpu size={14} /> Agentic PR Pipeline v1.0
        </div>
        <h1 className="landing-title">
          Automate Pull Requests with <span>Surgical AI Edits</span>
        </h1>
        <p className="landing-subtitle">
          Connect your GitHub repository and let our agent analyze issues, locate bugs, draft code adjustments, run validation checks, and open PRs automatically.
        </p>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          {isLoggedIn ? (
            <button onClick={() => navigate('/dashboard')} className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '1rem' }}>
              Visit Dashboard <ArrowRight size={18} />
            </button>
          ) : (
            <button onClick={onGetStartedClick} className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '1rem' }}>
              Get Started <ArrowRight size={18} />
            </button>
          )}
          <Link to="/how-it-works" className="btn btn-secondary" style={{ padding: '14px 28px', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <Workflow size={18} /> How It Works
          </Link>
        </div>
      </section>

      <section className="features-grid">
        <div className="glass-panel feature-card">
          <div className="feature-icon">
            <Terminal size={22} />
          </div>
          <h3>1. Issue Investigation</h3>
          <p>
            The agent parses issue definitions, translates them into testable requirements, and searches repository files using optimized keyword indices.
          </p>
        </div>

        <div className="glass-panel feature-card secondary">
          <div className="feature-icon">
            <GitBranch size={22} />
          </div>
          <h3>2. Surgical Edits</h3>
          <p>
            Modifications are applied surgically to functional code blocks, maintaining strict code parity and protecting unrelated system routines.
          </p>
        </div>

        <div className="glass-panel feature-card">
          <div className="feature-icon">
            <ShieldCheck size={22} />
          </div>
          <h3>3. Automated Testing</h3>
          <p>
            A validation engine recompiles files and triggers tests. If logic checks fail, the agent iterates until all tests pass.
          </p>
        </div>
      </section>
    </div>
  );
};
