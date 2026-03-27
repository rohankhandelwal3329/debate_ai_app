'use client';

import { RefObject } from 'react';
import type { ChatMsg } from '@/lib/types';

interface ChatPanelProps {
  messages: ChatMsg[];
  draftUser: string | null;
  streamingAi: string | null;
  convRef: RefObject<HTMLDivElement | null>;
  onClearConversation: () => void;
}

export default function ChatPanel({
  messages,
  draftUser,
  streamingAi,
  convRef,
  onClearConversation,
}: ChatPanelProps) {
  return (
    <section className="chat-panel">
      <div className="chat-toolbar">
        <h2 className="chat-title">Session</h2>
        <button
          type="button"
          className="icon-btn subtle"
          title="Clear transcript"
          aria-label="Clear transcript"
          onClick={onClearConversation}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
          </svg>
        </button>
      </div>

      <div className="conversation-container" ref={convRef}>
        {messages.length === 0 && draftUser === null && streamingAi === null && (
          <div className="empty-state">
            <div className="empty-illus">
              <div className="empty-ring" />
              <img src="/assets/chatting.png" alt="" width={36} height={36} />
            </div>
            <p className="empty-title">No messages yet</p>
            <p className="empty-sub">Start a session — your transcript appears here in real time.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role === 'user' ? 'user' : 'agent'}`}>
            <div className="message-label">{msg.role === 'user' ? 'You' : 'Coach'}</div>
            <div className="message-content">{msg.text}</div>
          </div>
        ))}

        {draftUser !== null && (
          <div className="message user draft">
            <div className="message-label">You</div>
            <div className="message-content">{draftUser}</div>
          </div>
        )}

        {streamingAi !== null && streamingAi !== '' && (
          <div className="message agent streaming">
            <div className="message-label">Coach</div>
            <div className="message-content">{streamingAi}</div>
          </div>
        )}
      </div>
    </section>
  );
}
