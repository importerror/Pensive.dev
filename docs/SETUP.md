# Setup Guide

## Prerequisites

- Google account with Google Docs access
- Railway account (for backend hosting)
- MongoDB Atlas account (free tier, optional)
- OpenAI API key with GPT-4o access

## Step 1: Deploy the Backend

### Railway Deployment

1. Push code to GitHub (use Emergent's "Save to Github" or `git push`)
2. Go to [railway.app](https://railway.app) and sign in with GitHub
3. Click **New Project** > **Deploy from GitHub Repo**
4. Select your repo and set **Root Directory** to `backend`
5. Add environment variables in the **Variables** tab:

| Variable | Value |
|----------|-------|
| `OPENAI_API_KEY` | Your OpenAI API key |
| `MONGO_URL` | MongoDB Atlas connection string (optional) |
| `DB_NAME` | `rca_reviewer` |

6. Go to **Settings > Networking** > Set port to `8001` > **Generate Domain**
7. Note your public URL (e.g., `https://your-app.up.railway.app`)

### Verify Deployment

```bash
curl https://your-app.up.railway.app/api/health
# Should return: {"status":"ok","service":"rca-reviewer-api"}
```

## Step 2: Set Up MongoDB Atlas (Optional)

MongoDB is used for chat history persistence. The app works without it.

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a free M0 cluster
3. Set up a database user with password
4. Under **Network Access**, add `0.0.0.0/0` (allow all IPs)
5. Get connection string: **Database > Connect > Drivers > Python**
6. Add to Railway environment variables as `MONGO_URL`

## Step 3: Install the Google Docs Add-on

1. Open any Google Doc
2. Go to **Extensions > Apps Script**
3. Delete the default `Code.gs` content
4. Create these files in the Apps Script editor:

| File | Type | Description |
|------|------|-------------|
| `Code.gs` | Script | Main entry point, menu, review orchestration |
| `CommentService.gs` | Script | Drive API v3 comment creation |
| `ApiService.gs` | Script | Backend HTTP communication |
| `Sidebar` | HTML | Sidebar UI (name without .html extension) |

5. Copy code for each file from the **Installation Guide** tab in the preview app

6. In `ApiService.gs`, set your backend URL:
```javascript
var API_BASE_URL = 'https://your-app.up.railway.app';
```

7. Update `appsscript.json`:
   - Click gear icon (Project Settings)
   - Check "Show appsscript.json manifest file in editor"
   - Replace content with the manifest from the Installation Guide

8. Save all files

## Step 4: Authorize and Test

1. Reload the Google Doc
2. Go to **Extensions > RCA Reviewer > Open RCA Reviewer**
3. Google will ask for authorization:
   - Click **Continue**
   - Click **Advanced > Go to Untitled project (unsafe)**
   - Click **Allow**
4. Write or paste an RCA document
5. Click **Run RCA Review**
6. Comments should appear as real Google Docs comments
7. Score and improvements shown in the sidebar

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No HTML file named Sidebar" | Create HTML file named `Sidebar` (not `Sidebar.html`) |
| "RCA tab not found" | Outdated Code.gs - update to latest version that reads document body |
| 500 error from API | Check Railway logs, verify env variables are set |
| SSL error with MongoDB | Add `certifi` to requirements.txt, or app works without MongoDB |
| Authorization warning | Normal for personal scripts, click through "unsafe" warning |
| Comments not appearing | Ensure Drive Advanced Service v3 is enabled in appsscript.json |

## Project Structure

```
/app/
├── backend/
│   ├── server.py              # FastAPI application
│   ├── requirements.txt       # Python dependencies
│   ├── Dockerfile             # Railway deployment
│   ├── Procfile               # Start command
│   └── .env                   # Environment variables (local)
├── frontend/
│   ├── src/
│   │   ├── App.js             # Main React component
│   │   ├── App.css            # Google-themed styles
│   │   ├── index.js           # Entry point
│   │   ├── index.css          # Global styles
│   │   └── components/
│   │       ├── Sidebar.js     # Sidebar simulator
│   │       ├── DocumentArea.js # Document tab simulator
│   │       └── InstallGuide.js # Installation guide with source code
│   ├── public/
│   │   └── index.html
│   ├── package.json
│   └── .env
├── addon/
│   └── Sidebar.html           # Reference copy of sidebar HTML
├── docs/
│   ├── README.md              # Overview
│   ├── ARCHITECTURE.md        # System architecture
│   ├── SETUP.md               # This file
│   ├── API.md                 # API reference
│   └── APPS_SCRIPT.md         # Apps Script reference
└── README.md
```
