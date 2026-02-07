import React, { useState, useCallback } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import DocumentArea from './components/DocumentArea';
import InstallGuide from './components/InstallGuide';

const API = process.env.REACT_APP_BACKEND_URL;

const SAMPLE_RCA = `Incident Summary
On January 15, 2026, the payment processing service experienced a complete outage lasting 47 minutes, affecting approximately 12,000 customers. Users were unable to complete purchases during this window, resulting in an estimated revenue loss of $180,000.

Timeline
- 14:02 UTC: Deployment of payment-service v2.4.1 initiated
- 14:08 UTC: Deployment completed successfully, health checks passed
- 14:15 UTC: First customer complaints received via support channels
- 14:22 UTC: Engineering alerted via PagerDuty
- 14:28 UTC: Root cause identified as database connection pool exhaustion
- 14:35 UTC: Rollback to v2.4.0 initiated
- 14:49 UTC: Service fully restored

Root Cause
The new version introduced a change in the database query pattern that opened new connections for each transaction instead of reusing pooled connections. Under production load, this quickly exhausted the connection pool limit of 100 connections.

Impact
- 12,000 customers affected
- $180,000 estimated revenue loss
- 3 downstream services degraded

Action Items
1. Revert the problematic query pattern (Owner: Backend Team, Due: Jan 16)
2. Add connection pool monitoring dashboard (Owner: SRE Team, Due: Jan 20)
3. Review deployment process (Owner: Platform Team, Due: Jan 30)

Lessons Learned
- Database changes need more thorough load testing
- We need better monitoring for connection pool metrics`;

function App() {
  const [activeView, setActiveView] = useState('preview');
  const [rcaText, setRcaText] = useState(SAMPLE_RCA);
  const [analysis, setAnalysis] = useState(null);
  const [sidebarState, setSidebarState] = useState('idle');
  const [progressStep, setProgressStep] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatSessionId, setChatSessionId] = useState(null);
  const [activeDocTab, setActiveDocTab] = useState('rca');
  const [activeSidebarTab, setActiveSidebarTab] = useState('review');

  const runReview = useCallback(async () => {
    if (!rcaText.trim()) return;
    setSidebarState('progress');
    setProgressStep(0);

    const steps = [
      { delay: 800, step: 1 },
      { delay: 1600, step: 2 },
      { delay: 2400, step: 3 },
    ];

    for (const s of steps) {
      await new Promise(r => setTimeout(r, s.delay - (steps.indexOf(s) > 0 ? steps[steps.indexOf(s)-1].delay : 0)));
      setProgressStep(s.step);
    }

    try {
      const res = await fetch(`${API}/api/analyze-rca`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_text: rcaText,
          existing_issues: analysis?.comments || null
        })
      });

      if (!res.ok) throw new Error('Analysis failed');
      const data = await res.json();

      setProgressStep(4);
      await new Promise(r => setTimeout(r, 500));

      setAnalysis(data);
      setSidebarState('results');
      setActiveDocTab('rca');
    } catch (err) {
      console.error(err);
      setSidebarState('idle');
    }
  }, [rcaText, analysis]);

  const sendChat = useCallback(async (message) => {
    const userMsg = { role: 'user', content: message };
    setChatMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          document_context: rcaText,
          session_id: chatSessionId
        })
      });

      if (!res.ok) throw new Error('Chat failed');
      const data = await res.json();

      setChatSessionId(data.session_id);
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Failed to get response. Please try again.' }]);
    }
  }, [rcaText, chatSessionId]);

  return (
    <div className="app-shell" data-testid="app-shell">
      <header className="topbar" data-testid="topbar">
        <div className="topbar-logo">
          <svg viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#4285F4"/>
            <path d="M10 10h12v2H10zm0 4h12v2H10zm0 4h8v2H10z" fill="white"/>
          </svg>
          <span className="topbar-title"><span>RCA Reviewer</span> Add-on</span>
        </div>
        <nav className="topbar-nav" data-testid="topbar-nav">
          <button
            className={`topbar-nav-btn ${activeView === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveView('preview')}
            data-testid="nav-preview-btn"
          >
            Live Preview
          </button>
          <button
            className={`topbar-nav-btn ${activeView === 'install' ? 'active' : ''}`}
            onClick={() => setActiveView('install')}
            data-testid="nav-install-btn"
          >
            Installation Guide
          </button>
        </nav>
      </header>

      {activeView === 'preview' ? (
        <main className="main-content" data-testid="main-content">
          <DocumentArea
            rcaText={rcaText}
            setRcaText={setRcaText}
            analysis={analysis}
            activeDocTab={activeDocTab}
            setActiveDocTab={setActiveDocTab}
          />
          <Sidebar
            state={sidebarState}
            progressStep={progressStep}
            analysis={analysis}
            onRunReview={runReview}
            onRerun={() => { setSidebarState('idle'); setAnalysis(null); }}
            chatMessages={chatMessages}
            onSendChat={sendChat}
            activeSidebarTab={activeSidebarTab}
            setActiveSidebarTab={setActiveSidebarTab}
            setActiveDocTab={setActiveDocTab}
          />
        </main>
      ) : (
        <main className="main-content" data-testid="install-content">
          <InstallGuide />
        </main>
      )}
    </div>
  );
}

export default App;
