# MendCode 🚀

MendCode is an autonomous, AI-powered developer portal that fetches GitHub issues, analyzes acceptance criteria, investigates codebase root causes, drafts code modifications, validates edits, and opens pull requests automatically. 

It features a high-contrast, developer-first layout inspired by GitHub's aesthetics, complete with light/dark modes, a rolling real-time console log stream, progress visualization, and interactive diff viewers.

---

## 🛠️ Tech Stack

* **Backend**: FastAPI, SQLAlchemy (SQLite/Neon PostgreSQL), LangGraph (Streaming Agentic Workflow Engine), LangChain, Pydantic, Python.
* **Frontend**: React, TypeScript, React Router DOM, Vanilla CSS (Flat slate theme), Lucide Icons, Vite.
* **AI Providers**: Google Gemini (`gemini-2.0-flash`) and Groq (`llama-3.3-70b-versatile`).

---

## ✨ Features

1. **Multi-Page Layout**: Professional navbar with in-site navigation links (Home, Dashboard, How It Works), footer, client route guards, and tabbed dashboard.
2. **Dual Authentication Options**: Sign in or register via **Email with OTP verification** (printed to console or dispatched via SMTP) or one-click **Sign in with Google**.
3. **User Profile Management**: Live debounced checking (400ms delay) to ensure username availability, custom profile page, and GitHub profile connections.
4. **GitHub Integration Hook**: Direct OAuth callback linking, token encryption, and profile decoupling.
5. **Real-Time Log Stream**: Integrates LangGraph value streaming (`app.stream(..., stream_mode="values")`) to feed node progress events and execution console logs to the UI terminal instantly.
6. **Agent Stepper Progress**: Dynamic pipeline layout showing completed steps (green check), active step (cyan spinner with pulsate description), and pending steps.
7. **Code Diff Viewer**: Side-by-side modifications view with green additions, red deletions, edit overrides, and path cropping.
8. **PR Success Overlay**: Triggered modal offering immediate redirects to the generated pull request branch on GitHub.
9. **How MendCode Works**: A dedicated interactive pipeline page depicting the 11-step LangGraph workflow with collapsible nodes, system vs. LLM indicators, retry loops, and human-in-the-loop badges.
10. **Workspace Codebase Explorer**: A collapsible file browser tree with file-type icons and built-in editor allowing users to review and modify the cloned codebase workspace directly.
11. **Self-Healing Ephemeral Workspace Restorer**: Detects missing workspace directories (caused by server sleep cycles or disk resets on hosts like Render) and automatically re-clones the target repository, applying all user-approved database patches to reconstruct the exact development workspace state on-the-fly.
12. **Automatic Workspace Cleanup & Scheduler**: Integrates a background thread daemon checking for inactive workspace clones periodically. Deletes clones 2 days after job finish (success/failure), dispatches warning emails for 30-day inactive drafts, and automatically clears them after an additional 10 days of inactivity.

---

## 🚀 Setup & Installation

### Prerequisites
* Python 3.10+
* Node.js 18+

### 1. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd Backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```
3. Install required packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy the environment template and configure your secrets:
   ```bash
   cp .env.example .env
   ```
5. Seed test database users (optional):
   ```bash
   python api/utils/seed_users.py
   ```
6. Run the server:
   ```bash
   python api/server.py
   ```
   *The backend will boot up locally on [http://localhost:8000](http://localhost:8000).*

### 2. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Copy the frontend env template:
   ```bash
   cp .env.example .env
   ```
3. Install npm packages:
   ```bash
   npm install
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```
   *The client will start on [http://localhost:5173](http://localhost:5173).*

---

## 🔑 Environment Variables Configuration

### Backend (`Backend/.env`)
Create a `.env` file in the `Backend` directory containing the following:

```env
# Database Settings (supports sqlite:///./jobs.db or postgresql://...)
DATABASE_URL = sqlite:///./jobs.db

# JWT Configuration
JWT_SECRET_KEY = <your-random-jwt-signing-key>
ALGORITHM = HS256
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Secure Token Encryption (CRITICAL)
# Generate a key using: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ENCRYPTION_KEY = <your-32-byte-base64-encryption-key>

# GitHub Developer OAuth App Settings
GITHUB_CLIENT_ID = <your-github-app-client-id>
GITHUB_CLIENT_SECRET = <your-github-app-client-secret>
GITHUB_REDIRECT_URI = http://localhost:5173/github/callback

# Google OAuth Credentials
GOOGLE_CLIENT_ID = <your-google-client-id>

# Email SMTP Settings (Optional, falls back to server console logs if blank)
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 587
SMTP_USER = your-email@gmail.com
SMTP_PASSWORD = your-app-password
SMTP_FROM = your-email@gmail.com

# AI Provider API Keys
GEMINI_API_KEY = <your-google-gemini-key>
GROQ_API_KEY = <your-groq-api-key>

# CORS Security Origin Checks (Optional, defaults to http://localhost:5173)
FRONTEND_URL = http://localhost:5173
```

### Frontend (`frontend/.env`)
Create a `.env` file in the `frontend` directory containing the following:

```env
VITE_BACKEND_URL = http://localhost:8000
VITE_GOOGLE_CLIENT_ID = <your-google-client-id>
```

> [!IMPORTANT]
> **Encryption Key Persistence**: You must define a static `ENCRYPTION_KEY` in your backend `.env` file. If omitted, the server generates a new dynamic encryption key on each restart, causing previously stored GitHub access tokens to fail to decrypt.

---

## 🔄 Agentic Workflow Node Details

The background agent runs as a compiled **LangGraph state diagram** utilizing the following pipeline stages:

1. **`fetch_issue`**: Queries the GitHub REST API to fetch details about target issues.
2. **`issue_analyzed`**: Establishes acceptance parameters and code search terms.
3. **`repository_cloned`**: Performs clean local clones of repositories.
4. **`files_selected`**: Leverages lexical code index queries to find related modules.
5. **`issue_investigated`**: Traces function dependencies to isolate error sources.
6. **`modification_spec_created`**: Drafts files edit targets and logic adjustments.
7. **`change_generated`**: Invokes LLM providers to write surgical diff additions.
8. **`change_reviewed`**: Checks changes against security, safety, and alignment conditions.
9. **`changes_validated`**: Performs local AST parse validation dry-runs.
10. **`files_applied`**: Writes modified files back to the workspace.
11. **`pr_created`**: Pushes the code changes to the GitHub fork and submits the Pull Request.