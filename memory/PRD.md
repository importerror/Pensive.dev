# RCA Reviewer - Google Docs Add-on PRD

## Original Problem Statement
Build a Google Docs Add-on named "RCA Reviewer" that:
1. Analyzes RCA documents using Amazon-style review criteria (6 dimensions, /30 score)
2. Adds inline comments to Google Docs anchored to specific text
3. Provides a sidebar UI for running analysis and a global chat feature
4. Backend powered by GPT-4o via OpenAI API

## Architecture
- **Backend**: FastAPI + Python + OpenAI GPT-4o (deployed on Railway)
- **Frontend**: React app serving as documentation/installation guide + live preview
- **Add-on**: Google Apps Script (Code.gs, ApiService.gs, Sidebar.html, appsscript.json)
- **Database**: MongoDB (local dev) / MongoDB Atlas (Railway prod)

## Core Files
- `backend/server.py` - FastAPI API (analyze-rca, chat, health endpoints)
- `frontend/src/components/InstallGuide.js` - GS file code in GS_FILES template
- `addon/Code.gs` - Main add-on logic
- `addon/Sidebar.html` - Sidebar UI
- `addon/ApiService.gs` - Backend API calls
- `addon/appsscript.json` - Manifest

## Key Design Decisions
- **Two-step workflow**: (1) Run RCA Review from sidebar → API call only, stores analysis in PropertiesService. (2) Apply Comments via sidebar button → highlights text yellow + creates unanchored Drive comments.
- **Unanchored comments**: Using `Drive.Comments.create({ content: commentBody }, docId)` WITHOUT `quotedFileContent` to avoid the "Original content deleted" bug.
- **Context quoting**: The anchor text is quoted in the comment body as `> "anchor text"` for context.
- **Highlight**: Text is highlighted with `#FCE8B2` (yellow) to visually mark the referenced section.

## API Endpoints
- `POST /api/analyze-rca` - RCA analysis returning score + comments + executive summary
- `POST /api/chat` - Global chat with document context
- `GET /api/health` - Health check
- `POST /api/process-reply` - Reply to a comment thread (backend ready, UI not implemented)

## Evaluation Dimensions (6 x 5 = 30 total)
1. Incident clarity & impact
2. Timeline completeness
3. Root cause depth (systemic vs proximate)
4. Detection & alerting rigor
5. Corrective action quality
6. Learnings quality

## What's Implemented
- [x] FastAPI backend with GPT-4o analysis
- [x] React frontend with live preview + installation guide
- [x] Google Apps Script: runReview(), applyComments(), sendChatMessage()
- [x] Two-step comment flow (analyze → apply)
- [x] Sidebar UI: Idle → Progress → Results states with score display
- [x] Global Chat tab in sidebar
- [x] Text highlighting (yellow) + unanchored comments
- [x] Railway + MongoDB Atlas deployment

## Pending / Backlog

### P1
- [ ] Comment Lifecycle Management: track IDs in PropertiesService, update on re-run, don't duplicate
- [ ] Fix Railway backend 502 (user needs to push to GitHub + check Railway env vars)

### P2
- [ ] AI Replies in Comment Threads (`/api/process-reply` backend exists, UI not built)
- [ ] Improve Global Chat integration (session persistence, history display)
- [ ] Enhanced sidebar animations

### Refactoring
- [ ] MongoDB SSL connection fix (currently bypassed with try/except)
- [ ] Separate Code.gs back into CommentService.gs, DocumentService.gs once stable

## Known Issues / History
- **"Original content deleted"** was caused by Drive.Comments.create with quotedFileContent failing when called from sidebar context. Fixed by switching to unanchored comments.
- **Railway 502**: Backend may crash on startup if OPENAI_API_KEY not set in Railway env. Fixed by lazy init: `openai_client = AsyncOpenAI(...) if key else None`. User must redeploy.
- **Missing apply-btn**: Sidebar.html had no `id="apply-btn"` button despite JS referencing it. Fixed.
- **applyComments ui.alert crash**: Was calling DocumentApp.getUi().alert() without try/catch, crashing when called from google.script.run. Fixed with try/catch wrapper + return object.
