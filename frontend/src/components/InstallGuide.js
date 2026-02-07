import React, { useState } from 'react';

const GS_FILES = {
  'Code.gs': `/**
 * RCA Reviewer - Google Docs Add-on
 */

function onOpen(e) {
  DocumentApp.getUi()
    .createAddonMenu()
    .addItem('Open RCA Reviewer', 'showSidebar')
    .addItem('Apply Comments', 'applyComments')
    .addToUi();
}

function onInstall(e) { onOpen(e); }

function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('RCA Reviewer').setWidth(360);
  DocumentApp.getUi().showSidebar(html);
}

/**
 * Called from sidebar. Does API analysis only, stores result.
 */
function runReview() {
  var doc = DocumentApp.getActiveDocument();
  var rcaText = doc.getBody().getText();
  if (!rcaText.trim()) return { error: 'Document is empty.' };

  var analysis = callBackendAPI('/api/analyze-rca', {
    document_text: rcaText,
    existing_issues: []
  });

  if (analysis.error) return { error: analysis.error };

  // Store analysis for comment creation
  PropertiesService.getDocumentProperties().setProperty(
    'pending_analysis', JSON.stringify(analysis)
  );

  return analysis;
}

/**
 * Called from sidebar after results display, or from Extensions menu.
 * Creates real Google Docs comments using Drive API v3.
 */
function applyComments() {
  var props = PropertiesService.getDocumentProperties();
  var raw = props.getProperty('pending_analysis');
  if (!raw) return { created: 0, total: 0, error: 'No analysis found. Run review first.' };

  var analysis = JSON.parse(raw);
  var doc = DocumentApp.getActiveDocument();
  var docId = doc.getId();
  var comments = analysis.comments || [];
  var created = 0;
  var errors = [];

  for (var i = 0; i < comments.length; i++) {
    // Re-read document text each iteration to stay in sync
    var rcaText = DocumentApp.getActiveDocument().getBody().getText();
    var c = comments[i];
    if (!c.anchor_text || !c.comment_body) continue;

    var anchor = c.anchor_text.trim();

    // Find anchor in document
    if (rcaText.indexOf(anchor) === -1) {
      // Try shorter match
      var words = anchor.split(/\\s+/);
      var matched = false;
      for (var len = Math.min(words.length, 10); len >= 3; len--) {
        var attempt = words.slice(0, len).join(' ');
        if (rcaText.indexOf(attempt) !== -1) {
          anchor = attempt;
          matched = true;
          break;
        }
      }
      if (!matched) {
        errors.push(c.issue_type + ': no match');
        continue;
      }
    }

    try {
      Drive.Comments.create(
        {
          content: c.comment_body,
          quotedFileContent: { mimeType: 'text/plain', value: anchor }
        },
        docId,
        { fields: 'id' }
      );
      created++;
      // Wait between comments to let Google Docs sync
      Utilities.sleep(1500);
    } catch (e) {
      errors.push(c.issue_type + ': ' + e.toString());
    }
  }

  return { created: created, total: comments.length, errors: errors };
}

/**
 * Send a chat message
 */
function sendChatMessage(message) {
  var doc = DocumentApp.getActiveDocument();
  var props = PropertiesService.getDocumentProperties();
  var sessionId = props.getProperty('chat_session_id') || '';
  var result = callBackendAPI('/api/chat', {
    message: message,
    document_context: doc.getBody().getText(),
    session_id: sessionId
  });
  if (result.session_id) props.setProperty('chat_session_id', result.session_id);
  return result;
}`,

  'ApiService.gs': `/**
 * Backend API communication
 */
var API_BASE_URL = 'https://pensivedev-production.up.railway.app';

function callBackendAPI(endpoint, payload) {
  try {
    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      headers: { 'Accept': 'application/json' }
    };
    var response = UrlFetchApp.fetch(API_BASE_URL + endpoint, options);
    var code = response.getResponseCode();
    if (code === 200) {
      return JSON.parse(response.getContentText());
    } else {
      return { error: 'API failed with status ' + code };
    }
  } catch (e) {
    return { error: 'Connection failed: ' + e.toString() };
  }
}`,

  'Sidebar.html': `<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Google Sans', 'Roboto', -apple-system, sans-serif; color: #202124; font-size: 13px; line-height: 1.5; }
    .container { padding: 16px; }
    .header { margin-bottom: 16px; }
    .header h1 { font-size: 16px; font-weight: 500; }
    .header p { font-size: 12px; color: #5f6368; margin-top: 2px; }
    .tabs { display: flex; border-bottom: 1px solid #dadce0; margin-bottom: 16px; }
    .tab { flex: 1; text-align: center; padding: 8px; font-size: 13px; font-weight: 500; color: #5f6368; cursor: pointer; border: none; border-bottom: 2px solid transparent; background: none; }
    .tab:hover { color: #202124; }
    .tab.active { color: #1a73e8; border-bottom-color: #1a73e8; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .idle-state { text-align: center; padding: 32px 16px; }
    .idle-icon { width: 56px; height: 56px; border-radius: 50%; background: #e8f0fe; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
    .idle-state h2 { font-size: 16px; font-weight: 500; margin-bottom: 8px; }
    .idle-state p { color: #5f6368; margin-bottom: 20px; line-height: 1.5; }
    .btn-primary { font-family: inherit; font-size: 14px; font-weight: 500; padding: 10px 24px; border-radius: 24px; border: none; cursor: pointer; background: #1a73e8; color: white; display: inline-flex; align-items: center; gap: 8px; }
    .btn-primary:hover { background: #1557b0; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { font-family: inherit; font-size: 14px; font-weight: 500; padding: 10px 24px; border-radius: 24px; border: 1px solid #dadce0; cursor: pointer; background: white; color: #1a73e8; width: 100%; justify-content: center; display: flex; align-items: center; gap: 8px; }
    .btn-secondary:hover { background: #e8f0fe; }
    .btn-text { font-size: 13px; font-weight: 500; color: #1a73e8; background: none; border: none; cursor: pointer; padding: 6px 12px; }
    .btn-text:hover { background: #e8f0fe; border-radius: 4px; }
    .spinner { width: 28px; height: 28px; border: 3px solid #e8eaed; border-top-color: #1a73e8; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 8px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .progress-steps { display: flex; flex-direction: column; gap: 12px; margin-top: 20px; }
    .step { display: flex; align-items: center; gap: 10px; color: #9aa0a6; font-size: 13px; }
    .step.active { color: #202124; font-weight: 500; }
    .step.done { color: #188038; }
    .step-dot { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #dadce0; flex-shrink: 0; }
    .step.active .step-dot { border-color: #1a73e8; background: #1a73e8; }
    .step.done .step-dot { border-color: #188038; background: #188038; }
    .score-card { text-align: center; padding: 16px; background: #f8f9fa; border-radius: 12px; margin-bottom: 16px; }
    .score-number { font-size: 42px; font-weight: 500; line-height: 1; }
    .score-max { font-size: 18px; color: #5f6368; }
    .score-label { font-size: 11px; color: #5f6368; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .score-low { color: #d93025; }
    .score-mid { color: #f9ab00; }
    .score-high { color: #188038; }
    .score-interp { font-size: 13px; color: #5f6368; margin-top: 8px; line-height: 1.4; }
    .improvement-list { list-style: none; display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .improvement-item { font-size: 12px; padding: 8px 10px; background: #f8f9fa; border-radius: 6px; border-left: 3px solid #1a73e8; color: #5f6368; }
    .actions { display: flex; flex-direction: column; gap: 8px; }
    .comment-status { font-size: 12px; padding: 8px; border-radius: 6px; margin-top: 8px; text-align: center; }
    .comment-status.success { background: #e6f4ea; color: #188038; }
    .comment-status.pending { background: #e8f0fe; color: #1a73e8; }
    .comment-status.error { background: #fce8e6; color: #d93025; }
    .chat-messages { overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding: 4px 0; max-height: 400px; }
    .msg { display: flex; flex-direction: column; gap: 2px; }
    .msg-role { font-size: 10px; font-weight: 500; color: #5f6368; text-transform: uppercase; }
    .msg-content { font-size: 13px; padding: 8px 12px; border-radius: 12px; line-height: 1.5; }
    .msg.user .msg-content { background: #1a73e8; color: white; border-bottom-right-radius: 4px; align-self: flex-end; }
    .msg.assistant .msg-content { background: #f1f3f4; border-bottom-left-radius: 4px; }
    .chat-input-row { display: flex; gap: 6px; padding-top: 10px; border-top: 1px solid #dadce0; margin-top: 10px; }
    .chat-input { flex: 1; font-size: 13px; padding: 8px 12px; border: 1px solid #dadce0; border-radius: 20px; outline: none; }
    .chat-input:focus { border-color: #1a73e8; }
    .send-btn { width: 32px; height: 32px; border-radius: 50%; border: none; background: #1a73e8; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .suggestions { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
    .suggestion { font-size: 12px; color: #1a73e8; background: none; border: none; text-align: left; cursor: pointer; padding: 4px 8px; }
    .suggestion:hover { background: #e8f0fe; border-radius: 4px; }
    .info-link { font-size: 13px; color: #1a73e8; cursor: pointer; margin-top: 12px; display: inline-block; }
    .error-msg { color: #d93025; font-size: 13px; padding: 8px; background: #fce8e6; border-radius: 6px; margin-top: 8px; display: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>RCA Reviewer</h1><p>Google Docs Add-on</p></div>
    <div class="tabs" id="tabs" style="display:none;">
      <button class="tab active" onclick="switchTab('review')">Review</button>
      <button class="tab" onclick="switchTab('chat')">Global Chat</button>
    </div>

    <!-- IDLE -->
    <div id="state-idle">
      <div class="idle-state">
        <div class="idle-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
        </div>
        <h2>RCA Reviewer</h2>
        <p>Analyze your RCA with Amazon-style review criteria. Get inline comments and a quality score.</p>
        <button class="btn-primary" onclick="startReview()">Run RCA Review</button>
        <br><span class="info-link" onclick="toggleHow()">How this works</span>
        <div id="how-content" style="display:none;margin-top:12px;text-align:left;line-height:1.7;">
          <p>1. Write your RCA in the document</p>
          <p>2. Click "Run RCA Review"</p>
          <p>3. AI scores 6 dimensions (total /30)</p>
          <p>4. Click "Apply Comments" to add inline feedback</p>
          <p>5. Use Global Chat for follow-up questions</p>
        </div>
      </div>
    </div>

    <!-- PROGRESS -->
    <div id="state-progress" style="display:none;">
      <div style="text-align:center;">
        <div class="spinner"></div>
        <p style="font-weight:500;">Analyzing your RCA...</p>
      </div>
      <div class="progress-steps">
        <div class="step" id="step-0"><div class="step-dot"></div><span>Analyzing incident summary</span></div>
        <div class="step" id="step-1"><div class="step-dot"></div><span>Reviewing timeline and causality</span></div>
        <div class="step" id="step-2"><div class="step-dot"></div><span>Evaluating action items</span></div>
        <div class="step" id="step-3"><div class="step-dot"></div><span>Generating feedback</span></div>
      </div>
    </div>

    <!-- RESULTS -->
    <div id="state-results" style="display:none;">
      <div id="tab-review" class="tab-content active">
        <div class="score-card">
          <div class="score-number" id="score-value">0<span class="score-max"> / 30</span></div>
          <div class="score-label">RCA Quality Score</div>
          <div class="score-interp" id="score-interp"></div>
        </div>
        <h4 style="font-size:13px;font-weight:500;margin-bottom:8px;">Top Improvements</h4>
        <ul class="improvement-list" id="improvements"></ul>
        <div id="comment-status" class="comment-status pending">Click below to add comments to your document</div>
        <div class="actions">
          <button class="btn-primary" id="apply-btn" onclick="doApplyComments()" style="width:100%;justify-content:center;">Apply Comments to Document</button>
          <button class="btn-secondary" onclick="switchTab('chat')">Open Global RCA Chat</button>
          <button class="btn-text" onclick="startReview()" style="width:100%;text-align:center;">Re-run Review</button>
        </div>
      </div>
      <div id="tab-chat" class="tab-content">
        <div class="chat-messages" id="chat-messages">
          <div style="text-align:center;color:#5f6368;padding:16px 0;">
            <p>Ask about your RCA:</p>
            <div class="suggestions">
              <button class="suggestion" onclick="prefillChat('Summarize this RCA for leadership')">Summarize this RCA for leadership</button>
              <button class="suggestion" onclick="prefillChat('What systemic issues do you see?')">What systemic issues do you see?</button>
              <button class="suggestion" onclick="prefillChat('Are action items preventive?')">Are action items preventive?</button>
            </div>
          </div>
        </div>
        <div class="chat-input-row">
          <input class="chat-input" id="chat-input" placeholder="Ask about this RCA..." onkeydown="if(event.key==='Enter')sendChat()">
          <button class="send-btn" onclick="sendChat()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>

    <div id="error-msg" class="error-msg"></div>
  </div>

  <script>
    function setState(s) {
      document.getElementById('state-idle').style.display = s === 'idle' ? 'block' : 'none';
      document.getElementById('state-progress').style.display = s === 'progress' ? 'block' : 'none';
      document.getElementById('state-results').style.display = s === 'results' ? 'block' : 'none';
      document.getElementById('tabs').style.display = s === 'results' ? 'flex' : 'none';
    }

    function switchTab(t) {
      document.querySelectorAll('.tab').forEach(function(e) { e.classList.remove('active'); });
      document.querySelectorAll('.tab-content').forEach(function(e) { e.classList.remove('active'); });
      if (t === 'review') {
        document.querySelectorAll('.tab')[0].classList.add('active');
        document.getElementById('tab-review').classList.add('active');
      } else {
        document.querySelectorAll('.tab')[1].classList.add('active');
        document.getElementById('tab-chat').classList.add('active');
      }
    }

    function toggleHow() {
      var e = document.getElementById('how-content');
      e.style.display = e.style.display === 'none' ? 'block' : 'none';
    }

    function setStep(n) {
      for (var i = 0; i < 4; i++) {
        var e = document.getElementById('step-' + i);
        e.className = 'step' + (i < n ? ' done' : '') + (i === n ? ' active' : '');
      }
    }

    function startReview() {
      setState('progress');
      setStep(0);
      hideError();
      setTimeout(function() { setStep(1); }, 800);
      setTimeout(function() { setStep(2); }, 1600);
      setTimeout(function() { setStep(3); }, 2400);
      google.script.run
        .withSuccessHandler(onReviewSuccess)
        .withFailureHandler(onReviewError)
        .runReview();
    }

    function onReviewSuccess(r) {
      if (r.error) { showError(r.error); setState('idle'); return; }
      displayResults(r);
      setState('results');
    }

    function onReviewError(e) {
      showError('Review failed: ' + e.message);
      setState('idle');
    }

    function displayResults(d) {
      var t = d.total_score || 0;
      var el = document.getElementById('score-value');
      var c = t <= 10 ? 'score-low' : t <= 20 ? 'score-mid' : 'score-high';
      el.className = 'score-number ' + c;
      el.innerHTML = t + '<span class="score-max"> / 30</span>';
      var es = d.executive_summary || {};
      document.getElementById('score-interp').textContent = es.overall_interpretation || '';
      var l = document.getElementById('improvements');
      l.innerHTML = '';
      (es.improvements || []).slice(0, 3).forEach(function(imp) {
        var li = document.createElement('li');
        li.className = 'improvement-item';
        li.textContent = imp;
        l.appendChild(li);
      });
      // Reset comment status
      var cs = document.getElementById('comment-status');
      cs.className = 'comment-status pending';
      cs.textContent = 'Click below to add comments to your document';
      document.getElementById('apply-btn').disabled = false;
    }

    function doApplyComments() {
      var btn = document.getElementById('apply-btn');
      var cs = document.getElementById('comment-status');
      btn.disabled = true;
      btn.textContent = 'Applying comments...';
      cs.className = 'comment-status pending';
      cs.textContent = 'Creating comments... this may take a moment.';

      google.script.run
        .withSuccessHandler(function(r) {
          if (r.error) {
            cs.className = 'comment-status error';
            cs.textContent = r.error;
            btn.disabled = false;
            btn.textContent = 'Apply Comments to Document';
            return;
          }
          cs.className = 'comment-status success';
          cs.textContent = 'Added ' + r.created + ' of ' + r.total + ' comments. Reload page to see them.';
          btn.textContent = 'Comments Applied';
          if (r.errors && r.errors.length > 0) {
            cs.textContent += ' (' + r.errors.length + ' skipped)';
          }
        })
        .withFailureHandler(function(e) {
          cs.className = 'comment-status error';
          cs.textContent = 'Failed: ' + e.message;
          btn.disabled = false;
          btn.textContent = 'Apply Comments to Document';
        })
        .applyComments();
    }

    function prefillChat(t) { document.getElementById('chat-input').value = t; }

    function sendChat() {
      var input = document.getElementById('chat-input');
      var m = input.value.trim();
      if (!m) return;
      appendMessage('user', m);
      input.value = '';
      google.script.run
        .withSuccessHandler(function(r) {
          if (r.reply) appendMessage('assistant', r.reply);
          else if (r.error) appendMessage('assistant', 'Error: ' + r.error);
        })
        .withFailureHandler(function(e) {
          appendMessage('assistant', 'Failed: ' + e.message);
        })
        .sendChatMessage(m);
    }

    function appendMessage(role, content) {
      var c = document.getElementById('chat-messages');
      if (c.querySelector('.suggestions')) c.innerHTML = '';
      var d = document.createElement('div');
      d.className = 'msg ' + role;
      d.innerHTML = '<span class="msg-role">' + (role === 'user' ? 'You' : 'RCA Reviewer') + '</span><div class="msg-content">' + escapeHtml(content) + '</div>';
      c.appendChild(d);
      c.scrollTop = c.scrollHeight;
    }

    function escapeHtml(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

    function showError(m) {
      var e = document.getElementById('error-msg');
      e.textContent = m;
      e.style.display = 'block';
    }

    function hideError() { document.getElementById('error-msg').style.display = 'none'; }
  </script>
</body>
</html>`,

  'appsscript.json': `{
  "timeZone": "America/New_York",
  "dependencies": {
    "enabledAdvancedServices": [
      {
        "userSymbol": "Drive",
        "version": "v3",
        "serviceId": "drive"
      }
    ]
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.container.ui"
  ]
}`
};

