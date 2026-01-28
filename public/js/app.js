/**
 * AI Debate Partner - Main Application
 * Orchestrates all modules for the debate experience
 */

import { AudioRecorder } from './audioRecorder.js';
import { AudioPlayer } from './audioPlayer.js';
import { WebSocketManager } from './websocketManager.js';
import { UIManager } from './uiManager.js';
import { FeedbackManager } from './feedbackManager.js';
import { SessionManager } from './sessionManager.js';
import { ApiService } from './apiService.js';

class DebateApp {
    constructor() {
        // Initialize managers
        this.audioRecorder = new AudioRecorder();
        this.audioPlayer = new AudioPlayer();
        this.wsManager = new WebSocketManager();
        this.ui = new UIManager();
        this.feedbackManager = new FeedbackManager();
        this.sessionManager = new SessionManager();

        // Track AI speaking state for turn indicator
        this.aiIsSpeaking = false;

        // Bind event handlers
        this.bindEvents();
        this.setupWebSocketCallbacks();
        this.setupAudioCallbacks();

        // Check for existing session
        this.checkExistingSession();
    }

    /**
     * Bind UI event handlers
     */
    bindEvents() {
        // Hero page form submission
        this.ui.elements.studentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });

        // Logout button
        this.ui.elements.logoutBtn.addEventListener('click', () => this.logout());

        // Debate controls
        this.ui.elements.startBtn.addEventListener('click', () => this.startDebate());
        this.ui.elements.disconnectBtn.addEventListener('click', () => this.disconnect());
        this.ui.elements.clearConversation.addEventListener('click', () => this.ui.clearConversation());

        // Voice visualizer click to start
        this.ui.elements.voiceVisualizer.addEventListener('click', () => {
            if (!this.wsManager.isConnected) {
                this.startDebate();
            }
        });

        // Feedback dialog
        this.ui.elements.closeFeedbackBtn.addEventListener('click', () => {
            this.ui.hideFeedbackDialog();
            this.feedbackManager.clearFeedback();
        });

        this.ui.elements.newDebateBtn.addEventListener('click', () => {
            this.ui.hideFeedbackDialog();
            this.feedbackManager.clearFeedback();
            this.ui.clearConversation();
            this.startDebate();
        });

        // Close dialog on overlay click
        this.ui.elements.feedbackOverlay.addEventListener('click', (e) => {
            if (e.target === this.ui.elements.feedbackOverlay) {
                this.ui.hideFeedbackDialog();
                this.feedbackManager.clearFeedback();
            }
        });
    }

    /**
     * Setup WebSocket event callbacks
     */
    setupWebSocketCallbacks() {
        this.wsManager.onConnected = () => {
            this.ui.setConnectionStatus('connected');
            this.ui.addVisualizerClass('active');
            this.ui.setConnectedState();
            // Show turn indicator - user can speak now
            this.ui.showTurnIndicator();
        };

        this.wsManager.onDisconnected = () => {
            this.handleDisconnect();
        };

        this.wsManager.onMessage = (message) => {
            this.handleMessage(message);
        };

        this.wsManager.onAudioData = (data) => {
            this.audioPlayer.queueAudio(data);
        };

        this.wsManager.onError = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    /**
     * Setup audio playback callbacks for turn indicator
     */
    setupAudioCallbacks() {
        // When AI audio actually starts playing through speakers - hide turn indicator
        this.audioPlayer.onPlaybackStart = () => {
            this.aiIsSpeaking = true;
            this.ui.hideTurnIndicator();
            this.ui.addVisualizerClass('speaking');
        };

        // When AI audio finishes playing through speakers - show turn indicator
        this.audioPlayer.onPlaybackEnd = () => {
            this.aiIsSpeaking = false;
            this.ui.removeVisualizerClass('speaking');
            
            // Only show turn indicator if still connected
            if (this.wsManager.isConnected) {
                this.ui.showTurnIndicator();
            }
            
            // Check for auto-disconnect after audio actually finishes
            if (this.feedbackManager.shouldDisconnect()) {
                this.feedbackManager.clearAutoDisconnect();

                setTimeout(() => {
                    const feedback = this.feedbackManager.getFeedback();
                    if (feedback && feedback.trim()) {
                        this.ui.showFeedbackDialog(feedback);
                    }
                    this.forceDisconnect();
                }, 500);
            }
        };
    }

    /**
     * Check for existing user session
     */
    checkExistingSession() {
        const userData = this.sessionManager.loadSession();
        if (userData) {
            this.ui.showDebateApp(userData.name, userData.pantherId);
        }
    }

    /**
     * Handle form submission
     */
    handleFormSubmit() {
        const formData = this.ui.getFormData();

        if (formData.name && formData.pantherId && formData.email) {
            this.sessionManager.saveSession(formData);
            this.ui.showDebateApp(formData.name, formData.pantherId);
        }
    }

    /**
     * Logout user
     */
    logout() {
        if (this.wsManager.isConnected) {
            this.disconnect();
        }

        this.sessionManager.clearSession();
        this.ui.resetForm();
        this.ui.showHeroPage();
        this.ui.clearConversation();
    }

    /**
     * Start a new debate session
     */
    async startDebate() {
        try {
            this.ui.setConnectingState();
            this.ui.hideTurnIndicator();

            // Get API configuration
            const config = await ApiService.getConfig();

            // Setup microphone
            await this.audioRecorder.setup();

            // Connect to Deepgram
            const firstName = this.sessionManager.getFirstName();
            await this.wsManager.connect(config.apiKey, firstName);

            // Start audio streaming
            this.audioRecorder.start((audioData) => {
                this.wsManager.sendAudio(audioData);
            });

        } catch (error) {
            console.error('Error starting debate:', error);
            this.ui.setDisconnectedState();
        }
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleMessage(message) {
        switch (message.type) {
            case 'Welcome':
                console.log('Welcome received:', message);
                break;

            case 'SettingsApplied':
                console.log('Settings applied');
                break;

            case 'ConversationText':
                this.handleConversationText(message);
                break;

            case 'UserStartedSpeaking':
                // Hide turn indicator when user is speaking
                this.ui.hideTurnIndicator();
                this.ui.addVisualizerClass('user-speaking');
                break;

            case 'AgentThinking':
                // AI is processing - hide turn indicator, remove user speaking state
                this.ui.hideTurnIndicator();
                this.ui.removeVisualizerClass('user-speaking');
                break;

            case 'AgentStartedSpeaking':
            case 'AgentAudioDone':
                // Audio playback callbacks handle the turn indicator
                break;

            case 'Error':
                console.error('Agent error:', message);
                break;
        }
    }

    /**
     * Handle conversation text messages
     */
    handleConversationText(message) {
        const { role, content } = message;

        if (content && content.trim()) {
            this.ui.addMessage(role, content);
            this.feedbackManager.processMessage(content, role);
        }
    }

    /**
     * Disconnect with feedback dialog
     */
    disconnect() {
        const feedback = this.feedbackManager.getFeedback();
        if (feedback && feedback.trim()) {
            this.ui.showFeedbackDialog(feedback);
        }
        this.forceDisconnect();
    }

    /**
     * Force disconnect without showing feedback
     */
    forceDisconnect() {
        this.audioRecorder.stop();
        this.audioPlayer.destroy();
        this.wsManager.disconnect();
        this.feedbackManager.reset();

        this.ui.setConnectionStatus('disconnected');
        this.ui.hideTurnIndicator();
        this.ui.removeVisualizerClass('active', 'speaking', 'user-speaking');
        this.ui.setDisconnectedState();
    }

    /**
     * Handle unexpected disconnect
     */
    handleDisconnect() {
        this.aiIsSpeaking = false;
        
        this.audioRecorder.stop();
        this.audioPlayer.clear();
        this.feedbackManager.reset();

        this.ui.setConnectionStatus('disconnected');
        this.ui.hideTurnIndicator();
        this.ui.removeVisualizerClass('active', 'speaking', 'user-speaking');
        this.ui.setDisconnectedState();
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.debateApp = new DebateApp();
});
