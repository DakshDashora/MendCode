import React from 'react';
import { ArrowRight, Terminal, GitBranch, ShieldCheck, Cpu } from 'lucide-react';

interface LandingPageProps {
  onGetStartedClick: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStartedClick }) => {
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
        <button onClick={onGetStartedClick} className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '1rem' }}>
          Get Started <ArrowRight size={18} />
        </button>
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
