import React, { useState } from 'react';

const GS_FILES = {
  'Code.gs': `/**
 * RCA Reviewer - Google Docs Add-on
 * Main entry point
 */

function onOpen(e) {
  DocumentApp.getUi()
    .createAddonMenu()
    .addItem('Open RCA Reviewer', 'showSidebar')
    .addToUi();
}

function onInstall(e) {
  onOpen(e);
}

function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('RCA Reviewer')
    .setWidth(360);
  DocumentApp.getUi().showSidebar(html);
}

/**
 * Run the RCA review analysis
 */
function runReview() {
  var doc = DocumentApp.getActiveDocument();
  var body = doc.getBody();
  var rcaText = body.getText();
  
  if (!rcaText.trim()) {
    return { error: 'Document is empty. Please write your RCA content first.' };
  }
  
  // Get existing issue tracking
  var props = PropertiesService.getDocumentProperties();
  var existingIssues = JSON.parse(props.getProperty('rca_issues') || '[]');
  
  // Call backend API
  var analysis = callBackendAPI('/api/analyze-rca', {
    document_text: rcaText,
    existing_issues: existingIssues
  });
  
  if (analysis.error) {
    return { error: analysis.error };
  }
  
  // Insert inline comments in document
  insertComments(doc, body, analysis.comments, existingIssues);
  
  // Create/update RCA Summary tab
  generateReviewTab(doc, analysis);
  
  // Store issue tracking
  props.setProperty('rca_issues', JSON.stringify(analysis.comments));
  props.setProperty('last_analysis', JSON.stringify(analysis));
  
  return analysis;
}

/**
 * Process a reply in a comment thread
 */
function processReply(threadContext, userReply, issueType, originalComment) {
  var result = callBackendAPI('/api/process-reply', {
    thread_context: threadContext,
    user_reply: userReply,
    issue_type: issueType,
    original_comment: originalComment
  });
  return result;
}

/**
 * Send a chat message
 */
function sendChatMessage(message) {
  var doc = DocumentApp.getActiveDocument();
  var rcaTab = findOrCreateTab(doc, 'RCA');
  var rcaText = rcaTab ? rcaTab.asDocumentTab().getBody().getText() : '';
  
  var props = PropertiesService.getDocumentProperties();
  var sessionId = props.getProperty('chat_session_id') || '';
  
  var result = callBackendAPI('/api/chat', {
    message: message,
    document_context: rcaText,
    session_id: sessionId
  });
  
  if (result.session_id) {
    props.setProperty('chat_session_id', result.session_id);
  }
  
  return result;
}`,

  'DocumentService.gs': `/**
 * Document Tab management
 */

function findOrCreateTab(doc, tabName) {
  var tabs = doc.getTabs();
  for (var i = 0; i < tabs.length; i++) {
    if (tabs[i].getTitle() === tabName) {
      return tabs[i];
    }
  }
  return null;
}

function getOrCreateReviewTab(doc) {
  var tab = findOrCreateTab(doc, 'RCA Review');
  if (!tab) {
    tab = doc.addTab('RCA Review');
  }
  return tab;
}

function generateReviewTab(doc, analysis) {
  var tab = getOrCreateReviewTab(doc);
  var body = tab.asDocumentTab().getBody();
  
  // Clear existing content
  body.clear();
  
  var es = analysis.executive_summary;
  var totalScore = analysis.total_score;
  var timestamp = new Date().toLocaleString();
  
  // Header
  var title = body.appendParagraph('RCA Reviewer -- Executive Summary');
  title.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  title.setForegroundColor('#1a73e8');
  
  var subtitle = body.appendParagraph('Auto-generated. Updated on ' + timestamp + '.');
  subtitle.setForegroundColor('#5f6368');
  subtitle.setFontSize(10);
  
  body.appendParagraph('');
  
  // Section 1: Overall Assessment
  var s1 = body.appendParagraph('Section 1: Overall Assessment');
  s1.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  
  body.appendParagraph('RCA Quality Score: ' + totalScore + ' / 30').setBold(true);
  body.appendParagraph(es.overall_interpretation || '');
  body.appendParagraph('');
  
  // Section 2: Leadership Summary
  var s2 = body.appendParagraph('Section 2: Leadership Summary');
  s2.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  
  var bullets = es.leadership_bullets || [];
  for (var i = 0; i < Math.min(bullets.length, 5); i++) {
    body.appendListItem(bullets[i]).setGlyphType(DocumentApp.GlyphType.BULLET);
  }
  body.appendParagraph('');
  
  // Section 3: Key Gaps Identified
  var s3 = body.appendParagraph('Section 3: Key Gaps Identified');
  s3.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  
  var gaps = es.key_gaps || [];
  for (var i = 0; i < Math.min(gaps.length, 3); i++) {
    body.appendListItem(gaps[i]).setGlyphType(DocumentApp.GlyphType.NUMBER);
  }
  body.appendParagraph('');
  
  // Section 4: Recurrence Risk
  var s4 = body.appendParagraph('Section 4: Recurrence Risk');
  s4.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  
  body.appendParagraph(es.recurrence_risk || 'N/A').setBold(true);
  body.appendParagraph(es.recurrence_rationale || '');
  body.appendParagraph('');
  
  // Section 5: Action Items Critique
  var s5 = body.appendParagraph('Section 5: Action Items Critique');
  s5.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  
  body.appendParagraph(es.action_critique || '');
  body.appendParagraph('');
  
  // Section 6: What to Improve Next
  var s6 = body.appendParagraph('Section 6: What to Improve Next');
  s6.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  
  var improvements = es.improvements || [];
  for (var i = 0; i < improvements.length; i++) {
    body.appendListItem(improvements[i]).setGlyphType(DocumentApp.GlyphType.BULLET);
  }
}`,

  'CommentService.gs': `/**
 * Comment management for inline feedback
 */

function insertComments(doc, rcaBody, comments, existingIssues) {
  var existingMap = {};
  for (var i = 0; i < existingIssues.length; i++) {
    existingMap[existingIssues[i].issue_id] = existingIssues[i];
  }
  
  for (var i = 0; i < comments.length; i++) {
    var comment = comments[i];
    
    if (comment.resolved) {
      // If issue is resolved, optionally mark it
      continue;
    }
    
    var anchorText = comment.anchor_text;
    if (!anchorText) continue;
    
    // Find the text in the document
    var searchResult = rcaBody.findText(escapeRegex(anchorText));
    
    if (searchResult) {
      var element = searchResult.getElement();
      var start = searchResult.getStartOffset();
      var end = searchResult.getEndOffsetInclusive();
      
      // Highlight the text
      if (element.editAsText) {
        element.editAsText().setBackgroundColor(start, end, '#fce8b2');
      }
      
      // Note: Google Docs API for comments requires Drive API
      // In Apps Script, we use document-level comments via Drive
      addDocumentComment(doc, comment);
    }
  }
}

function addDocumentComment(doc, comment) {
  try {
    var docId = doc.getId();
    
    // Use Drive API to add comments
    // This requires the Drive API to be enabled
    var resource = {
      content: comment.comment_body,
      anchor: comment.anchor_text
    };
    
    // Store comment mapping for tracking
    var props = PropertiesService.getDocumentProperties();
    var commentMap = JSON.parse(props.getProperty('comment_map') || '{}');
    commentMap[comment.issue_id] = {
      issue_type: comment.issue_type,
      anchor_text: comment.anchor_text,
      comment_body: comment.comment_body,
      timestamp: new Date().toISOString()
    };
    props.setProperty('comment_map', JSON.stringify(commentMap));
    
  } catch (e) {
    Logger.log('Error adding comment: ' + e.toString());
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
}`,

  'ApiService.gs': `/**
 * Backend API communication
 */

var API_BASE_URL = 'https://pensivedev-production.up.railway.app'; // Your deployed backend URL

function callBackendAPI(endpoint, payload) {
  try {
    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      headers: {
        'Accept': 'application/json'
      }
    };
    
    var response = UrlFetchApp.fetch(API_BASE_URL + endpoint, options);
    var code = response.getResponseCode();
    
    if (code === 200) {
      return JSON.parse(response.getContentText());
    } else {
      Logger.log('API error: ' + code + ' - ' + response.getContentText());
      return { error: 'API request failed with status ' + code };
    }
    
  } catch (e) {
    Logger.log('API call failed: ' + e.toString());
    return { error: 'Failed to connect to backend: ' + e.toString() };
  }
}`,

  'Sidebar.html': `<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Google Sans', 'Roboto', -apple-system, sans-serif; color: #202124; font-size: 13px; line-height: 1.5; }
    .sidebar-container { padding: 16px; display: flex; flex-direction: column; min-height: 100vh; }
    .header { margin-bottom: 16px; }
    .header h1 { font-size: 16px; font-weight: 500; color: #202124; }
    .header p { font-size: 12px; color: #5f6368; margin-top: 2px; }
    .tabs { display: flex; border-bottom: 1px solid #dadce0; margin-bottom: 16px; }
    .tab { flex: 1; text-align: center; padding: 8px; font-size: 13px; font-weight: 500; color: #5f6368; cursor: pointer; border-bottom: 2px solid transparent; background: none; border-top: none; border-left: none; border-right: none; }
    .tab:hover { color: #202124; }
    .tab.active { color: #1a73e8; border-bottom-color: #1a73e8; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .idle-state { text-align: center; padding: 32px 16px; }
    .idle-icon { width: 56px; height: 56px; border-radius: 50%; background: #e8f0fe; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
    .idle-state h2 { font-size: 16px; font-weight: 500; margin-bottom: 8px; }
    .idle-state p { color: #5f6368; margin-bottom: 20px; line-height: 1.5; }
    .btn-primary { font-family: 'Google Sans', 'Roboto', sans-serif; font-size: 14px; font-weight: 500; padding: 10px 24px; border-radius: 24px; border: none; cursor: pointer; background: #1a73e8; color: white; display: inline-flex; align-items: center; gap: 8px; }
    .btn-primary:hover { background: #1557b0; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary { font-family: 'Google Sans', 'Roboto', sans-serif; font-size: 14px; font-weight: 500; padding: 10px 24px; border-radius: 24px; border: 1px solid #dadce0; cursor: pointer; background: white; color: #1a73e8; display: inline-flex; align-items: center; gap: 8px; width: 100%; justify-content: center; }
    .btn-secondary:hover { background: #e8f0fe; }
    .btn-text { font-size: 13px; font-weight: 500; color: #1a73e8; background: none; border: none; cursor: pointer; padding: 6px 12px; }
    .btn-text:hover { background: #e8f0fe; border-radius: 4px; }
    .progress-container { padding: 16px 0; }
    .progress-header { text-align: center; margin-bottom: 20px; }
    .spinner { width: 28px; height: 28px; border: 3px solid #e8eaed; border-top-color: #1a73e8; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 8px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .progress-steps { display: flex; flex-direction: column; gap: 12px; }
    .step { display: flex; align-items: center; gap: 10px; color: #9aa0a6; font-size: 13px; }
    .step.active { color: #202124; font-weight: 500; }
    .step.done { color: #188038; }
    .step-dot { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #dadce0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .step.active .step-dot { border-color: #1a73e8; background: #1a73e8; }
    .step.done .step-dot { border-color: #188038; background: #188038; }
    .score-card { text-align: center; padding: 16px; background: #f8f9fa; border-radius: 12px; margin-bottom: 16px; }
    .score-number { font-size: 42px; font-weight: 500; line-height: 1; }
    .score-max { font-size: 18px; color: #5f6368; }
    .score-label { font-size: 11px; color: #5f6368; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .score-low { color: #d93025; }
    .score-mid { color: #f9ab00; }
    .score-high { color: #188038; }
    .score-interpretation { font-size: 13px; color: #5f6368; margin-top: 8px; line-height: 1.4; }
    .improvement-list { list-style: none; display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .improvement-item { font-size: 12px; padding: 8px 10px; background: #f8f9fa; border-radius: 6px; border-left: 3px solid #1a73e8; color: #5f6368; }
    .actions { display: flex; flex-direction: column; gap: 8px; }
    .chat-area { display: flex; flex-direction: column; flex: 1; }
    .chat-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding: 4px 0; max-height: 400px; }
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
    .error { color: #d93025; font-size: 13px; padding: 8px; background: #fce8e6; border-radius: 6px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="sidebar-container">
    <div class="header"><h1>RCA Reviewer</h1><p>Google Docs Add-on</p></div>
    <div class="tabs" id="tabs" style="display: none;">
      <button class="tab active" onclick="switchTab('review')">Review</button>
      <button class="tab" onclick="switchTab('chat')">Global Chat</button>
    </div>
    <div id="state-idle">
      <div class="idle-state">
        <div class="idle-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
        </div>
        <h2>RCA Reviewer</h2>
        <p>Analyze your Root Cause Analysis with Amazon-style review criteria.</p>
        <button class="btn-primary" onclick="startReview()">Run RCA Review</button>
        <br><span class="info-link" onclick="toggleHow()">How this works</span>
        <div id="how-content" style="display:none;margin-top:12px;text-align:left;line-height:1.7;">
          <p>1. Write your RCA in the "RCA" tab</p>
          <p>2. Click "Run RCA Review"</p>
          <p>3. AI analyzes using 6 dimensions</p>
          <p>4. Comments appear in RCA tab</p>
          <p>5. Executive summary in RCA Review tab</p>
        </div>
      </div>
    </div>
    <div id="state-progress" style="display:none;">
      <div class="progress-container">
        <div class="progress-header"><div class="spinner"></div><p style="font-weight:500;">Review in progress...</p></div>
        <div class="progress-steps">
          <div class="step" id="step-0"><div class="step-dot"></div><span>Analyzing incident summary</span></div>
          <div class="step" id="step-1"><div class="step-dot"></div><span>Reviewing timeline and causality</span></div>
          <div class="step" id="step-2"><div class="step-dot"></div><span>Evaluating action items</span></div>
          <div class="step" id="step-3"><div class="step-dot"></div><span>Generating executive summary</span></div>
        </div>
      </div>
    </div>
    <div id="state-results" style="display:none;">
      <div id="tab-review" class="tab-content active">
        <div class="score-card">
          <div class="score-number" id="score-value">0<span class="score-max"> / 30</span></div>
          <div class="score-label">RCA Quality Score</div>
          <div class="score-interpretation" id="score-interpretation"></div>
        </div>
        <h4 style="font-size:13px;font-weight:500;margin-bottom:8px;">Top Improvements</h4>
        <ul class="improvement-list" id="improvements"></ul>
        <div class="actions">
          <button class="btn-secondary" onclick="switchTab('chat')">Open Global RCA Chat</button>
          <button class="btn-text" onclick="startReview()" style="width:100%;text-align:center;">Re-run Review</button>
        </div>
      </div>
      <div id="tab-chat" class="tab-content">
        <div class="chat-area">
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
    </div>
    <div id="error-msg" class="error" style="display:none;"></div>
  </div>
  <script>
    var currentState='idle',analysisData=null;
    function setState(s){currentState=s;document.getElementById('state-idle').style.display=s==='idle'?'block':'none';document.getElementById('state-progress').style.display=s==='progress'?'block':'none';document.getElementById('state-results').style.display=s==='results'?'block':'none';document.getElementById('tabs').style.display=s==='results'?'flex':'none';}
    function switchTab(t){document.querySelectorAll('.tab').forEach(function(e){e.classList.remove('active');});document.querySelectorAll('.tab-content').forEach(function(e){e.classList.remove('active');});if(t==='review'){document.querySelectorAll('.tab')[0].classList.add('active');document.getElementById('tab-review').classList.add('active');}else{document.querySelectorAll('.tab')[1].classList.add('active');document.getElementById('tab-chat').classList.add('active');}}
    function toggleHow(){var e=document.getElementById('how-content');e.style.display=e.style.display==='none'?'block':'none';}
    function setStep(n){for(var i=0;i<4;i++){var e=document.getElementById('step-'+i);e.className='step'+(i<n?' done':'')+(i===n?' active':'');}}
    function startReview(){setState('progress');setStep(0);hideError();setTimeout(function(){setStep(1);},800);setTimeout(function(){setStep(2);},1600);setTimeout(function(){setStep(3);},2400);google.script.run.withSuccessHandler(onReviewSuccess).withFailureHandler(onReviewError).runReview();}
    function onReviewSuccess(r){if(r.error){showError(r.error);setState('idle');return;}analysisData=r;displayResults(r);setState('results');}
    function onReviewError(e){showError('Review failed: '+e.message);setState('idle');}
    function displayResults(d){var t=d.total_score||0;var el=document.getElementById('score-value');var c=t<=10?'score-low':t<=20?'score-mid':'score-high';el.className='score-number '+c;el.innerHTML=t+'<span class="score-max"> / 30</span>';var es=d.executive_summary||{};document.getElementById('score-interpretation').textContent=es.overall_interpretation||'';var l=document.getElementById('improvements');l.innerHTML='';(es.improvements||[]).slice(0,3).forEach(function(i){var li=document.createElement('li');li.className='improvement-item';li.textContent=i;l.appendChild(li);});}
    function prefillChat(t){document.getElementById('chat-input').value=t;}
    function sendChat(){var input=document.getElementById('chat-input');var m=input.value.trim();if(!m)return;appendMessage('user',m);input.value='';google.script.run.withSuccessHandler(function(r){if(r.reply)appendMessage('assistant',r.reply);else if(r.error)appendMessage('assistant','Error: '+r.error);}).withFailureHandler(function(e){appendMessage('assistant','Failed: '+e.message);}).sendChatMessage(m);}
    function appendMessage(role,content){var c=document.getElementById('chat-messages');if(c.querySelector('.suggestions'))c.innerHTML='';var d=document.createElement('div');d.className='msg '+role;d.innerHTML='<span class="msg-role">'+(role==='user'?'You':'RCA Reviewer')+'</span><div class="msg-content">'+escapeHtml(content)+'</div>';c.appendChild(d);c.scrollTop=c.scrollHeight;}
    function escapeHtml(t){var d=document.createElement('div');d.textContent=t;return d.innerHTML;}
    function showError(m){var e=document.getElementById('error-msg');e.textContent=m;e.style.display='block';}
    function hideError(){document.getElementById('error-msg').style.display='none';}
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
    "https://www.googleapis.com/auth/documents.currentonly",
    "https://www.googleapis.com/auth/drive.file",
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
            Set up the RCA Reviewer add-on in your Google Docs
          </p>

          <div className="guide-section">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--google-blue)" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
              Setup Steps
            </h3>

            {[
              { num: 1, text: 'Open your Google Doc and go to Extensions > Apps Script' },
              { num: 2, text: 'Delete the default Code.gs content and replace with the code below' },
              { num: 3, text: 'Create additional .gs files for each service (DocumentService, CommentService, ApiService)' },
              { num: 4, text: 'Create a Sidebar.html file using the HTML template below' },
              { num: 5, text: 'Update API_BASE_URL in ApiService.gs with your deployed backend URL' },
              { num: 6, text: 'Update appsscript.json with the manifest content provided' },
              { num: 7, text: 'Save and reload the Google Doc. The add-on will appear under Extensions menu.' },
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
              Add-on Source Code
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
              Backend Deployment
            </h3>
            <p style={{ fontSize: 14, color: 'var(--google-grey-700)', lineHeight: 1.6 }}>
              The backend API needs to be deployed and accessible from Google Apps Script. 
              Update the <code>API_BASE_URL</code> in <code>ApiService.gs</code> with your backend URL.
              The API handles RCA analysis using OpenAI GPT-4o and stores chat history in MongoDB.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InstallGuide;
