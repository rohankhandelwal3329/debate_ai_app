'use client';

import { useDebateSession } from '@/hooks/useDebateSession';
import ChatPanel from '@/components/studio/ChatPanel';
import ControlDock from '@/components/studio/ControlDock';
import HelpModal from '@/components/studio/HelpModal';
import StatusBadge from '@/components/studio/StatusBadge';

export default function StudioPage() {
  const {
    user,
    messages, draftUser, streamingAi,
    conn, connLabel, viz,
    startVisible, recordVisible, recordLabel,
    recordingUi, recordDisabled, endDisabled, startBusy,
    orbProps, convRef, helpRef,
    startDebate, toggleRecording, endDebate, clearConversation, logout,
  } = useDebateSession();

  if (!user) return null;

  return (
    <>
      <div className="ambient" aria-hidden="true">
        <div className="orb orb-a" />
        <div className="orb orb-b" />
        <div className="orb orb-c" />
        <div className="noise" />
      </div>

      <div className="app-container">
        <header className="topbar">
          <div className="topbar-brand">
            <img className="topbar-logo-img" src="/assets/ai-microphone.gif" alt="" width={36} height={36} decoding="async" />
            <span className="brand-name">CETLOE Debate AI</span>
          </div>
          <div className="topbar-actions">
            <button type="button" className="icon-btn" title="How it works" aria-label="How it works" onClick={() => helpRef.current?.showModal()}>
              <img src="/assets/question.png" alt="" width={20} height={20} />
            </button>
            <div className="user-pill">
              <span className="user-name">{user.name}</span>
              <span className="user-id">ID: {user.pantherId}</span>
            </div>
            <button type="button" className="icon-btn danger-ghost" title="Sign out" aria-label="Sign out" onClick={logout}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </div>
        </header>

        <StatusBadge conn={conn} connLabel={connLabel} />

        <main className="main-stage">
          <ControlDock
            orbProps={orbProps}
            viz={viz}
            startVisible={startVisible}
            recordVisible={recordVisible}
            recordLabel={recordLabel}
            recordingUi={recordingUi}
            recordDisabled={recordDisabled}
            endDisabled={endDisabled}
            startBusy={startBusy}
            onStartDebate={startDebate}
            onToggleRecording={toggleRecording}
            onEndDebate={endDebate}
          />
          <ChatPanel
            messages={messages}
            draftUser={draftUser}
            streamingAi={streamingAi}
            convRef={convRef}
            onClearConversation={clearConversation}
          />
        </main>

        <footer className="app-footer">Made with ❤️ by CETLOE</footer>
      </div>

      <HelpModal helpRef={helpRef} />
    </>
  );
}
