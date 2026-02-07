# API Reference

Base URL: `https://pensivedev-production.up.railway.app`

## Endpoints

### GET /api/health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "rca-reviewer-api"
}
```

---

### POST /api/analyze-rca

Analyzes an RCA document and returns scores, inline comments, and executive summary.

**Request Body:**
```json
{
  "document_text": "Full text of the RCA document",
  "existing_issues": [
    {
      "issue_id": "abc-123",
      "issue_type": "Weak root cause",
      "anchor_text": "quoted text",
      "resolved": false
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `document_text` | string | Yes | Full RCA document text |
| `existing_issues` | array | No | Previously identified issues (for deduplication) |

**Response:**
```json
{
  "analysis_id": "uuid-string",
  "score": {
    "incident_clarity": { "score": 4, "rationale": "Clear description..." },
    "timeline_completeness": { "score": 3, "rationale": "..." },
    "root_cause_depth": { "score": 2, "rationale": "..." },
    "detection_alerting": { "score": 1, "rationale": "..." },
    "corrective_actions": { "score": 3, "rationale": "..." },
    "learnings_quality": { "score": 2, "rationale": "..." }
  },
  "total_score": 15,
  "comments": [
    {
      "issue_id": "unique-id",
      "issue_type": "Weak root cause",
      "anchor_text": "exact text from document",
      "comment_body": "[Weak root cause]\nExplanation...\nRecommendation: ...",
      "resolved": false
    }
  ],
  "executive_summary": {
    "overall_interpretation": "One line summary",
    "leadership_bullets": ["bullet1", "bullet2", "bullet3"],
    "key_gaps": ["gap1", "gap2", "gap3"],
    "recurrence_risk": "Medium",
    "recurrence_rationale": "One line rationale",
    "action_critique": "Paragraph about action items",
    "improvements": ["improvement1", "improvement2", "improvement3"]
  },
  "timestamp": "2026-01-15T14:30:00+00:00"
}
```

---

### POST /api/chat

Send a chat message with document context.

**Request Body:**
```json
{
  "message": "Summarize this RCA for leadership",
  "document_context": "Full RCA text (optional)",
  "session_id": "existing-session-id (optional)"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | User's message |
| `document_context` | string | No | RCA document text for context |
| `session_id` | string | No | Session ID for conversation continuity |

**Response:**
```json
{
  "reply": "AI response text",
  "session_id": "uuid-string"
}
```

---

### POST /api/process-reply

Process a user's reply to an inline comment thread.

**Request Body:**
```json
{
  "thread_context": "Full thread context",
  "user_reply": "User's reply text",
  "issue_type": "Weak root cause",
  "original_comment": "Original AI comment text"
}
```

**Response:**
```json
{
  "reply": "AI response to the user's reply"
}
```

---

### GET /api/analyses

Get recent analysis results (requires MongoDB).

**Response:**
```json
[
  {
    "analysis_id": "uuid",
    "total_score": 15,
    "timestamp": "2026-01-15T14:30:00+00:00",
    "...": "full analysis object"
  }
]
```

---

### GET /api/chat-history/{session_id}

Get chat history for a session (requires MongoDB).

**Response:**
```json
[
  {
    "session_id": "uuid",
    "role": "user",
    "content": "message text",
    "created_at": "2026-01-15T14:30:00+00:00"
  }
]
```

## Error Handling

All endpoints return standard HTTP error codes:

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (empty text, missing fields) |
| 500 | Server error (LLM failure, unexpected error) |

Error response format:
```json
{
  "detail": "Error description"
}
```

## Rate Limits

- OpenAI GPT-4o: Subject to your API key's rate limits
- No backend rate limiting applied (add-on is single-user)
