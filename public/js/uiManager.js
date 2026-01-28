/**
 * Manages UI updates and DOM manipulation
 */

export class UIManager {
    constructor() {
        // Cache DOM elements
        this.elements = {
            // Hero page
            heroPage: document.getElementById('heroPage'),
            debateApp: document.getElementById('debateApp'),
            studentForm: document.getElementById('studentForm'),
            displayName: document.getElementById('displayName'),
            displayId: document.getElementById('displayId'),
            
            // Status and turn indicator
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            turnIndicator: document.getElementById('turnIndicator'),
            voiceVisualizer: document.getElementById('voiceVisualizer'),
            
            // Conversation
            conversationContainer: document.getElementById('conversationContainer'),
            emptyState: document.getElementById('emptyState'),
            
            // Controls
            startBtn: document.getElementById('startBtn'),
            disconnectBtn: document.getElementById('disconnectBtn'),
            clearConversation: document.getElementById('clearConversation'),
            logoutBtn: document.getElementById('logoutBtn')
        };
    }

    /**
     * Show the debate app and hide hero page
     */
    showDebateApp(userName, odaIPanther) {
        this.elements.displayName.textContent = userName;
        this.elements.displayId.textContent = `ID: ${odaIPanther}`;
        this.elements.heroPage.style.display = 'none';
        this.elements.debateApp.style.display = 'grid';
    }

    /**
     * Show the hero page and hide debate app
     */
    showHeroPage() {
        this.elements.heroPage.style.display = 'flex';
        this.elements.debateApp.style.display = 'none';
    }

    /**
     * Update connection status (only: ready, connected, disconnected)
     */
    setConnectionStatus(status) {
        this.elements.statusIndicator.className = 'status-indicator';
        
        switch (status) {
            case 'connected':
                this.elements.statusIndicator.classList.add('connected');
                this.elements.statusText.textContent = 'Connected';
                break;
            case 'disconnected':
                this.elements.statusIndicator.classList.add('disconnected');
                this.elements.statusText.textContent = 'Disconnected';
                break;
            default:
                this.elements.statusText.textContent = 'Ready to connect';
                break;
        }
    }

    /**
     * Show the "Your turn to speak" indicator
     */
    showTurnIndicator() {
        this.elements.turnIndicator.style.display = 'flex';
    }

    /**
     * Hide the "Your turn to speak" indicator
     */
    hideTurnIndicator() {
        this.elements.turnIndicator.style.display = 'none';
    }

    /**
     * Set voice visualizer state
     */
    setVisualizerState(state) {
        const visualizer = this.elements.voiceVisualizer;
        visualizer.classList.remove('active', 'speaking', 'user-speaking');
        
        if (state === 'active') visualizer.classList.add('active');
        if (state === 'speaking') visualizer.classList.add('speaking');
        if (state === 'user-speaking') visualizer.classList.add('user-speaking');
    }

    /**
     * Add visualizer class
     */
    addVisualizerClass(className) {
        this.elements.voiceVisualizer.classList.add(className);
    }

    /**
     * Remove visualizer class
     */
    removeVisualizerClass(...classNames) {
        this.elements.voiceVisualizer.classList.remove(...classNames);
    }

    /**
     * Set button states for connected state
     */
    setConnectedState() {
        this.elements.startBtn.disabled = true;
        this.elements.startBtn.querySelector('span').textContent = 'Debating...';
        this.elements.disconnectBtn.disabled = false;
    }

    /**
     * Set button states for disconnected state
     */
    setDisconnectedState() {
        this.elements.startBtn.disabled = false;
        this.elements.startBtn.querySelector('span').textContent = 'Start Debate';
        this.elements.disconnectBtn.disabled = true;
        this.setConnectionStatus('ready');
    }

    /**
     * Set start button to connecting state
     */
    setConnectingState() {
        this.elements.startBtn.disabled = true;
    }

    /**
     * Add a message to the conversation
     */
    addMessage(role, content) {
        // Hide empty state
        if (this.elements.emptyState) {
            this.elements.emptyState.style.display = 'none';
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role === 'user' ? 'user' : 'agent'}`;

        const labelDiv = document.createElement('div');
        labelDiv.className = 'message-label';
        labelDiv.textContent = role === 'user' ? 'You' : 'AI Debate Partner';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = content;

        messageDiv.appendChild(labelDiv);
        messageDiv.appendChild(contentDiv);

        this.elements.conversationContainer.appendChild(messageDiv);

        // Auto-scroll to bottom
        requestAnimationFrame(() => {
            this.elements.conversationContainer.scrollTo({
                top: this.elements.conversationContainer.scrollHeight,
                behavior: 'smooth'
            });
        });
    }

    /**
     * Clear conversation history
     */
    clearConversation() {
        this.elements.conversationContainer.innerHTML = `
            <div class="empty-state" id="emptyState">
                <div class="empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                </div>
                <p>Start the debate to see the conversation here</p>
            </div>
        `;
        this.elements.emptyState = document.getElementById('emptyState');
    }

    /**
     * Reset form
     */
    resetForm() {
        this.elements.studentForm.reset();
    }

    /**
     * Get form data
     */
    getFormData() {
        return {
            name: document.getElementById('studentName').value.trim(),
            pantherId: document.getElementById('pantherId').value.trim(),
            email: document.getElementById('studentEmail').value.trim()
        };
    }
}
