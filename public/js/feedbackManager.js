/**
 * Manages feedback detection and collection
 */

import { CONFIG } from './config.js';

export class FeedbackManager {
    constructor() {
        this.isInFeedbackMode = false;
        this.feedbackBuffer = '';
        this.shouldAutoDisconnect = false;
    }

    /**
     * Process conversation text to detect feedback triggers
     * @param {string} content - Message content
     * @param {string} role - 'user' or 'agent'
     * @returns {Object} Status of feedback detection
     */
    processMessage(content, role) {
        const lowerContent = content.toLowerCase();
        let result = {
            feedbackModeActivated: false,
            feedbackComplete: false
        };

        // Detect when user ends the debate
        if (role === 'user') {
            const isEndPhrase = CONFIG.END_PHRASES.some(phrase => 
                lowerContent.includes(phrase)
            );

            if (isEndPhrase) {
                this.isInFeedbackMode = true;
                this.feedbackBuffer = '';
                result.feedbackModeActivated = true;
                console.log('Feedback mode activated - waiting for AI feedback');
            }
        }

        // Collect feedback from agent (role can be 'agent' or 'assistant')
        if (role === 'agent' || role === 'assistant') {
            // Check if this message contains feedback indicators
            const feedbackIndicators = [
                'feedback', 'strengths', 'areas to improve', 'improve',
                'you did well', 'you did great', 'your arguments',
                'you explained', 'try adding', 'consider adding',
                'next time', 'in future', 'coaching', 'let me give you',
                'here is my feedback', 'here\'s my feedback', 'my feedback',
                'areas you can improve', 'things to work on', 'worked well',
                'recommendations', 'suggest', 'i recommend', 'i\'d recommend'
            ];
            
            const containsFeedback = feedbackIndicators.some(indicator =>
                lowerContent.includes(indicator)
            );
            
            // Auto-activate feedback mode if we detect feedback content
            if (containsFeedback && !this.isInFeedbackMode) {
                this.isInFeedbackMode = true;
                this.feedbackBuffer = '';
                console.log('Feedback content detected - activating feedback mode');
            }
            
            if (this.isInFeedbackMode) {
                this.feedbackBuffer += (this.feedbackBuffer ? ' ' : '') + content;
            }

            // Check for closing phrases (case-insensitive)
            const isFeedbackComplete = CONFIG.CLOSING_PHRASES.some(phrase =>
                lowerContent.includes(phrase.toLowerCase())
            );

            if (isFeedbackComplete) {
                
                // If we didn't collect feedback yet, use this message
                if (!this.feedbackBuffer) {
                    this.feedbackBuffer = content;
                }
                
                this.isInFeedbackMode = false;
                this.shouldAutoDisconnect = true;
                result.feedbackComplete = true;
            }
        }

        return result;
    }

    /**
     * Get collected feedback
     */
    getFeedback() {
        return this.feedbackBuffer;
    }

    /**
     * Check if auto-disconnect should occur
     */
    shouldDisconnect() {
        return this.shouldAutoDisconnect;
    }

    /**
     * Clear the auto-disconnect flag
     */
    clearAutoDisconnect() {
        this.shouldAutoDisconnect = false;
    }

    /**
     * Clear feedback buffer
     */
    clearFeedback() {
        this.feedbackBuffer = '';
    }

    /**
     * Reset all state
     */
    reset() {
        this.isInFeedbackMode = false;
        this.feedbackBuffer = '';
        this.shouldAutoDisconnect = false;
    }
}
