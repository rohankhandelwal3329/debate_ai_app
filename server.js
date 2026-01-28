const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to get Deepgram configuration
// This keeps the API key secure on the server side
app.get('/api/config', (req, res) => {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    
    if (!apiKey) {
        return res.status(500).json({ 
            error: 'Deepgram API key not configured. Please set DEEPGRAM_API_KEY in .env file.' 
        });
    }
    
    res.json({ 
        apiKey: apiKey,
        wsUrl: 'wss://agent.deepgram.com/v1/agent/converse'
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve the main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server (only when not in Vercel)
if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🎤 AI Debate Partner - Server Running                    ║
║                                                            ║
║   Local:    http://localhost:${PORT}                         ║
║                                                            ║
║   Make sure to set your DEEPGRAM_API_KEY in .env file      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
        `);
    });
}

// Export for Vercel
module.exports = app;
