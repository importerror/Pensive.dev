/**
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
 * Called from sidebar via google.script.run.
 * Does API analysis only — no document manipulation here.
 * Stores result in PropertiesService for applyComments() to use.
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

  // Store analysis so applyComments() can read it
  PropertiesService.getDocumentProperties().setProperty(
    'pending_analysis', JSON.stringify(analysis)
  );

  return analysis;
}

/**
 * Called from Extensions menu OR sidebar button.
 * Highlights anchor text in yellow + creates unanchored comments with quoted reference.
 * Works from both menu trigger and google.script.run (sidebar).
 */
function applyComments() {
  var props = PropertiesService.getDocumentProperties();
  var raw = props.getProperty('pending_analysis');
  if (!raw) {
    try { DocumentApp.getUi().alert('No analysis found. Run RCA Review from the sidebar first.'); } catch(e) {}
    return { error: 'No analysis found. Run RCA Review first, then apply comments.' };
  }

  var analysis = JSON.parse(raw);
  var doc = DocumentApp.getActiveDocument();
  var docId = doc.getId();
  var body = doc.getBody();
  var comments = analysis.comments || [];
  var created = 0;
  var errors = [];

  for (var i = 0; i < comments.length; i++) {
    var c = comments[i];
    if (!c.comment_body) continue;

    var anchor = (c.anchor_text || '').trim();

    // Step 1: Find the anchor text and highlight it yellow
    if (anchor) {
      try {
        var searchText = anchor.length > 80 ? anchor.substring(0, 80) : anchor;
        var searchResult = body.findText(searchText);
        if (searchResult) {
          var elem = searchResult.getElement();
          var start = searchResult.getStartOffset();
          var end = searchResult.getEndOffsetInclusive();
          elem.editAsText().setBackgroundColor(start, end, '#FCE8B2');
        }
      } catch(highlightErr) {
        // Non-critical: continue even if highlight fails
      }
    }

    // Step 2: Create an unanchored comment — no quotedFileContent so it never shows "Original content deleted"
    try {
      var commentBody = anchor
        ? '> "' + anchor + '"\n\n' + c.comment_body
        : c.comment_body;
      Drive.Comments.create({ content: commentBody }, docId, { fields: 'id' });
      created++;
    } catch (e) {
      errors.push('Comment ' + (i + 1) + ': ' + e.toString());
    }

    Utilities.sleep(300);
  }

  try {
    DocumentApp.getUi().alert(
      'Done! Created ' + created + ' of ' + comments.length + ' comments.\nHighlighted text in yellow. Reload page to see all comments.'
    );
  } catch(e) {}

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
}