function InstallGuide() {
  const [activeFile, setActiveFile] = useState('Code.gs');
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = GS_FILES[activeFile];
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      try {
        navigator.clipboard.writeText(GS_FILES[activeFile]).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      } catch (err) {
        console.warn('Copy failed:', err);
      }
    }
  };

  const fileNames = Object.keys(GS_FILES);

  return (
    <div className="doc-area" data-testid="install-guide">
      <div className="doc-card">
        <div className="doc-body" style={{ maxWidth: 800 }}>
          <h2 style={{ marginBottom: 8 }}>Installation Guide</h2>
          <p style={{ color: 'var(--google-grey-500)', marginBottom: 32 }}>
            Set up the RCA Reviewer add-on in your Google Docs. Only 4 files needed.
          </p>

          <div className="guide-section">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--google-blue)" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
              Setup Steps
            </h3>

            {[
              { num: 1, text: 'Open your Google Doc > Extensions > Apps Script' },
              { num: 2, text: 'Delete default Code.gs and paste the Code.gs below' },
              { num: 3, text: 'Create a new script file "ApiService" and paste ApiService.gs' },
              { num: 4, text: 'Create a new HTML file "Sidebar" (no .html) and paste Sidebar.html' },
              { num: 5, text: 'Click "+" next to Services > add Drive API v3' },
              { num: 6, text: 'Update appsscript.json (gear icon > Show manifest > replace content)' },
              { num: 7, text: 'Save, reload Google Doc, go to Extensions > RCA Reviewer > Open RCA Reviewer' },
            ].map(step => (
              <div key={step.num} className="guide-step" data-testid={`guide-step-${step.num}`}>
                <div className="guide-step-num">{step.num}</div>
                <div className="guide-step-content">{step.text}</div>
              </div>
            ))}
          </div>

          <div className="guide-section">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--google-blue)" strokeWidth="2">
                <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
              </svg>
              Source Code (4 files only)
            </h3>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {fileNames.map(name => (
                <button
                  key={name}
                  className={`topbar-nav-btn ${activeFile === name ? 'active' : ''}`}
                  onClick={() => setActiveFile(name)}
                  data-testid={`code-file-btn-${name.replace('.', '-')}`}
                >
                  {name}
                </button>
              ))}
            </div>

            <div className="code-block" data-testid="code-block">
              <div className="code-block-header">
                <span className="code-block-filename">{activeFile}</span>
                <button className="code-copy-btn" onClick={copyCode} data-testid="copy-code-btn">
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {GS_FILES[activeFile]}
              </pre>
            </div>
          </div>

          <div className="guide-section">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--google-blue)" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              How It Works
            </h3>
            <p style={{ fontSize: 14, color: 'var(--google-grey-700)', lineHeight: 1.6 }}>
              <strong>Step 1:</strong> Click "Run RCA Review" — analyzes your document with GPT-4o and shows score + improvements.<br/>
              <strong>Step 2:</strong> Click "Apply Comments to Document" — creates real Google Docs comments anchored to specific text.<br/>
              <strong>Step 3:</strong> Reload the page to see all comments in the document.<br/>
              <strong>Chat:</strong> Use Global Chat to ask follow-up questions about your RCA.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InstallGuide;
