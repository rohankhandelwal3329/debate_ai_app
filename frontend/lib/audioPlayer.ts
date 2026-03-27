/**
 * Plays base64 audio from TTS; optional word-by-word text sync.
 */
export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private isPlaying = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private wordTimer: ReturnType<typeof setInterval> | null = null;
  onPlaybackStart: (() => void) | null = null;
  onPlaybackEnd: (() => void) | null = null;

  async init() {
    try {
      if (!this.audioContext || this.audioContext.state === 'closed') {
        if (typeof window === 'undefined') {
          throw new Error('AudioContext not available in server environment');
        }
        const AudioContextClass = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
        if (!AudioContextClass) {
          throw new Error('AudioContext not supported in this browser');
        }
        this.audioContext = new AudioContextClass();
        if (!this.audioContext) {
          throw new Error('Failed to create AudioContext instance');
        }
      }
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    } catch (error) {
      console.error('[AudioPlayer.init] Error:', error);
      throw error;
    }
  }

  async playBase64(
    base64Audio: string,
    options: {
      streamText?: string;
      onTextUpdate?: (t: string) => void;
      onAfterPlayback?: () => void;
    } = {}
  ) {
    if (!base64Audio) return;

    const { streamText, onTextUpdate, onAfterPlayback } = options;
    try {
      await this.init();
    } catch (error) {
      console.error('[AudioPlayer.playBase64] Failed to initialize AudioContext:', error);
      throw error;
    }
    this.stop();

    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Properly wrap decodeAudioData in a Promise
    const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
      if (!this.audioContext) {
        reject(new Error('AudioContext is not initialized'));
        return;
      }
      this.audioContext.decodeAudioData(
        bytes.buffer.slice(0),
        (buffer) => resolve(buffer),
        (error) => reject(error)
      );
    });
    
    const duration = audioBuffer.duration;
    const words = streamText ? streamText.trim().split(/\s+/).filter(Boolean) : [];

    return new Promise<void>((resolve, reject) => {
      try {
        if (!this.audioContext) {
          throw new Error('AudioContext is not initialized');
        }
        this.currentSource = this.audioContext.createBufferSource();
        this.currentSource.buffer = audioBuffer;
        this.currentSource.connect(this.audioContext.destination);

        const finish = () => {
          if (this.wordTimer) {
            clearInterval(this.wordTimer);
            this.wordTimer = null;
          }
          if (words.length > 0 && onTextUpdate) {
            onTextUpdate(streamText!.trim());
          }
          this.isPlaying = false;
          this.currentSource = null;
          onAfterPlayback?.();
          this.onPlaybackEnd?.();
          resolve();
        };

        if (words.length > 0 && onTextUpdate) {
          const n = words.length;
          const ms = Math.max(40, (duration / n) * 1000);
          let idx = 0;
          onTextUpdate(words[0]);
          this.wordTimer = setInterval(() => {
            idx += 1;
            if (idx >= words.length) {
              if (this.wordTimer) clearInterval(this.wordTimer);
              this.wordTimer = null;
              onTextUpdate(streamText!.trim());
              return;
            }
            onTextUpdate(words.slice(0, idx + 1).join(' '));
          }, ms);
        } else if (streamText && onTextUpdate) {
          onTextUpdate(streamText.trim());
        }

        this.currentSource.onended = finish;
        this.isPlaying = true;
        this.onPlaybackStart?.();
        this.currentSource.start();
      } catch (error) {
        console.error('Error playing audio:', error);
        if (this.wordTimer) {
          clearInterval(this.wordTimer);
          this.wordTimer = null;
        }
        this.isPlaying = false;
        this.onPlaybackEnd?.();
        reject(error);
      }
    });
  }

  stop() {
    if (this.wordTimer) {
      clearInterval(this.wordTimer);
      this.wordTimer = null;
    }
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        /* already stopped */
      }
      this.currentSource = null;
    }
    this.isPlaying = false;
  }

  getIsPlaying() {
    return this.isPlaying;
  }

  destroy() {
    this.stop();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
