import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare,
  Brain,
  GitFork,
  FileSearch,
  SearchCode,
  PenTool,
  Code2,
  ShieldCheck,
  FlaskConical,
  CheckCircle2,
  GitPullRequest,
  ArrowRight,
} from 'lucide-react';
import './HowItWorks.css';

/* ─── Pipeline Data ────────────────────────────────────────── */

interface PipelineStep {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  type: 'LLM' | 'System' | 'LLM + System';
  detail: string;
  special?: string; // optional badge text
  retryConnector?: string; // label to show on the *outgoing* connector
}

const STEPS: PipelineStep[] = [
  {
    title: 'Fetch GitHub Issue',
    subtitle: 'Pull issue context from the GitHub API',
    icon: MessageSquare,
    type: 'System',
    detail:
      'Queries the GitHub REST API to fetch the issue title, body, and comments. This raw context is passed to all downstream analysis steps.',
  },
  {
    title: 'Analyze Acceptance Criteria',
    subtitle: 'Extract structured requirements from the issue',
    icon: Brain,
    type: 'LLM',
    detail:
      'An AI model extracts the problem summary, expected behavior, acceptance criteria, suspected components, and repository search terms from the issue content.',
  },
  {
    title: 'Clone Repository',
    subtitle: 'Sandboxed local copy for safe edits',
    icon: GitFork,
    type: 'System',
    detail:
      'Clones the target repository to an isolated local workspace directory using authenticated git. Each job gets its own sandboxed copy.',
  },
  {
    title: 'Select Relevant Files',
    subtitle: 'AI picks the most likely source files',
    icon: FileSearch,
    type: 'LLM',
    detail:
      'The AI reads the repository tree structure and selects up to 5 source files most likely related to the issue, using the search terms from the analysis step.',
  },
  {
    title: 'Investigate Root Cause',
    subtitle: 'Deep code inspection for root cause analysis',
    icon: SearchCode,
    type: 'LLM',
    detail:
      'The selected files are read in full. The AI performs deep inspection to identify the root cause, affected functions/classes, and produces a confidence score.',
  },
  {
    title: 'Design Modification Spec',
    subtitle: 'Surgical blueprint for code changes',
    icon: PenTool,
    type: 'LLM',
    detail:
      'Creates a surgical modification plan specifying exactly which files to modify and the precise objective for each change. This becomes the blueprint for code generation.',
    special: 'Branching — pipeline ends on failure',
  },
  {
    title: 'Generate Code Edits',
    subtitle: 'AI writes the updated source code',
    icon: Code2,
    type: 'LLM',
    detail:
      'For each target file in the modification spec, the AI generates updated source code. If a previous attempt was rejected, feedback is incorporated into the retry.',
    special: 'Retry Loop (up to 3×)',
    retryConnector: '↻ retry from review',
  },
  {
    title: 'Review Code Changes',
    subtitle: 'AI reviewer checks quality & safety',
    icon: ShieldCheck,
    type: 'LLM',
    detail:
      'An AI reviewer evaluates each change for effectiveness, anti-lobotomy safety (no accidental deletions), pragmatism, correctness, and code hygiene. Rejected changes trigger a retry.',
    special: 'Retry Loop (up to 3×)',
    retryConnector: '↻ validation retry',
  },
  {
    title: 'Validate Codebase',
    subtitle: 'AST checks + holistic LLM dry-run',
    icon: FlaskConical,
    type: 'LLM + System',
    detail:
      'Python AST syntax checking validates the modified code compiles. A holistic LLM dry-run checks cross-file integrity, acceptance criteria compliance, and potential regressions.',
    special: 'Validation Retry Loop (up to 3×)',
  },
  {
    title: 'Apply Code Edits',
    subtitle: 'Human approval before writing to disk',
    icon: CheckCircle2,
    type: 'System',
    detail:
      'The approved changes are presented to the user for final review. This is the human-in-the-loop checkpoint — changes are only written to disk after explicit user approval.',
    special: 'Human-in-the-Loop',
  },
  {
    title: 'Submit Pull Request',
    subtitle: 'Branch, commit, push & open PR',
    icon: GitPullRequest,
    type: 'System',
    detail:
      'Creates a new branch, commits all changes, pushes to GitHub (auto-detecting fork vs. direct push), and opens a pull request with an AI-generated title and description.',
  },
];

