import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, GitPullRequest, AlertCircle, Clock, FileText, Settings, Database, Check, Loader2, X as XIcon, Sparkles } from 'lucide-react';
import type { Job } from '../types';
import { API_BASE_URL } from '../config';

interface JobDetailProps {
  job: Job;
  token: string;
  onBack: () => void;
  onRefresh: () => void;
}

const steps = [
  { key: 'issue_fetched', label: 'Fetch GitHub Issue', desc: 'Queries GitHub REST API to get issue body and comments.' },
  { key: 'issue_analyzed', label: 'Analyze Acceptance Criteria', desc: 'Identifies the expected behavior and acceptance criteria.' },
  { key: 'repository_cloned', label: 'Clone Repository', desc: 'Clones repository code to a local directory for editing.' },
  { key: 'files_selected', label: 'Select Relevant Files', desc: 'Uses repository search terms to find potential target files.' },
  { key: 'issue_investigated', label: 'Investigate Root Cause', desc: 'Surgically inspects chosen files to find logic errors.' },
  { key: 'modification_spec_created', label: 'Design Modification Spec', desc: 'Drafts plans detailing the files, targets, and objectives.' },
  { key: 'change_generated', label: 'Generate Code Edits', desc: 'Invokes AI provider to write updated source code surgical edits.' },
  { key: 'change_reviewed', label: 'Review Code Changes', desc: 'Validates structure and checks edits against instructions.' },
  { key: 'changes_validated', label: 'Validate Codebase (Tests)', desc: 'Validates code changes by running checks and tests.' },
  { key: 'files_applied', label: 'Apply Code Edits', desc: 'Writes the code changes to the local workspace copy.' },
  { key: 'pr_created', label: 'Submit Pull Request', desc: 'Commits changes, pushes branch, and opens a GitHub PR.' }
];

