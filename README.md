# AI Debate Partner

An AI-powered debate training tool that helps students improve their argumentation and debating skills through voice-based conversations.

## Features

- **Voice-based interaction**: Natural voice conversations powered by Deepgram's Voice Agent API
- **Structured debate flow**: Topic selection, side picking, debate rounds, and feedback
- **Real-time feedback**: Get personalized coaching on your debating performance
- **Modern UI**: Beautiful, responsive interface with visual audio indicators
- **Socio-political focus**: Designed for debates on social and political topics

## How It Works

1. **Start the Debate**: Click "Start Debate" and allow microphone access
2. **Choose Your Topic**: Tell the AI what socio-political topic you want to debate
3. **Pick Your Side**: Choose which position you want to argue for
4. **Debate!**: Present your arguments - the AI will take the opposing side and challenge your ideas respectfully
5. **Get Feedback**: Say "done" or click "End & Get Feedback" for personalized coaching on your debating skills

## Setup

### Prerequisites

- Node.js (v16 or higher)
- A Deepgram API key ([Get one here](https://console.deepgram.com/signup))

### Installation

1. Clone or download this project

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your API key:
   - Open the `.env` file
   - Add your Deepgram API key:
     ```
     DEEPGRAM_API_KEY=your_api_key_here
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
├── server.js           # Express server for API key handling
├── package.json        # Project dependencies
├── .env               # Environment configuration (add your API key here)
├── .env.example       # Example environment file
├── README.md          # This file
└── public/
    ├── index.html     # Main HTML page
    ├── styles.css     # Styling
    └── app.js         # Frontend JavaScript (Deepgram integration)
```

## Technology Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Voice AI**: Deepgram Voice Agent API
- **Speech Recognition**: Deepgram Nova-3
- **Text-to-Speech**: Deepgram Aura-2

## Tips for Better Debates

- Use evidence and examples to support your points
- Address counterarguments directly
- Stay calm and focused on ideas, not emotions
- Structure your arguments clearly
- Practice speaking at a moderate pace

## Troubleshooting

### Microphone not working
- Make sure you've granted microphone permissions in your browser
- Check that your microphone is properly connected and selected as the input device

### Connection issues
- Verify your Deepgram API key is correctly set in the `.env` file
- Check your internet connection
- Make sure no firewall is blocking WebSocket connections

### No audio playback
- Check your speaker/headphone volume
- Make sure your browser supports Web Audio API
- Try refreshing the page

## License

MIT License
