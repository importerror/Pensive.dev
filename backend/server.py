import os
import json
import uuid
from datetime import datetime, timezone
from typing import Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
from openai import AsyncOpenAI

import certifi
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI(title="RCA Reviewer API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

mongo_url = os.environ.get("MONGO_URL", "")
try:
    client = AsyncIOMotorClient(mongo_url, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=5000)
    db = client[os.environ.get("DB_NAME", "rca_reviewer")]
    db_available = True
except Exception:
    db_available = False
    db = None

openai_client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

ISSUE_TYPES = [
    "Causality gap", "Weak root cause", "Missing detection",
    "Timeline gap", "Action item not preventive", "Vague ownership", "Missing section"
]

EVAL_DIMENSIONS = [
    "Incident clarity & impact", "Timeline completeness",
    "Root cause depth (systemic vs proximate)", "Detection & alerting rigor",
    "Corrective action quality", "Learnings quality"
]

SYSTEM_PROMPT_ANALYZE = """You are an expert Amazon-style RCA (Root Cause Analysis) reviewer. You review RCA documents written by engineers and provide rigorous, actionable feedback.

You evaluate RCAs on 6 dimensions, each scored 0-5:
1. Incident clarity & impact - Is the incident clearly described with customer impact?
2. Timeline completeness - Is there a clear, detailed timeline?
3. Root cause depth (systemic vs proximate) - Does the root cause go beyond the trigger to systemic issues?
4. Detection & alerting rigor - Are detection mechanisms and alerting expectations documented?
5. Corrective action quality - Are action items preventive (not just reactive)?
6. Learnings quality - Are learnings meaningful and actionable?

For inline comments, use ONLY these issue types:
- Causality gap
- Weak root cause
- Missing detection
- Timeline gap
- Action item not preventive
- Vague ownership
- Missing section

Each comment MUST follow this format:
[Issue Type]
Explanation of what is weak or missing.
Recommendation: Specific guidance on how to improve.

You must respond in valid JSON only. No markdown, no extra text."""

SYSTEM_PROMPT_CHAT = """You are an expert RCA reviewer assistant. You help engineers improve their Root Cause Analysis documents by providing professional, direct feedback. You can:
- Summarize RCAs for leadership
- Identify systemic issues
- Evaluate whether action items are preventive
- Suggest improvements

Rules:
- No emojis
- No soft language
- Professional, direct tone
- Reference specific parts of the RCA when possible"""


class AnalyzeRequest(BaseModel):
    document_text: str
    existing_issues: Optional[list] = None


class ChatRequest(BaseModel):
    message: str
    document_context: Optional[str] = None
    session_id: Optional[str] = None


class ReplyRequest(BaseModel):
    thread_context: str
    user_reply: str
    issue_type: str
    original_comment: str


class AnalyzeResponse(BaseModel):
    score: dict
    total_score: int
    comments: list
    executive_summary: dict
    timestamp: str


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "rca-reviewer-api"}


