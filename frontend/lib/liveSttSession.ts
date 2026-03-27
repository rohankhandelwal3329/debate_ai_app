/**
 * Live STT via WebSocket (linear16 @ 48kHz).
 */

const DG_TARGET_RATE = 48000;
const CLOSE_STREAM = JSON.stringify({ type: 'CloseStream' });

function getLiveSttUrl(): string {
  const origin = (process.env.NEXT_PUBLIC_WS_ORIGIN || '').replace(/\/$/, '');
  if (origin) {
    return `${origin}/ws/live-stt`;
  }
  // Dev fallback: Next runs on :3000 while API websocket is on :8000.
  if (
    window.location.port === '3000' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    return 'ws://127.0.0.1:8000/ws/live-stt';
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/live-stt`;
}

function floatTo16BitPCM(float32Array: Float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

function downsampleFloat32(input: Float32Array, inRate: number, outRate: number) {
  if (inRate === outRate) return input;
  const ratio = inRate / outRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    out[i] = input[Math.floor(i * ratio)];
  }
  return out;
}

function parseDeepgramMessage(raw: string): {
  error?: string;
  transcript?: string;
  isFinal?: boolean;
} | null {
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    if (j.type === 'bridge_error') {
      return { error: (j.error as string) || 'Live STT error' };
    }
    if (j.type === 'Metadata' || j.type === 'SpeechStarted') return null;

    type Alt = { transcript?: string };
    let alt: Alt | undefined = (j.channel as { alternatives?: Alt[] })?.alternatives?.[0];
    if (!alt && (j.results as { readonly channels?: { alternatives: Alt[] }[] })?.channels?.[0]?.alternatives?.[0]) {
      alt = (j.results as { channels: { alternatives: Alt[] }[] }).channels[0].alternatives[0];
    }
    const transcript = (alt?.transcript || '').trim();
    const isFinal = j.is_final === true || j.speech_final === true;
    return { transcript, isFinal };
  } catch {
    return null;
  }
}

export class LiveSttSession {
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;
  private committedParts: string[] = [];
  private latestLine = '';
  private lastHeard = '';
  private onTranscript:
    | ((p: { displayText: string; isFinal: boolean }) => void)
    | null = null;
  private onError: ((e: string) => void) | null = null;

  private buildDisplayText() {
    const base = this.committedParts.filter(Boolean).join(' ').trim();
    const line = this.latestLine.trim();
    if (!line) return base;
    if (!base) return line;
    return `${base} ${line}`.trim();
  }

  async start(
    mediaStream: MediaStream,
    onTranscript: (p: { displayText: string; isFinal: boolean }) => void,
    onError?: (e: string) => void
  ) {
    this.onTranscript = onTranscript;
    this.onError = onError ?? null;
    this.committedParts = [];
    this.latestLine = '';
    this.lastHeard = '';
    this.stream = mediaStream;

    const url = getLiveSttUrl();

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onerror = () => {
        reject(new Error('Could not connect to live transcription. Is the server running?'));
      };

      ws.onopen = () => {
        try {
          this.startAudioPipeline(mediaStream);
          resolve();
        } catch (e) {
          reject(e);
        }
      };

      ws.onmessage = (ev) => {
        const parsed = parseDeepgramMessage(ev.data as string);
        if (!parsed) return;
        if (parsed.error) {
          this.onError?.(parsed.error);
          return;
        }
        const { transcript, isFinal } = parsed;
        if (isFinal && transcript) {
          this.committedParts.push(transcript);
          this.latestLine = '';
        } else if (!isFinal && transcript) {
          this.latestLine = transcript;
        }
        if (transcript) this.lastHeard = transcript;
        const displayText = this.buildDisplayText();
        this.onTranscript?.({ displayText, isFinal: !!isFinal });
      };

      ws.onclose = () => {
        this.ws = null;
      };
    });
  }

  private startAudioPipeline(mediaStream: MediaStream) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioCtx = new Ctx();
    const actualRate = this.audioCtx.sampleRate;

    this.source = this.audioCtx.createMediaStreamSource(mediaStream);
    const bufferSize = 4096;
    this.processor = this.audioCtx.createScriptProcessor(bufferSize, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);
      const down = downsampleFloat32(input, actualRate, DG_TARGET_RATE);
      const pcm = floatTo16BitPCM(down);
      this.ws.send(pcm.buffer);
    };

    const mute = this.audioCtx.createGain();
    mute.gain.value = 0;
    this.source.connect(this.processor);
    this.processor.connect(mute);
    mute.connect(this.audioCtx.destination);
  }

  async stop(): Promise<string> {
    let finalText = this.buildDisplayText();
    this.teardownAudio();

    const socket = this.ws;
    this.ws = null;

    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(CLOSE_STREAM);
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 400));
      try {
        if (socket.readyState === WebSocket.OPEN) socket.close();
      } catch {
        /* ignore */
      }
    }

    finalText =
      this.buildDisplayText().trim() || this.lastHeard.trim() || finalText.trim();
    this.committedParts = [];
    this.latestLine = '';
    return finalText;
  }

  private teardownAudio() {
    try {
      if (this.processor) {
        this.processor.disconnect();
        this.processor.onaudioprocess = null;
      }
    } catch {
      /* ignore */
    }
    try {
      if (this.source) this.source.disconnect();
    } catch {
      /* ignore */
    }
    this.processor = null;
    this.source = null;

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
    }
    this.audioCtx = null;
  }

  dispose() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    this.teardownAudio();
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }
}
