/**
 * Handles audio playback from the AI agent
 */

import { CONFIG } from './config.js';

export class AudioPlayer {
    constructor() {
        this.playbackContext = null;
        this.audioQueue = [];
        this.isPlaying = false;
        this.isAudioPlaying = false;
        
        // Callbacks for audio state changes
        this.onPlaybackStart = null;
        this.onPlaybackEnd = null;
    }

    /**
     * Initialize the playback context
     */
    async init() {
        if (!this.playbackContext || this.playbackContext.state === 'closed') {
            this.playbackContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: CONFIG.OUTPUT_SAMPLE_RATE
            });
        }

        if (this.playbackContext.state === 'suspended') {
            await this.playbackContext.resume();
        }
    }

    /**
     * Add audio data to the playback queue
     * @param {ArrayBuffer} arrayBuffer - Raw audio data
     */
    queueAudio(arrayBuffer) {
        this.audioQueue.push(new Int16Array(arrayBuffer));

        if (!this.isPlaying) {
            this.playQueue();
        }
    }

    /**
     * Play queued audio chunks
     */
    async playQueue() {
        if (this.audioQueue.length === 0) {
            this.isPlaying = false;
            return;
        }

        this.isPlaying = true;

        // Combine available chunks for smoother playback
        const chunksToPlay = [];
        let totalLength = 0;

        while (this.audioQueue.length > 0 && chunksToPlay.length < CONFIG.MAX_CHUNKS_PER_PLAY) {
            const chunk = this.audioQueue.shift();
            chunksToPlay.push(chunk);
            totalLength += chunk.length;
        }

        if (totalLength === 0) {
            this.isPlaying = false;
            return;
        }

        try {
            await this.init();

            // Combine all chunks into one buffer
            const combinedData = new Float32Array(totalLength);
            let offset = 0;
            for (const chunk of chunksToPlay) {
                for (let i = 0; i < chunk.length; i++) {
                    combinedData[offset + i] = chunk[i] / 32768.0;
                }
                offset += chunk.length;
            }

            // Apply short fades to prevent clicks
            this.applyFades(combinedData, totalLength);

            // Create and play audio buffer
            const audioBuffer = this.playbackContext.createBuffer(1, totalLength, CONFIG.OUTPUT_SAMPLE_RATE);
            audioBuffer.copyToChannel(combinedData, 0);

            const source = this.playbackContext.createBufferSource();
            source.buffer = audioBuffer;

            // Apply low-pass filter for smoother sound
            const filter = this.playbackContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = CONFIG.LOWPASS_FREQUENCY;

            source.connect(filter);
            filter.connect(this.playbackContext.destination);

            source.onended = () => {
                if (this.audioQueue.length > 0) {
                    this.playQueue();
                } else {
                    this.isPlaying = false;
                    this.isAudioPlaying = false;
                    if (this.onPlaybackEnd) this.onPlaybackEnd();
                }
            };

            // Mark audio as playing
            if (!this.isAudioPlaying) {
                this.isAudioPlaying = true;
                if (this.onPlaybackStart) this.onPlaybackStart();
            }

            source.start();
        } catch (error) {
            console.error('Error playing audio:', error);
            this.isPlaying = false;
            if (this.audioQueue.length > 0) {
                setTimeout(() => this.playQueue(), 50);
            }
        }
    }

    /**
     * Apply fade in/out to prevent audio clicks
     */
    applyFades(data, totalLength) {
        const fadeLen = Math.min(CONFIG.FADE_LENGTH, Math.floor(totalLength / 20));
        for (let i = 0; i < fadeLen; i++) {
            const factor = i / fadeLen;
            data[i] *= factor;
            data[totalLength - 1 - i] *= factor;
        }
    }

    /**
     * Clear the audio queue and stop playback
     */
    clear() {
        this.audioQueue = [];
        this.isPlaying = false;
        if (this.isAudioPlaying) {
            this.isAudioPlaying = false;
            if (this.onPlaybackEnd) this.onPlaybackEnd();
        }
    }

    /**
     * Check if audio is currently playing
     */
    isCurrentlyPlaying() {
        return this.isAudioPlaying;
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.clear();
        if (this.playbackContext && this.playbackContext.state !== 'closed') {
            this.playbackContext.close();
            this.playbackContext = null;
        }
    }
}
