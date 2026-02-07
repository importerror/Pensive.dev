# Architecture

## System Overview

```
+-------------------+       +-------------------+       +------------------+
|  Google Docs      |       |  FastAPI Backend   |       |  OpenAI GPT-4o   |
|  (Apps Script)    |------>|  (Railway)         |------>|                  |
|                   |<------|                    |<------|                  |
+-------------------+       +-------------------+       +------------------+
        |                           |
        v                           v
  Drive API v3              MongoDB Atlas
  (Comments)                (Chat History)
```

## Components

### 1. Google Apps Script Add-on (`/addon/`)

The add-on runs entirely inside Google Docs. It consists of:

- **Code.gs** - Entry point. Creates the Extensions menu, opens the sidebar, orchestrates the review flow
- **CommentService.gs** - Creates real Google Docs comments using Drive API v3. Anchors comments to specific text using `quotedFileContent`. Tracks comment IDs to avoid duplicates on re-run
- **ApiService.gs** - HTTP communication with the backend API using `UrlFetchApp`
- **Sidebar.html** - Full sidebar UI (HTML/CSS/JS) served via `HtmlService`. Three states: idle, progress, results. Includes global chat

### 2. FastAPI Backend (`/backend/`)

A Python REST API that handles all LLM processing:

- Receives RCA document text from the add-on
- Sends it to OpenAI GPT-4o with structured prompts
- Returns JSON with scores, comments, and executive summary
- Handles chat conversations with document context
- Optionally stores data in MongoDB Atlas

### 3. React Frontend (`/frontend/`)

A documentation and preview application:

- **Live Preview** - Interactive simulation of the add-on experience
- **Installation Guide** - Step-by-step setup instructions with copyable source code for all Apps Script files

## Data Flow

### RCA Review Flow

```
1. User clicks "Run RCA Review" in sidebar
2. Sidebar.html calls google.script.run.runReview()
3. Code.gs reads document body text
4. Code.gs calls ApiService.callBackendAPI('/api/analyze-rca', {document_text})
5. Backend sends text to GPT-4o with evaluation prompt
6. GPT-4o returns structured JSON (scores, comments, summary)
7. Code.gs passes comments to CommentService.insertComments()
8. CommentService creates Drive API v3 comments with quotedFileContent
9. Analysis result returned to sidebar for display
```

### Chat Flow

```
1. User types message in sidebar chat
2. Sidebar.html calls google.script.run.sendChatMessage(msg)
3. Code.gs reads document text for context
4. ApiService sends to backend '/api/chat'
5. Backend queries GPT-4o with document context + chat history
6. Response returned to sidebar
```

### Comment Deduplication

```
1. Each AI comment has a unique issue_id
2. CommentService stores a map: issue_id -> drive_comment_id
3. On re-run:
   - If issue_id exists in map: update via Drive.Replies.create()
   - If new issue: create via Drive.Comments.create()
   - If resolved: skip
```

## RCA Evaluation Model

Six dimensions, each scored 0-5 (total /30):

| # | Dimension | What It Measures |
|---|-----------|-----------------|
| 1 | Incident clarity & impact | Is the incident clearly described with customer impact? |
| 2 | Timeline completeness | Is there a detailed, chronological timeline? |
| 3 | Root cause depth | Does it go beyond the trigger to systemic issues? |
| 4 | Detection & alerting rigor | Are detection mechanisms and alerts documented? |
| 5 | Corrective action quality | Are actions preventive, not just reactive? |
| 6 | Learnings quality | Are learnings meaningful and actionable? |

## Comment Issue Types

Fixed set of 7 issue types used for all inline comments:

- **Causality gap** - Missing link in the causal chain
- **Weak root cause** - Root cause is too shallow or proximate
- **Missing detection** - No mention of how the issue was/should be detected
- **Timeline gap** - Missing events or unclear sequence
- **Action item not preventive** - Actions are reactive, not preventing recurrence
- **Vague ownership** - No clear owner or team assigned
- **Missing section** - Expected RCA section is absent

## Security

- OpenAI API key stored as Railway environment variable
- MongoDB credentials stored as Railway environment variable
- Google Apps Script uses OAuth scopes limited to current document and Drive file access
- No user data stored permanently (MongoDB is optional)
- Backend CORS allows all origins (suitable for Apps Script `UrlFetchApp` calls)
