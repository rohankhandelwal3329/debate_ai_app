'use client';

import type { Conn } from '@/lib/types';

interface StatusBadgeProps {
  conn: Conn;
  connLabel?: string;
}

const STATUS_LABELS: Record<Conn, string> = {
  ready: 'Ready to start',
  connecting: 'Starting...',
  connected: 'Connected',
  recording: 'Recording...',
  processing: 'Processing...',
  speaking: 'AI Speaking...',
  'debate-over': 'Debate Over',
  error: 'Error',
};

export default function StatusBadge({ conn, connLabel }: StatusBadgeProps) {
  const statusClass =
    conn === 'connected'
      ? 'connected'
      : conn === 'recording'
        ? 'recording'
        : conn === 'processing'
          ? 'processing'
          : conn === 'speaking'
            ? 'speaking'
            : conn === 'debate-over'
              ? 'debate-over'
              : conn === 'error'
                ? 'error'
                : '';

  return (
    <div className={`status-indicator status-pill ${statusClass}`}>
      <span className="status-dot" aria-hidden="true" />
      <span className="status-text" aria-live="polite">
        {connLabel ?? STATUS_LABELS[conn]}
      </span>
    </div>
  );
}
