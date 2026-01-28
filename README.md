# AI Debate Partner

An AI-powered debate training tool that helps students improve their argumentation and debating skills through real-time voice conversations.

## Features

- **Voice-based Interaction**: Natural voice conversations powered by Deepgram's Voice Agent API
- **Structured Debate Flow**: Topic selection, side picking, back-and-forth debate, and detailed feedback
- **Detailed Feedback**: Get comprehensive coaching with specific strengths, areas to improve, and actionable recommendations
- **Student Login**: Personalized experience with name, Panther ID, and email registration
- **Modern Light UI**: Clean, responsive interface with real-time audio visualization
- **Auto-disconnect**: Automatically ends session after AI delivers feedback
- **Session Persistence**: Stay logged in during your browser session

## How It Works

1. **Register**: Enter your name, Panther ID, and student email
2. **Start the Debate**: Click "Start Debate" and allow microphone access
3. **Choose Your Topic**: Tell the AI what topic you want to debate (socio-political topics work great)
4. **Pick Your Side**: Choose which position you want to argue for
5. **Debate!**: Present your arguments - the AI will take the opposing side and challenge your ideas respectfully
6. **Get Feedback**: Say "done", "stop", or "finish" to receive detailed personalized coaching

## Feedback Includes

- **Strengths**: Specific effective arguments, good examples used, strong techniques
- **Areas to Improve**: Weak points, logical gaps, missed opportunities
- **Recommendations**: Concrete tips and techniques for your next debate

## Setup

### Prerequisites

- Node.js (v16 or higher)
- A Deepgram API key ([Get one here](https://console.deepgram.com/signup))

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd debate_ai_app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your Deepgram API key:
   ```
   DEEPGRAM_API_KEY=your_api_key_here
   PORT=3000
   ```

4. Start the server:
   ```bash
   npm start
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Project Structure

```
debate_ai_app/
├── server.js              # Express server for API key proxy
├── package.json           # Project dependencies
├── .env                   # Environment variables (not committed)
├── .env.example           # Example environment file
├── .gitignore             # Git ignore rules
├── README.md              # Documentation
└── public/
    ├── index.html         # Main HTML (hero page + debate interface)
    ├── styles.css         # Light theme styling
    └── js/
        ├── app.js             # Main application orchestrator
        ├── config.js          # Configuration and AI prompt
        ├── audioRecorder.js   # Microphone handling and audio capture
        ├── audioPlayer.js     # AI audio playback with queue management
        ├── websocketManager.js # Deepgram WebSocket connection
        ├── uiManager.js       # DOM manipulation and UI updates
        ├── feedbackManager.js # Feedback detection and collection
        ├── sessionManager.js  # User session storage
        └── apiService.js      # Backend API communication
```

## Technology Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla JavaScript (ES6 Modules), HTML5, CSS3
- **Voice AI**: Deepgram Voice Agent API
- **Speech Recognition**: Deepgram Nova-3
- **Text-to-Speech**: Deepgram Aura-2 (Asteria voice)
- **Audio Processing**: Web Audio API

## Tips for Better Debates

- Use evidence and examples to support your points
- Address counterarguments directly
- Stay calm and focused on ideas, not emotions
- Structure your arguments clearly (claim, evidence, reasoning)
- Practice speaking at a moderate pace

## Troubleshooting

### Microphone not working
- Make sure you've granted microphone permissions in your browser
- Check that your microphone is properly connected and selected

### Connection issues
- Verify your Deepgram API key is correctly set in the `.env` file
- Check your internet connection
- Make sure no firewall is blocking WebSocket connections

### No audio playback
- Check your speaker/headphone volume
- Try clicking somewhere on the page first (browsers require user interaction for audio)
- Try refreshing the page

### Debate not ending automatically
- Make sure to say clear ending phrases like "done", "stop", or "finish"
- The AI will give feedback and then automatically disconnect

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DEEPGRAM_API_KEY` | Your Deepgram API key | Yes |
| `PORT` | Server port (default: 3000) | No |
