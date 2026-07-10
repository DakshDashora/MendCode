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

  // Editing state for proposed modifications
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Workspace Codebase Explorer States
  const [activeDetailTab, setActiveDetailTab] = useState<'changes' | 'explorer'>('changes');
  const [workspaceTree, setWorkspaceTree] = useState<Array<{ path: string, is_dir: boolean }>>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [loadingFileContent, setLoadingFileContent] = useState(false);
  const [editingFileContent, setEditingFileContent] = useState<string>('');
  const [savingWorkspaceFile, setSavingWorkspaceFile] = useState(false);
  const [explorerSuccessMsg, setExplorerSuccessMsg] = useState<string | null>(null);

  const fetchWorkspaceTree = async () => {
    setLoadingTree(true);
    try {
      const res = await fetch(`${API_BASE_URL}/jobs/${job.id}/workspace/tree`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWorkspaceTree(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTree(false);
    }
  };

  const handleSelectFile = async (filePath: string) => {
    setSelectedFilePath(filePath);
    setLoadingFileContent(true);
    setExplorerSuccessMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/jobs/${job.id}/workspace/file?path=${encodeURIComponent(filePath)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEditingFileContent(data.content);
      } else {
        const data = await res.json();
        alert(data.detail || 'Cannot read binary files or content.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFileContent(false);
    }
  };

  const handleSaveWorkspaceFile = async () => {
    if (!selectedFilePath) return;
    setSavingWorkspaceFile(true);
    setExplorerSuccessMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/jobs/${job.id}/workspace/file`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          file_path: selectedFilePath,
          updated_content: editingFileContent
        })
      });
      if (res.ok) {
        setExplorerSuccessMsg('File saved successfully in the workspace!');
        setTimeout(() => setExplorerSuccessMsg(null), 3000);
      } else {
        const data = await res.json();
        alert(data.detail || 'Failed to save changes.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingWorkspaceFile(false);
    }
  };

  const handleStartEdit = (index: number, content: string) => {
    setEditingIndex(index);
    setEditText(content);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditText('');
  };

  const handleSaveEdit = async (filePath: string) => {
    setSavingEdit(true);
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${job.id}/changes`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          file_path: filePath,
          updated_content: editText,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to save changes.');
      }

      onRefresh();
      setEditingIndex(null);
      setEditText('');
    } catch (err: any) {
      alert(err.message || 'Error saving changes');
    } finally {
      setSavingEdit(false);
    }
  };

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
      const relative = path.substring(index + marker.length);
      const parts = relative.split('/');
      if (parts.length > 2) {
        return parts.slice(2).join('/');
      }
      return relative;
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
          
          {/* Detail Tabs Selector */}
          <div className="dashboard-tabs-container" style={{ marginBottom: '24px' }}>
            <button 
              onClick={() => setActiveDetailTab('changes')} 
              className={`tab-btn ${activeDetailTab === 'changes' ? 'active' : ''}`}
            >
              Proposed Edits & Diffs
            </button>
            <button 
              onClick={() => {
                setActiveDetailTab('explorer');
                fetchWorkspaceTree();
              }} 
              className={`tab-btn ${activeDetailTab === 'explorer' ? 'active' : ''}`}
            >
              Workspace Codebase Explorer
            </button>
          </div>

          {activeDetailTab === 'changes' ? (
            <>
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
                      const isEditingThis = editingIndex === index;

                      return (
                        <div key={index} className="change-card">
                          <div className="change-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <span className="change-filepath">{formatFilePath(change.file_path)}</span>
                              <span className="change-objective" style={{ marginLeft: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {change.objective}
                              </span>
                            </div>
                            {job.status === 'AWAITING_APPROVAL' && (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                {isEditingThis ? (
                                  <>
                                    <button 
                                      onClick={() => handleSaveEdit(change.file_path)} 
                                      className="btn btn-primary" 
                                      disabled={savingEdit}
                                      style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                                    >
                                      {savingEdit ? 'Saving...' : 'Save'}
                                    </button>
                                    <button 
                                      onClick={handleCancelEdit} 
                                      className="btn btn-secondary"
                                      style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <button 
                                    onClick={() => handleStartEdit(index, change.updated_content || '')} 
                                    className="btn btn-secondary"
                                    style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                                  >
                                    Edit Code
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="diff-content">
                            {isEditingThis ? (
                              <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-app)' }}>
                                <textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  rows={15}
                                  style={{
                                    width: '100%',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.8rem',
                                    padding: '12px',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius)',
                                    backgroundColor: 'var(--input-bg)',
                                    color: 'var(--text-primary)',
                                    resize: 'vertical',
                                    outline: 'none'
                                  }}
                                />
                              </div>
                            ) : diffLines.length === 0 ? (
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
            </>
          ) : (
            <div className="glass-panel" style={{ padding: '0px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', minHeight: '500px', flexWrap: 'wrap' }}>
                {/* LHS: File Tree Directory list */}
                <div style={{ flex: 1, minWidth: '240px', borderRight: '1px solid var(--border)', padding: '20px', maxHeight: '600px', overflowY: 'auto', background: 'rgba(0,0,0,0.15)' }}>
                  <h5 style={{ textTransform: 'uppercase', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    Cloned Files Tree
                  </h5>
                  {loadingTree ? (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading file tree...</div>
                  ) : workspaceTree.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Workspace folder is empty or not yet cloned.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {workspaceTree.map((item, idx) => {
                        const isSelected = selectedFilePath === item.path;
                        return (
                          <button
                            key={idx}
                            onClick={() => !item.is_dir && handleSelectFile(item.path)}
                            disabled={item.is_dir}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              width: '100%',
                              padding: '6px 10px',
                              background: isSelected ? 'var(--accent-glow)' : 'transparent',
                              border: 'none',
                              borderRadius: 'var(--radius)',
                              color: item.is_dir ? 'var(--text-secondary)' : isSelected ? 'var(--accent)' : 'var(--text-primary)',
                              fontSize: '0.82rem',
                              fontWeight: isSelected ? 700 : 400,
                              cursor: item.is_dir ? 'default' : 'pointer',
                              textAlign: 'left',
                              paddingLeft: `${(item.path.split('/').length - 1) * 12 + 10}px`
                            }}
                          >
                            <span style={{ marginRight: '8px' }}>
                              {item.is_dir ? '📁' : '📄'}
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.path.split('/').pop()}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* RHS: Code Viewer / Editor */}
                <div style={{ flex: 2, minWidth: '320px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                  {selectedFilePath ? (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                        <div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Editing Workspace File</span>
                          <span style={{ fontSize: '0.92rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{selectedFilePath}</span>
                        </div>
                        <button
                          onClick={handleSaveWorkspaceFile}
                          className="btn btn-primary"
                          disabled={savingWorkspaceFile || loadingFileContent}
                          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                        >
                          {savingWorkspaceFile ? 'Saving...' : 'Save File'}
                        </button>
                      </div>

                      {explorerSuccessMsg && (
                        <div className="alert alert-success" style={{ marginBottom: '16px' }}>
                          <Check size={16} />
                          <span>{explorerSuccessMsg}</span>
                        </div>
                      )}

                      {loadingFileContent ? (
                        <div style={{ color: 'var(--text-secondary)', padding: '40px 0', textAlign: 'center' }}>
                          Reading file contents...
                        </div>
                      ) : (
                        <textarea
                          value={editingFileContent}
                          onChange={(e) => setEditingFileContent(e.target.value)}
                          rows={20}
                          style={{
                            width: '100%',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.8rem',
                            padding: '16px',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius)',
                            backgroundColor: 'var(--input-bg)',
                            color: 'var(--text-primary)',
                            outline: 'none',
                            resize: 'vertical',
                            lineHeight: '1.4'
                          }}
                        />
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '60px 20px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      <FileText size={40} style={{ opacity: 0.3, marginBottom: '16px' }} />
                      <p style={{ fontSize: '0.9rem' }}>Select a file from the repository tree on the left to read or edit its raw code.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* FULL SPLIT LOADING TERMINAL OVERLAY */}
      {(isWaitingForPR || isActuallyRunning) && (
        <div className="loading-overlay">
          <div className="loading-overlay-content">
            
            {/* Visual Action Panel: Stepper list instead of simple spinner */}
            <div className="overlay-visual-column" style={{ alignItems: 'flex-start', justifyContent: 'flex-start', textAlign: 'left', overflowY: 'auto' }}>
              <div style={{ width: '100%', borderBottom: '1px solid #30363d', paddingBottom: '16px', marginBottom: '20px' }}>
                <h3 style={{ color: 'white', fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} /> 
                  AI Agent Executing
                </h3>
                <p style={{ color: '#8b949e', fontSize: '0.8rem', marginTop: '6px', lineHeight: '1.4' }}>
                  {job.status === 'RUNNING' 
                    ? `Currently: ${job.current_step ? steps.find(s => s.key === job.current_step)?.label || job.current_step : 'Processing'}` 
                    : 'Starting PR agent execution sequence...'}
                </p>
              </div>

              <div className="stepper-list" style={{ width: '100%' }}>
                {steps.map((step, idx) => {
                  const status = getStepStatus(idx);
                  return (
                    <div key={step.key} className={`step-item ${status}`} style={{ margin: '12px 0', display: 'flex', alignItems: 'flex-start' }}>
                      <div className="step-icon" style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '9px',
                        border: status === 'completed' ? '1px solid #22c55e' : status === 'active' ? '1px solid #06b6d4' : '1px solid #30363d',
                        background: status === 'completed' ? '#22c55e22' : status === 'active' ? '#06b6d422' : 'transparent',
                        color: status === 'completed' ? '#22c55e' : status === 'active' ? '#06b6d4' : '#6e7681',
                        marginRight: '12px',
                        flexShrink: 0
                      }}>
                        {status === 'completed' && <Check size={9} />}
                        {status === 'active' && <Loader2 size={9} className="animate-spin" />}
                        {status === 'failed' && <XIcon size={9} />}
                        {status === 'pending' && <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#30363d' }}></span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="step-label" style={{
                          fontSize: '0.85rem',
                          fontWeight: status === 'active' ? 700 : 500,
                          color: status === 'completed' ? '#e6edf3' : status === 'active' ? '#58a6ff' : '#8b949e'
                        }}>
                          {step.label}
                        </div>
                        {status === 'active' && (
                          <p style={{ fontSize: '0.72rem', color: '#8b949e', marginTop: '2px', lineHeight: '1.3' }}>
                            {step.desc}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
