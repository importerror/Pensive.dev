# RCA Reviewer - Google Docs Add-on

An AI-powered Root Cause Analysis reviewer that works inside Google Docs. It analyzes RCA documents using Amazon-style review criteria and provides inline comments with actionable feedback.

## What It Does

1. Engineer writes an RCA in Google Docs
2. Opens the RCA Reviewer sidebar from Extensions menu
3. Clicks **Run RCA Review**
4. The tool analyzes the document and inserts real Google Docs comments anchored to specific text
5. Sidebar shows score (/30), top improvements, and a global chat for follow-up questions

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend API | Python FastAPI |
| LLM | OpenAI GPT-4o |
| Database | MongoDB Atlas (optional, for chat persistence) |
| Add-on | Google Apps Script + HTML Sidebar |
| Frontend Preview | React.js |
| Hosting | Railway (backend) |

## Quick Links

- [Architecture](./ARCHITECTURE.md)
- [Setup Guide](./SETUP.md)
- [Apps Script Reference](./APPS_SCRIPT.md)
- [API Reference](./API.md)
