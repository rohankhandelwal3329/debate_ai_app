/**
 * Records audio and returns base64 for /api/turn fallback when live STT unavailable.
 */
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private isRecording = false;

  async setup() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.getSupportedMimeType(),
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.audioChunks.push(event.data);
      };

      return true;
    } catch (error) {
      console.error('Error setting up microphone:', error);
      throw new Error(
        'Microphone access denied. Please allow microphone access to use voice features.'
      );
    }
  }

  private getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'audio/webm';
  }

  start() {
    if (!this.mediaRecorder) throw new Error('Microphone not set up. Call setup() first.');
    this.audioChunks = [];
    this.mediaRecorder.start();
    this.isRecording = true;
  }

  async stop(): Promise<string | null> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = async () => {
        this.isRecording = false;
        if (this.audioChunks.length === 0) {
          resolve(null);
          return;
        }
        const blob = new Blob(this.audioChunks, { type: this.mediaRecorder!.mimeType });
        try {
          const base64 = await this.blobToBase64(blob);
          resolve(base64);
        } catch (e) {
          reject(e);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const r = reader.result as string;
        resolve(r.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  getIsRecording() {
    return this.isRecording;
  }

  getStream() {
    return this.stream;
  }

  destroy() {
    if (this.mediaRecorder && this.isRecording) {
      try {
        this.mediaRecorder.stop();
      } catch {
        /* ignore */
      }
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
  }
}
