'use client';

import dynamic from 'next/dynamic';
import type { VizState } from '@/lib/types';

const Orb = dynamic(() => import('@/components/Orb'), {
  ssr: false,
  loading: () => <div className="studio-orb-skeleton" aria-hidden />,
});

interface OrbConfig {
  hue: number;
  hoverIntensity: number;
  forceHoverState: boolean;
  rotateOnHover: boolean;
}

interface ControlDockProps {
  orbProps: OrbConfig;
  viz: VizState;
  startVisible: boolean;
  recordVisible: boolean;
  recordLabel: string;
  recordingUi: boolean;
  recordDisabled: boolean;
  endDisabled: boolean;
  startBusy: boolean;
  onStartDebate: () => void;
  onToggleRecording: () => void;
  onEndDebate: () => void;
}

export default function ControlDock({
  orbProps,
  viz,
  startVisible,
  recordVisible,
  recordLabel,
  recordingUi,
  recordDisabled,
  endDisabled,
  startBusy,
  onStartDebate,
  onToggleRecording,
  onEndDebate,
}: ControlDockProps) {
  return (
    <aside className="studio-side-panel">
      <div className="control-dock">
        <div className={`voice-visualizer studio-orb ${viz ?? ''}`} aria-hidden="true">
          <Orb
            hue={orbProps.hue}
            hoverIntensity={orbProps.hoverIntensity}
            rotateOnHover={orbProps.rotateOnHover}
            forceHoverState={orbProps.forceHoverState}
            backgroundColor="#ffffff"
            interactive={false}
          />
        </div>

        <div className="control-buttons">
          {startVisible && (
            <button
              type="button"
              className="studio-btn studio-btn-primary"
              disabled={startBusy}
              onClick={onStartDebate}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width={18} height={18}>
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Start debate</span>
            </button>
          )}

          {recordVisible && (
            <button
              type="button"
              className={`studio-btn btn-record ${recordingUi ? 'recording' : ''}`}
              disabled={recordDisabled}
              onClick={onToggleRecording}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                width={18}
                height={18}
              >
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              </svg>
              <span>{recordLabel}</span>
            </button>
          )}

          {!startVisible && (
            <button
              type="button"
              className="studio-btn btn-ghost"
              disabled={endDisabled}
              onClick={onEndDebate}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                width={18}
                height={18}
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6M9 9l6 6" />
              </svg>
              <span>End</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
