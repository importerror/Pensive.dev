# Google Apps Script Reference

## File Overview

| File | Purpose |
|------|---------|
| `Code.gs` | Entry point, menu creation, review orchestration |
| `CommentService.gs` | Creates real Google Docs comments via Drive API v3 |
| `ApiService.gs` | HTTP calls to the backend API |
| `Sidebar.html` | Full sidebar UI (HTML + CSS + JavaScript) |
| `appsscript.json` | Manifest with scopes and service config |

## Code.gs

### Functions

#### `onOpen(e)`
Runs when the document is opened. Creates the add-on menu under Extensions.

#### `onInstall(e)`
Runs when the add-on is first installed. Calls `onOpen`.

#### `showSidebar()`
Opens the sidebar UI using `HtmlService.createHtmlOutputFromFile('Sidebar')`.

#### `runReview()`
Main function. Reads document body text, sends to backend API for analysis, then calls `insertComments()` to create inline comments. Returns the analysis object to the sidebar.

#### `processReply(threadContext, userReply, issueType, originalComment)`
Sends a comment thread reply to the backend for AI response.

#### `sendChatMessage(message)`
Sends a chat message with document context to the backend. Manages session ID via document properties.

## CommentService.gs

### Functions

#### `insertComments(doc, rcaBody, comments, existingIssues)`
Iterates through AI-generated comments and creates real Google Docs comments using Drive API v3. Tracks comment IDs in document properties to avoid duplicates on re-run.

#### `createNewComment(docId, comment, commentMap)`
Creates a single comment using `Drive.Comments.create()` with `quotedFileContent` to anchor the comment to specific text in the document.

### Comment Deduplication Logic

```
For each AI comment:
  1. Check if issue_id exists in commentMap
  2. If yes AND has drive_comment_id:
     -> Update by creating a reply on existing comment
  3. If no:
     -> Create new comment via Drive.Comments.create()
  4. Store mapping: issue_id -> drive_comment_id
```

### Drive API v3 Comment Format

```javascript
var resource = {
  content: "Comment text here",
  quotedFileContent: {
    mimeType: "text/plain",
    value: "Exact text from document to anchor to"
  }
};
Drive.Comments.create(resource, docId, { fields: 'id,content,quotedFileContent' });
```

## ApiService.gs

### Configuration

```javascript
var API_BASE_URL = 'https://pensivedev-production.up.railway.app';
```

### Functions

#### `callBackendAPI(endpoint, payload)`
Makes POST requests to the backend using `UrlFetchApp.fetch()`. Returns parsed JSON response or error object.

## Sidebar.html

### States

| State | Display | Trigger |
|-------|---------|---------|
| **Idle** | Title, description, "Run RCA Review" button, "How this works" link | Initial load |
| **Progress** | Spinner, 4-step progress indicators | After clicking "Run RCA Review" |
| **Results** | Score /30, top 3 improvements, chat button, re-run button | After analysis completes |

### Tabs (visible in Results state)

- **Review** - Score display, improvements list, action buttons
- **Global Chat** - Full chat interface with suggested prompts

### Communication with Apps Script

```javascript
// Call server-side function
google.script.run
  .withSuccessHandler(onSuccess)
  .withFailureHandler(onError)
  .runReview();

// Call with parameters
google.script.run
  .withSuccessHandler(function(result) { ... })
  .sendChatMessage(messageText);
```

## appsscript.json

### Required Advanced Services

```json
{
  "enabledAdvancedServices": [
    {
      "userSymbol": "Drive",
      "version": "v3",
      "serviceId": "drive"
    }
  ]
}
```

### Required OAuth Scopes

| Scope | Purpose |
|-------|---------|
| `documents.currentonly` | Read current document text |
| `documents` | Document manipulation |
| `drive` | Create comments, create summary doc |
| `drive.file` | File-level access |
| `script.external_request` | Call backend API via UrlFetchApp |
| `script.container.ui` | Show sidebar UI |

## Document Properties Used

| Key | Type | Purpose |
|-----|------|---------|
| `rca_issues` | JSON array | Tracks AI-identified issues across runs |
| `last_analysis` | JSON object | Stores most recent analysis result |
| `comment_map` | JSON object | Maps issue_id to Drive comment_id |
| `chat_session_id` | string | Current chat session for continuity |

## Permissions & Authorization

On first use, Google prompts for authorization. Since this is a personal script (not published to Marketplace), users will see an "unverified app" warning. Click:

1. **Advanced**
2. **Go to [project name] (unsafe)**
3. **Allow**

For public distribution, see the [Google Workspace Marketplace publishing guide](https://developers.google.com/workspace/marketplace/how-to-publish).