export const JobDetail: React.FC<JobDetailProps> = ({ job, token, onBack, onRefresh }) => {
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWaitingForPR, setIsWaitingForPR] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const handleApprove = async () => {
    setApproving(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${job.id}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to approve changes.');
      }

      setIsWaitingForPR(true);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Error approving job');
    } finally {
      setApproving(false);
    }
  };

  // Monitor status changes to show the success modal
  useEffect(() => {
    if (isWaitingForPR && job.status === 'COMPLETED' && job.pr_url) {
      setIsWaitingForPR(false);
      setShowSuccessModal(true);
    }
  }, [job.status, job.pr_url, isWaitingForPR]);

  // Scroll to bottom of terminal when logs update
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [job.console_logs]);

  const getStepIndex = (stepKey: string | null) => {
    if (!stepKey) return -1;
    return steps.findIndex(s => s.key === stepKey);
  };

  const currentStepIdx = getStepIndex(job.current_step);

  const getStepStatus = (index: number) => {
    if (job.status === 'COMPLETED') return 'completed';
    if (job.status === 'FAILED' && index === currentStepIdx) return 'failed';
    if (index < currentStepIdx) return 'completed';
    if (index === currentStepIdx) return 'active';
    return 'pending';
  };

  // Path cropper helper
  const formatFilePath = (path: string) => {
    const marker = 'workspace/repos/';
    const index = path.indexOf(marker);
    if (index !== -1) {
      return path.substring(index + marker.length);
    }
    return path;
  };

  // Basic diff computation logic
  const computeLineDiff = (original: string, updated: string) => {
    const origLines = original.split('\n');
    const updLines = updated.split('\n');
    const diff: { type: 'normal' | 'addition' | 'deletion'; text: string }[] = [];
    
    let i = 0;
    let j = 0;
    
    while (i < origLines.length || j < updLines.length) {
      if (i < origLines.length && j < updLines.length) {
        if (origLines[i] === updLines[j]) {
          diff.push({ type: 'normal', text: origLines[i] });
          i++;
          j++;
        } else {
          let found = false;
          for (let k = 1; k < 10; k++) {
            if (i + k < origLines.length && origLines[i + k] === updLines[j]) {
              for (let d = 0; d < k; d++) {
                diff.push({ type: 'deletion', text: origLines[i + d] });
              }
              i += k;
              found = true;
              break;
            }
            if (j + k < updLines.length && origLines[i] === updLines[j + k]) {
              for (let a = 0; a < k; a++) {
                diff.push({ type: 'addition', text: updLines[j + a] });
              }
              j += k;
              found = true;
              break;
            }
          }
          if (!found) {
            diff.push({ type: 'deletion', text: origLines[i] });
            diff.push({ type: 'addition', text: updLines[j] });
            i++;
            j++;
          }
        }
      } else if (i < origLines.length) {
        diff.push({ type: 'deletion', text: origLines[i] });
        i++;
      } else if (j < updLines.length) {
        diff.push({ type: 'addition', text: updLines[j] });
        j++;
      }
    }
    return diff;
  };

  const isActuallyRunning = job.status === 'RUNNING' || job.status === 'PENDING';

  return (
    <div className="job-detail-wrapper" style={{ textAlign: 'left' }}>
      <button onClick={onBack} className="back-btn">
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      {/* Header Info */}
      <div className="glass-panel" style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '6px' }}>
            {job.repo_owner}/{job.repo_name} #{job.issue_number}
          </h2>
          {job.issue_title && (
            <p style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '8px', fontWeight: 500 }}>
              {job.issue_title}
            </p>
          )}
          <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span>ID: {job.id}</span>
            <span>LLM: {job.llm_provider.toUpperCase()}</span>
            <span>Last Updated: {new Date(job.updated_at).toLocaleString()}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {job.pr_url && (
            <a 
              href={job.pr_url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn btn-primary"
            >
              <GitPullRequest size={14} /> View Pull Request
            </a>
          )}
          
          {job.status === 'PENDING' && <span className="badge badge-pending">Pending</span>}
          {job.status === 'RUNNING' && <span className="badge badge-running">Running</span>}
          {job.status === 'AWAITING_APPROVAL' && <span className="badge badge-approval">Awaiting Approval</span>}
          {job.status === 'COMPLETED' && <span className="badge badge-completed">Completed</span>}
          {job.status === 'FAILED' && <span className="badge badge-failed">Failed</span>}
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '24px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {job.error_message && (
        <div className="alert alert-danger" style={{ marginBottom: '30px', alignItems: 'flex-start' }}>
          <AlertCircle size={20} style={{ marginTop: '2px' }} />
          <div>
            <strong>Agent Error Encountered:</strong>
            <p style={{ marginTop: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', whiteSpace: 'pre-wrap' }}>
              {job.error_message}
            </p>
          </div>
        </div>
      )}

      {/* Interrupted state requiring user action */}
      {job.status === 'AWAITING_APPROVAL' && (
        <div className="alert alert-success" style={{ backgroundColor: 'var(--accent-glow)', borderColor: 'var(--accent)', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', padding: '18px 24px', marginBottom: '30px' }}>
          <div>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              <Clock size={18} style={{ color: 'var(--accent)' }} /> 
              Verification complete! Please review changes and authorize Pull Request creation.
            </span>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              The agent is paused at the <code>apply_file_change</code> interrupt point.
            </p>
          </div>
          <button 
            onClick={handleApprove} 
            className="btn btn-primary" 
            disabled={approving}
            style={{ minWidth: '160px' }}
          >
            {approving ? 'Applying...' : 'Approve & Submit PR'}
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="detail-layout">
        
        {/* Left Column: Progress Stepper */}
        <div className="sidebar-panel">
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h4 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <Settings size={15} /> Agent Execution Progress
            </h4>
            <div className="stepper-list">
              {steps.map((step, idx) => {
                const status = getStepStatus(idx);
                return (
                  <div key={step.key} className={`step-item ${status}`}>
                    <div className="step-icon">
                      {status === 'completed' && <Check size={11} />}
                      {status === 'active' && <Loader2 size={11} className="animate-spin" />}
                      {status === 'failed' && <XIcon size={11} />}
                    </div>
                    <div>
                      <div className="step-label">{step.label}</div>
                      {status === 'active' && (
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.3' }}>
                          {step.desc}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Execution details and diffs */}
        <div className="main-detail-panel">
          
          {/* Issue summaries */}
          {(job.problem_summary || job.root_cause_analysis) && (
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {job.problem_summary && (
                <div>
                  <div className="info-section-title">
                    <FileText size={15} /> Problem Summary
                  </div>
                  <div className="info-content-card">
                    {job.problem_summary}
                  </div>
                </div>
              )}

              {job.root_cause_analysis && (
                <div>
                  <div className="info-section-title">
                    <Database size={15} /> Root Cause Analysis
                  </div>
                  <div className="info-content-card" style={{ fontFamily: 'var(--font-sans)' }}>
                    {job.root_cause_analysis}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Diffs & Changes */}
          <div className="glass-panel">
            <h4 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <GitPullRequest size={15} /> Proposed Modifications
            </h4>

            {!job.approved_changes || job.approved_changes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                No file modifications proposed yet. Edits will be visible here once the agent completes the <code>generate_file_change</code> phase.
              </div>
            ) : (
              <div className="changes-container">
                {job.approved_changes.map((change, index) => {
                  const original = change.original_content || '';
                  const updated = change.updated_content || '';
                  const diffLines = computeLineDiff(original, updated);

                  return (
                    <div key={index} className="change-card">
                      <div className="change-header">
                        <span className="change-filepath">{formatFilePath(change.file_path)}</span>
                        <span className="change-objective">{change.objective}</span>
                      </div>
                      <div className="diff-content">
                        {diffLines.length === 0 ? (
                          <div style={{ padding: '16px 20px', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                            No changes made to this file.
                          </div>
                        ) : (
                          diffLines.map((line, lIdx) => (
                            <div key={lIdx} className={`diff-line ${line.type}`}>
                              <span style={{ width: '20px', display: 'inline-block', opacity: 0.5, userSelect: 'none', marginRight: '6px' }}>
                                {line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' '}
                              </span>
                              <span>{line.text || ' '}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* FULL SPLIT LOADING TERMINAL OVERLAY */}
      {(isWaitingForPR || isActuallyRunning) && (
        <div className="loading-overlay">
          <div className="loading-overlay-content">
            
            {/* Visual Action Panel */}
            <div className="overlay-visual-column">
              <div className="spinner"></div>
              <h3 style={{ color: 'white', marginBottom: '8px', fontSize: '1.2rem', fontWeight: 600 }}>AI Agent Executing</h3>
              <p style={{ color: '#8b949e', fontSize: '0.82rem', maxWidth: '300px', lineHeight: '1.4' }}>
                {job.status === 'RUNNING' 
                  ? `Active: ${job.current_step ? steps.find(s => s.key === job.current_step)?.label || job.current_step : 'Processing'}` 
                  : 'Starting PR agent execution sequence...'}
              </p>
            </div>

            {/* Console Log Panel */}
            <div className="overlay-console-column">
              <div className="console-header">
                <div className="console-dots">
                  <div className="console-dot red"></div>
                  <div className="console-dot yellow"></div>
                  <div className="console-dot green"></div>
                </div>
                <div className="console-title">agent-execution-logs</div>
                <div style={{ width: '30px' }}></div>
              </div>
              
              <div className="console-terminal">
                {(!job.console_logs || job.console_logs.length === 0) ? (
                  <div className="log-line info">[INFO] Establishing agent host connection...</div>
                ) : (
                  job.console_logs.map((log, lIdx) => {
                    let logType = 'info';
                    if (log.startsWith('[SUCCESS]')) logType = 'success';
                    else if (log.startsWith('[ERROR]')) logType = 'error';
                    else if (log.startsWith('[WARNING]')) logType = 'warning';

                    return (
                      <div key={lIdx} className={`log-line ${logType}`}>
                        {log}
                      </div>
                    );
                  })
                )}
                
                <div className="log-line info" style={{ opacity: 0.85 }}>
                  [●] Streaming live logs from backend...<span className="console-cursor"></span>
                </div>
                
                <div ref={consoleEndRef} />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* SUCCESS MODAL POPUP */}
      {showSuccessModal && (
        <div className="modal-overlay">
          <div className="success-modal-card">
            <div className="success-modal-icon">
              <Sparkles size={28} />
            </div>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '10px' }}>Pull Request Created!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '24px' }}>
              The agent has resolved the issue, validated all changes against target test runs, and opened a new Pull Request.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {job.pr_url && (
                <a 
                  href={job.pr_url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px' }}
                >
                  <GitPullRequest size={16} /> Open Pull Request on GitHub
                </a>
              )}
              <button 
                onClick={() => setShowSuccessModal(false)} 
                className="btn btn-secondary"
                style={{ width: '100%', padding: '12px' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
