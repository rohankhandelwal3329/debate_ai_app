/**
 * Manages WebSocket connection to Deepgram Voice Agent
 */

import { CONFIG, DEBATE_PROMPT } from './config.js';

export class WebSocketManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        
        // Event callbacks
        this.onConnected = null;
        this.onDisconnected = null;
        this.onMessage = null;
        this.onAudioData = null;
        this.onError = null;
    }

    /**
     * Connect to Deepgram Voice Agent
     * @param {string} apiKey - Deepgram API key
     * @param {string} userName - User's first name for greeting
     */
    async connect(apiKey, userName) {
        return new Promise((resolve, reject) => {
            console.log('Connecting to:', CONFIG.DEEPGRAM_WS_URL);

            this.socket = new WebSocket(CONFIG.DEEPGRAM_WS_URL, ['token', apiKey]);
            this.socket.binaryType = 'arraybuffer';

            const connectionTimeout = setTimeout(() => {
                if (this.socket.readyState !== WebSocket.OPEN) {
                    this.socket.close();
                    reject(new Error('Connection timeout - please check your API key'));
                }
            }, CONFIG.CONNECTION_TIMEOUT);

            this.socket.onopen = () => {
                console.log('WebSocket connected');
                clearTimeout(connectionTimeout);
                this.isConnected = true;
                this.sendSettings(userName);
                
                if (this.onConnected) this.onConnected();
                resolve();
            };

            this.socket.onmessage = (event) => {
                this.handleMessage(event);
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                clearTimeout(connectionTimeout);
                if (this.onError) this.onError(error);
                reject(new Error('Failed to connect to Deepgram. Please check your API key and internet connection.'));
            };

            this.socket.onclose = (event) => {
                console.log('WebSocket closed:', event.code, event.reason);
                clearTimeout(connectionTimeout);
                
                if (!this.isConnected) {
                    reject(new Error(`Connection closed: ${event.reason || 'Unknown reason'} (Code: ${event.code})`));
                }
                
                this.isConnected = false;
                if (this.onDisconnected) this.onDisconnected();
            };
        });
    }

    /**
     * Send settings configuration to the voice agent
     */
    sendSettings(userName) {
        const settings = {
            type: 'Settings',
            audio: {
                input: {
                    encoding: 'linear16',
                    sample_rate: CONFIG.INPUT_SAMPLE_RATE
                },
                output: {
                    encoding: 'linear16',
                    sample_rate: CONFIG.OUTPUT_SAMPLE_RATE,
                    container: 'none'
                }
            },
            agent: {
                language: 'en',
                listen: {
                    provider: {
                        type: 'deepgram',
                        model: 'nova-3'
                    }
                },
                think: {
                    provider: {
                        type: 'open_ai',
                        model: 'gpt-4o-mini'
                    },
                    prompt: DEBATE_PROMPT
                },
                speak: {
                    provider: {
                        type: 'deepgram',
                        model: 'aura-2-thalia-en'
                    }
                },
                greeting: `Hi ${userName}! I'm your AI debate partner. I'm excited to help you practice your debating skills today. What topic would you like to debate?`
            }
        };

        this.socket.send(JSON.stringify(settings));
        console.log('Settings sent:', settings);
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleMessage(event) {
        if (event.data instanceof ArrayBuffer) {
            // Binary audio data
            if (this.onAudioData) this.onAudioData(event.data);
        } else {
            // JSON message
            try {
                const message = JSON.parse(event.data);
                console.log('Received message:', message);
                if (this.onMessage) this.onMessage(message);
            } catch (e) {
                console.error('Error parsing message:', e);
            }
        }
    }

    /**
     * Send audio data to the server
     * @param {ArrayBuffer} data - PCM audio data
     */
    sendAudio(data) {
        if (this.isConnected && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(data);
        }
    }

    /**
     * Disconnect from the server
     */
    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.isConnected = false;
    }
}
