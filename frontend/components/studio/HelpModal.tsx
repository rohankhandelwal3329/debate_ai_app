'use client';

import { RefObject } from 'react';

interface HelpModalProps {
  helpRef: RefObject<HTMLDialogElement | null>;
}

export default function HelpModal({ helpRef }: HelpModalProps) {
  return (
    <dialog
      ref={helpRef}
      className="modal"
      aria-labelledby="helpTitle"
      onClick={(e) => {
        if (e.target === e.currentTarget) helpRef.current?.close();
      }}
    >
      <div className="modal-card">
        <button
          type="button"
          className="modal-close"
          aria-label="Close"
          onClick={() => helpRef.current?.close()}
        >
          &times;
        </button>
        <h2 id="helpTitle" className="modal-title">
          How it works
        </h2>
        <ol className="modal-steps">
          <li>
            <strong>Start</strong> — Allow the mic; the AI opens the debate.
          </li>
          <li>
            <strong>Speak</strong> — Tap once to talk, tap again when finished. Text streams as
            you speak.
          </li>
          <li>
            <strong>Argue</strong> — Take a side; the AI takes the other.
          </li>
          <li>
            <strong>Finish</strong> — Say you&apos;re done or tap <em>End</em> for full coaching
            feedback.
          </li>
        </ol>
        <p className="modal-tip">Tip: Use examples and respond directly to the last question.</p>
      </div>
    </dialog>
  );
}