@app.post("/api/analyze-rca")
async def analyze_rca(req: AnalyzeRequest):
    if not req.document_text.strip():
        raise HTTPException(400, "Document text is empty")

    existing_ids = []
    if req.existing_issues:
        existing_ids = [i.get("issue_id") for i in req.existing_issues if i.get("issue_id")]

    prompt = f"""Analyze the following RCA document and provide:

1. Scores for each of the 6 evaluation dimensions (0-5 each)
2. Inline comments anchored to specific text excerpts
3. An executive summary

Existing issue IDs to preserve (update if still relevant, mark resolved if fixed): {json.dumps(existing_ids)}

RCA Document:
---
{req.document_text}
---

Respond with this exact JSON structure:
{{
  "scores": {{
    "incident_clarity": {{"score": 0, "rationale": "..."}},
    "timeline_completeness": {{"score": 0, "rationale": "..."}},
    "root_cause_depth": {{"score": 0, "rationale": "..."}},
    "detection_alerting": {{"score": 0, "rationale": "..."}},
    "corrective_actions": {{"score": 0, "rationale": "..."}},
    "learnings_quality": {{"score": 0, "rationale": "..."}}
  }},
  "comments": [
    {{
      "issue_id": "unique-id-string",
      "issue_type": "one of the 7 issue types",
      "anchor_text": "exact text from the RCA to anchor the comment to",
      "comment_body": "[Issue Type]\\nExplanation...\\nRecommendation: ...",
      "resolved": false
    }}
  ],
  "executive_summary": {{
    "overall_interpretation": "one line interpretation",
    "leadership_bullets": ["bullet1", "bullet2", "bullet3", "bullet4", "bullet5"],
    "key_gaps": ["gap1", "gap2", "gap3"],
    "recurrence_risk": "Low|Medium|High",
    "recurrence_rationale": "one line rationale",
    "action_critique": "paragraph about action items",
    "improvements": ["improvement1", "improvement2", "improvement3"]
  }}
}}"""

    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_ANALYZE},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        result = json.loads(response.choices[0].message.content)
    except Exception as e:
        raise HTTPException(500, f"LLM analysis failed: {str(e)}")

    scores = result.get("scores", {})
    total = sum(s.get("score", 0) for s in scores.values())

    timestamp = datetime.now(timezone.utc).isoformat()

    analysis = {
        "analysis_id": str(uuid.uuid4()),
        "score": scores,
        "total_score": total,
        "comments": result.get("comments", []),
        "executive_summary": result.get("executive_summary", {}),
        "timestamp": timestamp
    }

    try:
        if db is not None:
            await db.analyses.insert_one({**analysis, "_id_str": analysis["analysis_id"]})
    except Exception as e:
        logger.warning(f"DB write failed (non-critical): {e}")

    return analysis


@app.post("/api/chat")
async def chat_rca(req: ChatRequest):
    if not req.message.strip():
        raise HTTPException(400, "Message is empty")

    session_id = req.session_id or str(uuid.uuid4())

    history = []
    try:
        if db is not None:
            cursor = db.chat_messages.find(
                {"session_id": session_id},
                {"_id": 0}
            ).sort("created_at", 1).limit(20)
            async for msg in cursor:
                history.append({"role": msg["role"], "content": msg["content"]})
    except Exception as e:
        logger.warning(f"DB read failed (non-critical): {e}")

    messages = [{"role": "system", "content": SYSTEM_PROMPT_CHAT}]

    if req.document_context:
        messages.append({
            "role": "system",
            "content": f"Current RCA document context:\n---\n{req.document_context}\n---"
        })

    messages.extend(history)
    messages.append({"role": "user", "content": req.message})

    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=0.4
        )
        reply = response.choices[0].message.content
    except Exception as e:
        raise HTTPException(500, f"Chat failed: {str(e)}")

    now = datetime.now(timezone.utc).isoformat()
    await db.chat_messages.insert_many([
        {"session_id": session_id, "role": "user", "content": req.message, "created_at": now},
        {"session_id": session_id, "role": "assistant", "content": reply, "created_at": now}
    ])

    return {"reply": reply, "session_id": session_id}


@app.post("/api/process-reply")
async def process_reply(req: ReplyRequest):
    if not req.user_reply.strip():
        raise HTTPException(400, "Reply is empty")

    prompt = f"""You are reviewing an RCA document. A user replied to your inline comment.

Original comment:
{req.original_comment}

Issue type: {req.issue_type}

Thread context:
{req.thread_context}

User's reply:
{req.user_reply}

Provide a professional, direct response. If the user has addressed the issue, acknowledge it. If not, provide specific guidance. No emojis. No soft language."""

    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_CHAT},
                {"role": "user", "content": prompt}
            ],
            temperature=0.4
        )
        return {"reply": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(500, f"Reply processing failed: {str(e)}")


@app.get("/api/analyses")
async def get_analyses():
    analyses = []
    cursor = db.analyses.find({}, {"_id": 0}).sort("timestamp", -1).limit(10)
    async for doc in cursor:
        analyses.append(doc)
    return analyses


@app.get("/api/chat-history/{session_id}")
async def get_chat_history(session_id: str):
    messages = []
    cursor = db.chat_messages.find(
        {"session_id": session_id},
        {"_id": 0}
    ).sort("created_at", 1)
    async for msg in cursor:
        messages.append(msg)
    return messages
