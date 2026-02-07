# RCA Reviewer - Google Docs Add-on

## Problem Statement
Build a Google Docs Add-on that reviews RCA (Root Cause Analysis) documents using Amazon-style review criteria. The add-on provides inline comments, an executive summary, and a global chat feature.

## Architecture
- **Backend**: FastAPI (Python) with OpenAI GPT-4o integration, MongoDB for chat history
- **Frontend**: React app serving as live preview/simulator + installation guide
- **Google Apps Script**: Addon files (.gs + Sidebar.html) for actual Google Docs integration

### API Endpoints
- `POST /api/analyze-rca` - Analyze RCA document, return scores/comments/summary
- `POST /api/chat` - Global RCA chat with document context
- `POST /api/process-reply` - Process comment thread replies
- `GET /api/health` - Health check
- `GET /api/analyses` - Get recent analyses
- `GET /api/chat-history/{session_id}` - Get chat history

### RCA Evaluation Model (Score /30)
1. Incident clarity & impact (0-5)
2. Timeline completeness (0-5)
3. Root cause depth (0-5)
4. Detection & alerting rigor (0-5)
5. Corrective action quality (0-5)
6. Learnings quality (0-5)

## User Personas
- **Engineers**: Write RCAs, use add-on for review feedback
- **Engineering Managers**: Review executive summaries, use chat for leadership questions

## Core Requirements
- One-click RCA review producing inline comments + executive summary
- RCA Review tab with 6 structured sections
- Global RCA Chat for high-level discussions
- Idempotent re-runs (no duplicate comments)
- 7 issue types: Causality gap, Weak root cause, Missing detection, Timeline gap, Action item not preventive, Vague ownership, Missing section

## What's Been Implemented (Jan 2026)
- [x] FastAPI backend with OpenAI GPT-4o integration
- [x] RCA analysis endpoint with structured JSON responses
- [x] Chat endpoint with session persistence (MongoDB)
- [x] Comment reply processing endpoint
- [x] React frontend with Google-themed design
- [x] Live preview/simulator of add-on experience
- [x] Document area with RCA and RCA Review tabs
- [x] Sidebar with idle/progress/results states
- [x] Global RCA Chat with suggestions
- [x] Installation Guide with copyable Google Apps Script code
- [x] Google Apps Script files (Code.gs, DocumentService.gs, CommentService.gs, ApiService.gs, Sidebar.html)
- [x] Full test coverage - 100% backend and frontend

## Prioritized Backlog
### P0 (Done)
- Core RCA analysis with OpenAI
- Executive summary generation
- Inline comment generation
- Chat feature
- Installation guide

### P1
- Actual Google Docs deployment testing
- Drive API comment integration (currently uses document properties)
- Re-run idempotency testing in real Google Docs

### P2
- Score trend tracking across multiple RCA reviews
- Export analysis results
- Custom evaluation dimension weights