/* ─── Helpers ──────────────────────────────────────────────── */

function typeBadgeClass(type: PipelineStep['type']): string {
  if (type === 'LLM') return 'hiw-badge hiw-badge--llm';
  if (type === 'System') return 'hiw-badge hiw-badge--system';
  return 'hiw-badge hiw-badge--llmsystem';
}

function specialBadgeClass(special: string): string {
  if (special.toLowerCase().includes('human')) return 'hiw-badge hiw-badge--human';
  if (special.toLowerCase().includes('retry')) return 'hiw-badge hiw-badge--retry';
  if (special.toLowerCase().includes('branch')) return 'hiw-badge hiw-badge--branch';
  return 'hiw-badge hiw-badge--retry';
}

/**
 * HowItWorksPage Component
 * 
 * Renders the visual representation of the 11-step LangGraph agentic workflow pipeline.
 * Features:
 * - Alternating timeline visual alignment.
 * - Dynamic accordion panels toggling inputs, outputs, models, and operations per node.
 * - System, LLM, and human-in-the-loop status indicators.
 * - Smooth transition animations and state-aware hover transformations.
 */
export const HowItWorksPage: React.FC = () => {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggle = (idx: number) =>
    setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));

  return (
    <div className="hiw-page">
      {/* ── Hero ──────────────────────────────────────── */}
      <section className="hiw-hero">
        <h1 className="hiw-hero-title">How <span>MendCode</span> Works</h1>
        <p className="hiw-hero-subtitle">
          An 11-step AI-powered pipeline that reads your GitHub issues, surgically
          edits code, and opens pull requests — all autonomously.
        </p>
      </section>

      {/* ── Pipeline ──────────────────────────────────── */}
      <div className="hiw-pipeline">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isOpen = !!expanded[idx];

          return (
            <div key={idx} className={`hiw-node${isOpen ? ' hiw-node--expanded' : ''}`}>
              {/* Timeline Marker Line Alignment */}
              <div className="hiw-marker-container">
                <span className="hiw-step-badge">{idx + 1}</span>
              </div>

              <div
                className="hiw-node-header"
                onClick={() => toggle(idx)}
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle(idx);
                  }
                }}
              >
                {/* Icon + title */}
                <div className="hiw-node-info">
                  <span className="hiw-node-icon">
                    <Icon size={18} />
                  </span>
                  <div className="hiw-node-text">
                    <div className="hiw-node-title">{step.title}</div>
                    <div className="hiw-node-subtitle">{step.subtitle}</div>
                  </div>
                </div>

                {/* Expand / Collapse */}
                <span
                  className={`hiw-expand-btn${isOpen ? ' hiw-expand-btn--open' : ''}`}
                  aria-label={isOpen ? 'Collapse details' : 'Expand details'}
                >
                  +
                </span>
              </div>

              {/* Detail panel */}
              <div
                className={`hiw-node-detail${isOpen ? ' hiw-node-detail--open' : ''}`}
              >
                <div className="hiw-node-detail-inner">
                  <p className="hiw-detail-text">{step.detail}</p>
                  <div className="hiw-badges">
                    <span className={typeBadgeClass(step.type)}>{step.type}</span>
                    {step.special && (
                      <span className={specialBadgeClass(step.special)}>
                        {step.special}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── CTA ───────────────────────────────────────── */}
      <section className="hiw-cta">
        <h2 className="hiw-cta-title">Ready to automate your PRs?</h2>
        <p className="hiw-cta-subtitle">
          Point MendCode at a GitHub issue and watch the pipeline run end-to-end.
        </p>
        <Link to="/" className="hiw-cta-btn">
          Get Started <ArrowRight size={18} />
        </Link>
      </section>
    </div>
  );
};
