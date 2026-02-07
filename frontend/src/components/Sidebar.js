import React, { useState, useRef, useEffect } from 'react';

const PROGRESS_STEPS = [
  'Analyzing incident summary',
  'Reviewing timeline and causality',
  'Evaluating action items',
  'Generating executive summary'
];

function Sidebar({
  state, progressStep, analysis, onRunReview, onRerun,
  chatMessages, onSendChat, activeSidebarTab, setActiveSidebarTab, setActiveDocTab
}) {
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput;
    setChatInput('');
    setChatLoading(true);
    await onSendChat(msg);
    setChatLoading(false);
  };

  const totalScore = analysis?.total_score || 0;
  const scoreClass = totalScore <= 10 ? 'score-low' : totalScore <= 20 ? 'score-mid' : 'score-high';

  const renderIdle = () => (
    <div className="sidebar-idle" data-testid="sidebar-idle">
      <div className="sidebar-idle-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
        </svg>
      </div>
      <h3>RCA Reviewer</h3>
      <p>Analyze your Root Cause Analysis document with Amazon-style review criteria. Get inline comments and an executive summary.</p>
      <button className="btn-primary" onClick={onRunReview} data-testid="run-review-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        Run RCA Review
      </button>
      <div style={{ marginTop: 16 }}>
        <span className="info-link" onClick={() => setShowHow(!showHow)} data-testid="how-it-works-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/>
          </svg>
          How this works
        </span>
        {showHow && (
          <div className="fade-in" style={{ marginTop: 12, textAlign: 'left', fontSize: 13, color: 'var(--google-grey-700)', lineHeight: 1.6 }} data-testid="how-it-works-content">
            <p><strong>1.</strong> Write your RCA in the text area</p>
            <p><strong>2.</strong> Click "Run RCA Review"</p>
            <p><strong>3.</strong> The tool analyzes your document using 6 evaluation dimensions</p>
            <p><strong>4.</strong> Inline comments appear in the RCA tab</p>
            <p><strong>5.</strong> An executive summary is generated in the RCA Review tab</p>
            <p><strong>6.</strong> Use Global Chat for high-level discussion</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderProgress = () => (
    <div style={{ padding: '24px 0' }} data-testid="sidebar-progress">
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div className="spinner" style={{ margin: '0 auto 12px', width: 32, height: 32, borderWidth: 3 }}></div>
        <p style={{ fontSize: 13, color: 'var(--google-grey-700)', fontWeight: 500 }}>Review in progress...</p>
      </div>
      <div className="progress-steps">
        {PROGRESS_STEPS.map((label, idx) => {
          const isDone = progressStep > idx;
          const isActive = progressStep === idx;
          return (
            <div key={idx} className={`progress-step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`} data-testid={`progress-step-${idx}`}>
              <div className="progress-dot">
                {isDone && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
                {isActive && <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }}></div>}
              </div>
              <span>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderResults = () => {
    const es = analysis?.executive_summary || {};
    const improvements = es.improvements || [];

    return (
      <div className="fade-in" data-testid="sidebar-results">
        <div className="score-display">
          <div className={`score-number ${scoreClass}`}>{totalScore}<span className="score-max"> / 30</span></div>
          <div className="score-label">RCA Quality Score</div>
          <div className="score-interpretation">{es.overall_interpretation}</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <h4 style={{ fontFamily: 'var(--font-google)', fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--google-grey-900)' }}>
            Top Improvements
          </h4>
          <ul className="improvement-list" data-testid="improvement-list">
            {improvements.slice(0, 3).map((imp, i) => (
              <li key={i} className="improvement-item">{imp}</li>
            ))}
          </ul>
        </div>

        <div className="result-actions" data-testid="result-actions">
          <button className="btn-primary" onClick={() => setActiveDocTab('review')} data-testid="open-review-tab-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            Open RCA Review Tab
          </button>
          <button className="btn-secondary" onClick={() => setActiveSidebarTab('chat')} data-testid="open-chat-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            Open Global RCA Chat
          </button>
          <button className="btn-text" onClick={onRunReview} data-testid="rerun-review-btn">
            Re-run Review
          </button>
        </div>
      </div>
    );
  };

  const renderChat = () => (
    <div className="chat-container" data-testid="chat-container">
      <div className="chat-messages" data-testid="chat-messages">
        {chatMessages.length === 0 && (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <p style={{ fontSize: 13, color: 'var(--google-grey-500)' }}>
              Ask questions about your RCA. Examples:
            </p>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                'Summarize this RCA for leadership',
                'What systemic issues do you see?',
                'Are action items preventive?'
              ].map((q, i) => (
                <button
                  key={i}
                  className="btn-text"
                  style={{ textAlign: 'left', fontSize: 12 }}
                  onClick={() => { setChatInput(q); }}
                  data-testid={`chat-suggestion-${i}`}
                >
                  "{q}"
                </button>
              ))}
            </div>
          </div>
        )}
        {chatMessages.map((msg, idx) => (
          <div key={idx} className={`chat-message ${msg.role}`} data-testid={`chat-message-${idx}`}>
            <span className="chat-message-role">{msg.role === 'user' ? 'You' : 'RCA Reviewer'}</span>
            <div className="chat-message-content">{msg.content}</div>
          </div>
        ))}
        {chatLoading && (
          <div className="chat-message assistant">
            <span className="chat-message-role">RCA Reviewer</span>
            <div className="chat-message-content">
              <div className="spinner" style={{ width: 14, height: 14 }}></div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="chat-input-area" data-testid="chat-input-area">
        <input
          className="chat-input"
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSendChat()}
          placeholder="Ask about this RCA..."
          disabled={chatLoading}
          data-testid="chat-input"
        />
        <button
          className="chat-send-btn"
          onClick={handleSendChat}
          disabled={!chatInput.trim() || chatLoading}
          data-testid="chat-send-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  );

  return (
    <div className="sidebar" data-testid="sidebar">
      <div className="sidebar-card">
        <div className="sidebar-header">
          <div className="sidebar-title">RCA Reviewer</div>
          <div className="sidebar-subtitle">Google Docs Add-on</div>
        </div>

        {state === 'results' && (
          <div className="sidebar-tabs" data-testid="sidebar-tabs">
            <button
              className={`sidebar-tab ${activeSidebarTab === 'review' ? 'active' : ''}`}
              onClick={() => setActiveSidebarTab('review')}
              data-testid="sidebar-tab-review"
            >
              Review
            </button>
            <button
              className={`sidebar-tab ${activeSidebarTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveSidebarTab('chat')}
              data-testid="sidebar-tab-chat"
            >
              Global Chat
            </button>
          </div>
        )}

        <div className="sidebar-body">
          {state === 'idle' && renderIdle()}
          {state === 'progress' && renderProgress()}
          {state === 'results' && activeSidebarTab === 'review' && renderResults()}
          {state === 'results' && activeSidebarTab === 'chat' && renderChat()}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
