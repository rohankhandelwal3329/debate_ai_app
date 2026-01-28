/**
 * Handles microphone input and audio recording
 */

import { CONFIG } from './config.js';

export class AudioRecorder {
    constructor() {
        this.audioContext = null;
        this.stream = null;
        this.processor = null;
        this.source = null;
        this.isRecording = false;
        this.onAudioData = null;
    }

    /**
     * Request microphone access and set up audio context
     */
    async setup() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            return true;
        } catch (error) {
            throw new Error('Microphone access denied. Please allow microphone access to use the debate app.');
        }
    }

    /**
     * Start streaming audio data
     * @param {Function} onAudioData - Callback function to receive audio data
     */
    start(onAudioData) {
        if (!this.audioContext || !this.stream) {
            console.error('AudioRecorder not set up');
            return;
        }

        this.onAudioData = onAudioData;
        this.source = this.audioContext.createMediaStreamSource(this.stream);
        this.processor = this.audioContext.createScriptProcessor(CONFIG.PROCESSOR_BUFFER_SIZE, 1, 1);

        const contextSampleRate = this.audioContext.sampleRate;
        const targetSampleRate = CONFIG.INPUT_SAMPLE_RATE;

        this.processor.onaudioprocess = (event) => {
            if (!this.isRecording || !this.onAudioData) return;

            const inputData = event.inputBuffer.getChannelData(0);
            
            // Resample if necessary
            const processedData = contextSampleRate !== targetSampleRate
                ? this.resampleAudio(inputData, contextSampleRate, targetSampleRate)
                : inputData;

            const pcmData = this.floatTo16BitPCM(processedData);
            this.onAudioData(pcmData);
        };

        this.source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
        this.isRecording = true;
    }

    /**
     * Stop recording and clean up resources
     */
    stop() {
        this.isRecording = false;

        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }

        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }
    }

    /**
     * Resample audio from one sample rate to another
     */
    resampleAudio(inputData, fromSampleRate, toSampleRate) {
        const ratio = fromSampleRate / toSampleRate;
        const newLength = Math.round(inputData.length / ratio);
        const result = new Float32Array(newLength);

        for (let i = 0; i < newLength; i++) {
            const srcIndex = i * ratio;
            const srcIndexFloor = Math.floor(srcIndex);
            const srcIndexCeil = Math.min(srcIndexFloor + 1, inputData.length - 1);
            const fraction = srcIndex - srcIndexFloor;

            // Linear interpolation
            result[i] = inputData[srcIndexFloor] * (1 - fraction) + inputData[srcIndexCeil] * fraction;
        }

        return result;
    }

    /**
     * Convert Float32Array to 16-bit PCM
     */
    floatTo16BitPCM(float32Array) {
        const buffer = new ArrayBuffer(float32Array.length * 2);
        const view = new DataView(buffer);

        for (let i = 0; i < float32Array.length; i++) {
            let s = Math.max(-1, Math.min(1, float32Array[i]));
            s = s < 0 ? s * 0x8000 : s * 0x7FFF;
            view.setInt16(i * 2, s, true);
        }

        return buffer;
    }
}
