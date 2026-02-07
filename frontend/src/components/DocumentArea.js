import React from 'react';

function DocumentArea({ rcaText, setRcaText, analysis, activeDocTab, setActiveDocTab }) {
  const renderRCAContent = () => {
    if (!analysis || !analysis.comments || analysis.comments.length === 0) {
      return (
        <textarea
          className="doc-textarea"
          value={rcaText}
          onChange={e => setRcaText(e.target.value)}
          placeholder="Paste your RCA document here..."
          data-testid="rca-textarea"
        />
      );
    }

    const lines = rcaText.split('\n');
    return (
      <div>
        <textarea
          className="doc-textarea"
          value={rcaText}
          onChange={e => setRcaText(e.target.value)}
          data-testid="rca-textarea"
          style={{ marginBottom: 24 }}
        />
        <div style={{ borderTop: '1px solid var(--google-grey-200)', paddingTop: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-google)', fontSize: 14, fontWeight: 500, marginBottom: 12, color: 'var(--google-grey-900)' }}>
            Inline Comments ({analysis.comments.length})
          </h3>
          {analysis.comments.map((comment, idx) => (
            <div key={comment.issue_id || idx} className="comment-card" data-testid={`comment-card-${idx}`}>
              <div className="comment-card-type">{comment.issue_type}</div>
              {comment.anchor_text && (
                <div className="comment-card-anchor">"{comment.anchor_text}"</div>
              )}
              <div className="comment-card-body">{comment.comment_body}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderReviewContent = () => {
    if (!analysis) {
      return (
        <div className="empty-state" data-testid="review-empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p>Run RCA Review to generate the executive summary</p>
        </div>
      );
    }

    const es = analysis.executive_summary || {};
    const totalScore = analysis.total_score || 0;
    const scoreClass = totalScore <= 10 ? 'low' : totalScore <= 20 ? 'mid' : 'high';
    const riskClass = (es.recurrence_risk || '').toLowerCase();
    const timestamp = analysis.timestamp ? new Date(analysis.timestamp).toLocaleString() : 'N/A';

    return (
      <div className="review-content" data-testid="review-content">
        <div className="review-header">
          <h2>RCA Reviewer -- Executive Summary</h2>
          <div className="review-timestamp">Auto-generated. Updated on {timestamp}.</div>
        </div>

        <div className="review-section">
          <h3>Section 1: Overall Assessment</h3>
          <div className={`review-score-badge ${scoreClass}`}>
            RCA Quality Score: {totalScore} / 30
          </div>
          <p>{es.overall_interpretation}</p>
        </div>

        <div className="review-section">
          <h3>Section 2: Leadership Summary</h3>
          <ul>
            {(es.leadership_bullets || []).map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>

        <div className="review-section">
          <h3>Section 3: Key Gaps Identified</h3>
          <ol>
            {(es.key_gaps || []).map((g, i) => <li key={i}>{g}</li>)}
          </ol>
        </div>

        <div className="review-section">
          <h3>Section 4: Recurrence Risk</h3>
          <span className={`risk-badge ${riskClass}`}>{es.recurrence_risk || 'N/A'}</span>
          <p style={{ marginTop: 8 }}>{es.recurrence_rationale}</p>
        </div>

        <div className="review-section">
          <h3>Section 5: Action Items Critique</h3>
          <p>{es.action_critique}</p>
        </div>

        <div className="review-section">
          <h3>Section 6: What to Improve Next</h3>
          <ul>
            {(es.improvements || []).map((imp, i) => <li key={i}>{imp}</li>)}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="doc-area" data-testid="doc-area">
      <div className="doc-card">
        <div className="doc-tabs" data-testid="doc-tabs">
          <button
            className={`doc-tab ${activeDocTab === 'rca' ? 'active' : ''}`}
            onClick={() => setActiveDocTab('rca')}
            data-testid="doc-tab-rca"
          >
            RCA
          </button>
          <button
            className={`doc-tab ${activeDocTab === 'review' ? 'active' : ''}`}
            onClick={() => setActiveDocTab('review')}
            data-testid="doc-tab-review"
          >
            RCA Review
          </button>
        </div>
        <div className="doc-body" data-testid="doc-body">
          {activeDocTab === 'rca' ? renderRCAContent() : renderReviewContent()}
        </div>
      </div>
    </div>
  );
}

export default DocumentArea;
