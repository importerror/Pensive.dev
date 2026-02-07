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
  var rcaTab = findOrCreateTab(doc, 'RCA');
  
  if (!rcaTab) {
    return { error: 'RCA tab not found. Please create a tab named "RCA" with your content.' };
  }
  
  var rcaBody = rcaTab.asDocumentTab().getBody();
  var rcaText = rcaBody.getText();
  
  if (!rcaText.trim()) {
    return { error: 'RCA tab is empty. Please write your RCA content first.' };
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
  
  // Insert inline comments in RCA tab
  insertComments(doc, rcaBody, analysis.comments, existingIssues);
  
  // Create/update RCA Review tab
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
