'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@/lib/api';
import { AudioPlayer } from '@/lib/audioPlayer';
import { AudioRecorder } from '@/lib/audioRecorder';
import { LiveSttSession } from '@/lib/liveSttSession';
import {
  clearDebateSessionId,
  clearUserSession,
  getDebateSessionId,
  loadUserSession,
  saveDebateSessionId,
  type UserData,
} from '@/lib/sessionStorage';
import type { Conn, VizState, ChatMsg } from '@/lib/types';

let idCounter = 0;
function nid() {
  idCounter += 1;
  return `m${idCounter}`;
}

export function useDebateSession() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draftUser, setDraftUser] = useState<string | null>(null);
  const [streamingAi, setStreamingAi] = useState<string | null>(null);
  const [conn, setConn] = useState<Conn>('ready');
  const [connLabel, setConnLabel] = useState<string | undefined>(undefined);
  const [showTurn, setShowTurn] = useState(false);
  const [viz, setViz] = useState<VizState>(null);
  const [startVisible, setStartVisible] = useState(true);
  const [recordVisible, setRecordVisible] = useState(false);
  const [recordLabel, setRecordLabel] = useState('Tap to speak');
  const [recordingUi, setRecordingUi] = useState(false);
  const [recordDisabled, setRecordDisabled] = useState(false);
  const [endDisabled, setEndDisabled] = useState(false);
  const [startBusy, setStartBusy] = useState(false);

  const debateSessionIdRef = useRef<string | null>(null);
  const isDebatingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const isCapturingRef = useRef(false);
  const isFinishingTurnRef = useRef(false);
  const blobFallbackRef = useRef(false);
  const liveSttRef = useRef<LiveSttSession | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoListeningRef = useRef(false);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const convRef = useRef<HTMLDivElement | null>(null);
  const helpRef = useRef<HTMLDialogElement | null>(null);

  const orbProps = useMemo(() => {
    if (recordingUi || conn === 'recording' || viz === 'recording') {
      if (!draftUser || draftUser.trim() === '')
        return { hue: 0, hoverIntensity: 0.3, forceHoverState: true, rotateOnHover: false };
      return { hue: 0, hoverIntensity: 0.8, forceHoverState: true, rotateOnHover: true };
    }
    if (conn === 'speaking' || viz === 'speaking')
      return { hue: 22, hoverIntensity: 0.6, forceHoverState: true, rotateOnHover: false };
    if (conn === 'processing' || conn === 'connecting')
      return { hue: 0, hoverIntensity: 0.5, forceHoverState: true, rotateOnHover: false };
    return { hue: 0, hoverIntensity: 0.42, forceHoverState: false, rotateOnHover: true };
  }, [conn, viz, recordingUi, draftUser]);

  const recorder = () => {
    if (!recorderRef.current) recorderRef.current = new AudioRecorder();
    return recorderRef.current;
  };

  const player = () => {
    if (!playerRef.current) playerRef.current = new AudioPlayer();
    return playerRef.current;
  };

  // Body class + session restore
  useEffect(() => {
    document.body.classList.add('debate-active');
    document.body.classList.remove('student-landing');

    const savedSessionId = getDebateSessionId();
    if (savedSessionId) {
      debateSessionIdRef.current = savedSessionId;
      isDebatingRef.current = true;
      setStartVisible(false);
      setRecordVisible(true);
      setViz('active');
      setConn('connected');
      setConnLabel('Listening...');
      setRecordDisabled(false);
      setEndDisabled(false);
    }

    return () => { document.body.classList.remove('debate-active'); };
  }, []);

  // Load user session
  useEffect(() => {
    const u = loadUserSession();
    if (!u) { router.replace('/'); return; }
    setUser(u);
  }, [router]);

  // Scroll to bottom on new messages
  useEffect(() => {
    const el = convRef.current;
    if (!el) return;
    requestAnimationFrame(() => { el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); });
  }, [messages, draftUser, streamingAi]);

  // Player callbacks
  useEffect(() => {
    const p = player();
    p.onPlaybackStart = () => { setConn('speaking'); setConnLabel(undefined); setShowTurn(false); };
    p.onPlaybackEnd = () => {
      if (isDebatingRef.current) {
        setConn('connected');
        setConnLabel('Listening...');
        setViz('active');
        setRecordDisabled(false);
        setEndDisabled(false);
      }
    };
    return () => { p.onPlaybackStart = null; p.onPlaybackEnd = null; };
  }, []);

  const resetStudioUi = useCallback(() => {
    setStartVisible(true);
    setRecordVisible(false);
    setRecordLabel('Tap to speak');
    setRecordingUi(false);
    setRecordDisabled(false);
    setEndDisabled(false);
    setViz(null);
    setShowTurn(false);
  }, []);

  const cleanupDebate = useCallback(() => {
    isDebatingRef.current = false;
    isProcessingRef.current = false;
    isCapturingRef.current = false;
    isFinishingTurnRef.current = false;
    blobFallbackRef.current = false;
    autoListeningRef.current = false;
    debateSessionIdRef.current = null;

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (liveSttRef.current) { liveSttRef.current.dispose(); liveSttRef.current = null; }
    recorder().destroy(); recorderRef.current = null;
    player().destroy(); playerRef.current = null;
    clearDebateSessionId();
    setShowTurn(false);
    resetStudioUi();
  }, [resetStudioUi]);

  const handleAiTurnResponse = useCallback(
    async (response: Awaited<ReturnType<typeof api.processTurn>>) => {
      setStreamingAi('');
      const p = player();
      const finalizeStream = () => setStreamingAi(null);

      const onAutoListen = async () => {
        if (isDebatingRef.current && !response.is_complete) {
          autoListeningRef.current = true;
          setViz('active');
          try { await startSpeakingTurn(); } catch (err) { console.error('[Auto-listen]', err); }
        }
      };

      if (response.audio_base64) {
        await p.playBase64(response.audio_base64, {
          streamText: response.text,
          onTextUpdate: (t) => setStreamingAi(t),
          onAfterPlayback: async () => {
            finalizeStream();
            setMessages((m) => [...m, { id: nid(), role: 'ai', text: response.text }]);
            await onAutoListen();
          },
        });
      } else {
        setStreamingAi(response.text);
        finalizeStream();
        setMessages((m) => [...m, { id: nid(), role: 'ai', text: response.text }]);
        await onAutoListen();
      }

      if (response.is_complete) {
        isDebatingRef.current = false;
        setConn('debate-over');
        resetStudioUi();
        clearDebateSessionId();
      }
    },
    [resetStudioUi]
  );

  const startSpeakingTurn = useCallback(async () => {
    if (!debateSessionIdRef.current || !isDebatingRef.current) return;
    if (isFinishingTurnRef.current) isFinishingTurnRef.current = false;

    blobFallbackRef.current = false;
    if (!recorder().getStream()) await recorder().setup();
    const stream = recorder().getStream();
    if (!stream) { setConn('error'); setConnLabel('Microphone unavailable'); return; }

    setDraftUser('');
    const stt = new LiveSttSession();
    liveSttRef.current = stt;
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

    let lastDisplayText = '';

    const armSilenceTimer = () => {
      if (autoListeningRef.current) {
        silenceTimeoutRef.current = setTimeout(() => {
          if (isCapturingRef.current && autoListeningRef.current)
            finishSpeakingTurn().catch(console.error);
        }, 5000);
      }
    };

    try {
      await stt.start(
        stream,
        ({ displayText }) => {
          setDraftUser(displayText);
          if (displayText && displayText.trim().length > 0 && displayText !== lastDisplayText) {
            lastDisplayText = displayText;
            if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
            if (autoListeningRef.current && isCapturingRef.current) armSilenceTimer();
          }
        },
        (err) => console.warn('Live STT:', err),
      );
      isCapturingRef.current = true;
      setRecordingUi(true);
      setConn('recording');
      setConnLabel(undefined);
      setShowTurn(false);
      setViz('recording');
      armSilenceTimer();
    } catch (e) {
      setDraftUser(null);
      blobFallbackRef.current = true;
      liveSttRef.current = null;
      try {
        recorder().start();
        isCapturingRef.current = true;
        setRecordingUi(true);
        setRecordLabel('Tap when done');
        setConn('recording');
        setShowTurn(false);
        setViz('recording');
        armSilenceTimer();
      } catch (e2) {
        setConn('error');
        setConnLabel(e2 instanceof Error ? e2.message : 'Could not record');
      }
    }
  }, []);

  const finishSpeakingTurn = async () => {
    if (!isCapturingRef.current || isFinishingTurnRef.current) return;

    const stt = liveSttRef.current;
    const blobFallback = blobFallbackRef.current;

    isFinishingTurnRef.current = true;
    isCapturingRef.current = false;
    setRecordingUi(false);
    setRecordLabel('Tap to speak');
    setConn('processing');
    setConnLabel('Finishing…');

    let userText = '';

    try {
      if (!blobFallback && stt) {
        try {
          userText = await stt.stop();
        } catch (err) {
          console.error('[finishSpeakingTurn] stt.stop() failed:', err);
          liveSttRef.current = null;
          setConn('error');
          setConnLabel('Could not finish transcription. Try again.');
          autoListeningRef.current = true;
          setTimeout(() => startSpeakingTurn(), 2000);
          return;
        }
        liveSttRef.current = null;
        if (userText.trim()) {
          setDraftUser(null);
          setMessages((m) => [...m, { id: nid(), role: 'user', text: userText.trim() }]);
        }
      } else {
        blobFallbackRef.current = false;
        const audioBase64 = await recorder().stop();
        if (!audioBase64) {
          autoListeningRef.current = true;
          await startSpeakingTurn();
          return;
        }
        isProcessingRef.current = true;
        setConn('processing'); setConnLabel('Processing…');
        setRecordDisabled(true); setEndDisabled(true); setViz('speaking');
        try {
          const response = await api.processTurn(debateSessionIdRef.current!, audioBase64, null);
          isProcessingRef.current = false;
          const ut = response.user_text;
          if (ut) setMessages((m) => [...m, { id: nid(), role: 'user' as const, text: ut }]);
          await handleAiTurnResponse(response);
        } catch (error) {
          setConn('error'); setConnLabel(error instanceof Error ? error.message : 'Error');
          setViz('active'); setRecordDisabled(false); setEndDisabled(false);
          isProcessingRef.current = false;
        }
        return;
      }

      if (!userText.trim()) {
        setDraftUser(null);
        autoListeningRef.current = true;
        await startSpeakingTurn();
        return;
      }

      isProcessingRef.current = true;
      setConn('processing'); setConnLabel('Processing…');
      setRecordDisabled(true); setEndDisabled(true); setViz('speaking');

      try {
        const response = await api.processTurn(debateSessionIdRef.current!, null, userText.trim());
        isProcessingRef.current = false;
        await handleAiTurnResponse(response);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Error';
        if (errorMsg.includes('Session not found') || errorMsg.includes('expired')) {
          debateSessionIdRef.current = null;
          clearDebateSessionId();
          setConn('error');
          setConnLabel('Session expired. Please start a new debate.');
          isDebatingRef.current = false;
          setTimeout(() => { cleanupDebate(); resetStudioUi(); }, 2000);
        } else {
          setConn('error'); setConnLabel(errorMsg);
          setViz('active'); setRecordDisabled(false); setEndDisabled(false);
        }
        isProcessingRef.current = false;
      }
    } finally {
      isFinishingTurnRef.current = false;
      if (!blobFallback) setDraftUser(null);
    }
  };

  const toggleRecording = async () => {
    if (isProcessingRef.current || player().getIsPlaying() || isFinishingTurnRef.current) return;
    if (!isCapturingRef.current) await startSpeakingTurn();
    else await finishSpeakingTurn();
  };

  const endDebate = async () => {
    if (!isDebatingRef.current) return;

    if (isCapturingRef.current) {
      isCapturingRef.current = false;
      if (liveSttRef.current) {
        await liveSttRef.current.stop().catch(() => {});
        liveSttRef.current.dispose();
        liveSttRef.current = null;
      }
      if (recorder().getIsRecording()) await recorder().stop();
      setDraftUser(null); setRecordingUi(false); setRecordLabel('Tap to speak');
    }

    try {
      setConn('processing'); setConnLabel(undefined);
      setRecordDisabled(true); setEndDisabled(true); setViz('speaking');

      const response = await api.processTurn(debateSessionIdRef.current!, null, 'I am done with the debate.');
      setStreamingAi('');
      const p = player();

      if (response.audio_base64) {
        await p.playBase64(response.audio_base64, {
          streamText: response.text,
          onTextUpdate: (t) => setStreamingAi(t),
          onAfterPlayback: () => {
            setStreamingAi(null);
            setMessages((m) => [...m, { id: nid(), role: 'ai', text: response.text }]);
          },
        });
      } else {
        setMessages((m) => [...m, { id: nid(), role: 'ai', text: response.text }]);
        setStreamingAi(null);
      }

      cleanupDebate(); setConn('debate-over');
    } catch (error) {
      cleanupDebate();
      setConn('error'); setConnLabel(error instanceof Error ? error.message : 'Error');
    }
  };

  const startDebate = async () => {
    try {
      setStartBusy(true); setConn('connecting'); setConnLabel(undefined);
      const u = loadUserSession();
      if (!u) { setStartBusy(false); return; }

      await recorder().setup();
      const response = await api.startDebate(u.name, u.pantherId, u.email);
      debateSessionIdRef.current = response.session_id;
      saveDebateSessionId(response.session_id);
      isDebatingRef.current = true;
      setStartVisible(false); setViz('active'); setConn('speaking');
      setStreamingAi('');
      const p = player();

      const afterGreeting = async () => {
        setStreamingAi(null);
        setMessages((m) => [...m, { id: nid(), role: 'ai', text: response.text }]);
        autoListeningRef.current = true;
        setViz('active');
        await startSpeakingTurn();
      };

      if (response.audio_base64) {
        await p.playBase64(response.audio_base64, {
          streamText: response.text,
          onTextUpdate: (t) => setStreamingAi(t),
          onAfterPlayback: afterGreeting,
        });
      } else {
        await afterGreeting();
      }
    } catch (err) {
      console.error(err);
      setConn('error'); setConnLabel(err instanceof Error ? err.message : 'Error');
      resetStudioUi();
    } finally {
      setStartBusy(false);
    }
  };

  const clearConversation = () => { setMessages([]); setDraftUser(null); setStreamingAi(null); };

  const logout = () => {
    if (isDebatingRef.current) cleanupDebate();
    clearUserSession();
    router.push('/');
  };

  return {
    user,
    messages, draftUser, streamingAi,
    conn, connLabel, viz,
    startVisible, recordVisible, recordLabel,
    recordingUi, recordDisabled, endDisabled, startBusy,
    orbProps, convRef, helpRef,
    startDebate, toggleRecording, endDebate, clearConversation, logout,
  };
}
