# PR Assistant 🚀

PR Assistant is an autonomous, AI-powered developer portal that fetches GitHub issues, analyzes acceptance criteria, investigates codebase root causes, drafts code modifications, validates edits, and opens pull requests automatically. 

It features a high-contrast, developer-first layout inspired by GitHub's aesthetics, complete with light/dark modes, a rolling real-time console log stream, progress visualization, and interactive diff viewers.

---

## 🛠️ Tech Stack

* **Backend**: FastAPI, SQLAlchemy (SQLite), LangGraph (Agentic Workflow Engine), LangChain, Pydantic, Python.
* **Frontend**: React, TypeScript, React Router DOM, Vanilla CSS (Flat slate theme), Lucide Icons, Vite.
* **AI Providers**: Google Gemini (`gemini-2.0-flash`) and Groq (`llama-3.3-70b-versatile`).

---

## ✨ Features

1. **Multi-Page Layout**: Professional navbar, footer, client route guards, and tabbed dashboard.
2. **Authorization Modal**: Dynamic login/signup overlay.
3. **GitHub OAuth Hook**: Direct authorization callback, profile linking, and disconnect features.
4. **Agent Stepper Progress**: Visual indicators showing phase completions, failures, and active operations with custom pulse animations.
5. **Real-Time Log Console**: Captures actual prints from python execution nodes and streams them to the UI terminal with auto-scrolling.
6. **Code Diff Viewer**: Side-by-side modifications view with green additions, red deletions, and path cropping.
7. **PR Success Overlay**: Triggered modal offering immediate redirects to the generated pull request branch on GitHub.

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
5. Run the server:
   ```bash
   python api/server.py
   ```
   *The backend will boot up locally on [http://localhost:8000](http://localhost:8000).*

### 2. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   *The client will start on [http://localhost:5173](http://localhost:5173).*

---

## 🔑 Environment Variables Configuration

Create a `.env` file in the `Backend` directory containing the following:

```env
# Database Settings
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

# AI Provider API Keys
GEMINI_API_KEY = <your-google-gemini-key>
GROQ_API_KEY = <your-groq-api-key>

# Default Settings
DEFAULT_LLM_PROVIDER = gemini
```

> [!IMPORTANT]
> **Encryption Key Persistence**: You must define a static `ENCRYPTION_KEY` in your `.env` file. If omitted, the server generates a new dynamic encryption key on each restart, causing previously stored GitHub access tokens to fail to decrypt.

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