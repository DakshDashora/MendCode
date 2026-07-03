export interface User {
  id: string;
  username: string;
  role: string;
  github_token: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  user_id: string;
  repo_owner: string;
  repo_name: string;
  issue_number: number;
  issue_title: string | null;
  problem_summary: string | null;
  root_cause_analysis: string | null;
  llm_provider: string;
  status: 'PENDING' | 'RUNNING' | 'AWAITING_APPROVAL' | 'COMPLETED' | 'FAILED';
  current_step: string | null;
  pr_url: string | null;
  approved_changes: Array<{
    file_path: string;
    objective: string;
    target_content?: string;
    replacement_content?: string;
    original_content?: string;
    updated_content?: string;
    change_summary?: string;
  }> | null;
  error_message: string | null;
  console_logs: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
