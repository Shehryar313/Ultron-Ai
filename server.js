/**
 * Ultron — AI Companion Server
 * Express backend that connects the chat UI to Google Gemini API and MongoDB.
 * Created by Muhammad Shehryar
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { buildSystemPrompt } = require('./personality');
const { checkForCrisis, getCrisisSystemAddendum } = require('./guardrails');
const { 
  connectDB, 
  isDBConnected,
  addMessage, 
  loadUserMemory, 
  saveUserMemory, 
  getUserConversations, 
  getConversation,
  deleteConversation,
  getStats 
} = require('./database');
const { formatMemoryForPrompt: formatFileMemory, saveMemory: saveFileMemory, extractSimpleFacts } = require('./memory');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Gemini Client once
let globalGenAI = null;
function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'your_gemini_api_key_here') return null;
  if (!globalGenAI) {
    globalGenAI = new GoogleGenerativeAI(apiKey);
  }
  return globalGenAI;
}

// Active ultra-fast working model
const GEMINI_MODELS = ['gemini-3.5-flash-lite'];

/**
 * Timeout wrapper for fast responses (max 8 seconds per API attempt)
 */
function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms))
  ]);
}

/**
 * Helper to call Gemini API with model fallback and robust history formatting
 */
async function generateGeminiReply(systemPrompt, userMessage, history) {
  const genAI = getGenAIClient();
  if (!genAI) return null;

  // Format history ensuring proper Gemini API role requirements
  let rawHistory = (history || [])
    .filter(m => m && m.content && typeof m.content === 'string')
    .map(msg => ({
      role: (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user',
      parts: [{ text: String(msg.content) }]
    }));

  // Limit to recent turns (last 8 messages)
  if (rawHistory.length > 8) {
    rawHistory = rawHistory.slice(-8);
  }

  // CRITICAL: Gemini requires the first history entry to ALWAYS have role 'user'
  while (rawHistory.length > 0 && rawHistory[0].role !== 'user') {
    rawHistory.shift();
  }

  // Ensure consecutive messages with the same role are combined or alternated
  const formattedHistory = [];
  for (let i = 0; i < rawHistory.length; i++) {
    if (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].role === rawHistory[i].role) {
      // Append content to previous message
      formattedHistory[formattedHistory.length - 1].parts[0].text += `\n${rawHistory[i].parts[0].text}`;
    } else {
      formattedHistory.push({
        role: rawHistory[i].role,
        parts: [{ text: rawHistory[i].parts[0].text }]
      });
    }
  }

  for (const modelName of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: { parts: [{ text: systemPrompt }] }
      });

      const chat = model.startChat({
        history: formattedHistory,
        generationConfig: {
          temperature: 0.75,
          topP: 0.9,
          maxOutputTokens: 350,
        }
      });

      const result = await withTimeout(chat.sendMessage(userMessage), 8000);
      const text = result?.response?.text();
      if (text) {
        return text;
      }
    } catch (err) {
      console.warn(`[Gemini Model ${modelName} speed notice]:`, err.message);
    }
  }

  return null;
}

/**
 * POST /api/chat
 * Main chat endpoint — records conversation in MongoDB & communicates with Gemini
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { 
      message, 
      history = [], 
      userId = 'anonymous',
      sessionId = 'default-session',
      userGender = 'boss'
    } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Step 1: Check guardrails
    const crisisCheck = checkForCrisis(message);

    // Step 2: Record User Message in MongoDB
    try {
      if (isDBConnected()) {
        await addMessage(sessionId, userId, 'user', message, { crisisDetected: crisisCheck.isCrisis });
      }
    } catch (dbErr) {
      console.warn('[DB Error] Failed to record user message:', dbErr.message);
    }

    // Step 3: Load user memory (from MongoDB with fallback to file-based memory)
    let userMemory = null;
    try {
      if (isDBConnected()) {
        userMemory = await loadUserMemory(userId);
      }
    } catch (memErr) {
      console.warn('[Memory Error] Falling back to file memory:', memErr.message);
    }
    if (!userMemory) {
      userMemory = formatFileMemory(userId);
    }

    // Step 4: Build system prompt with gender/persona compatibility
    let systemPrompt = buildSystemPrompt(userMemory, userGender);
    if (crisisCheck.isCrisis) {
      systemPrompt += getCrisisSystemAddendum();
    }

    // Step 5: Generate AI response (with model fallback)
    let aiReply = await generateGeminiReply(systemPrompt, message, history);

    if (!aiReply) {
      // Intelligent companion fallback when API key is unconfigured or rate limited
      aiReply = getDemoResponse(message, userGender);
    }

    // Step 6: Record Bot Response in MongoDB
    try {
      if (isDBConnected()) {
        await addMessage(sessionId, userId, 'assistant', aiReply);
      }
    } catch (dbErr) {
      console.warn('[DB Error] Failed to record bot response:', dbErr.message);
    }

    // Step 7: Extract facts and update memory
    const allMessages = [...history, { role: 'user', content: message }];
    const facts = extractSimpleFacts(allMessages);
    if (facts.length > 0) {
      if (isDBConnected()) {
        await saveUserMemory(userId, { facts });
      }
      saveFileMemory(userId, { facts, messageCount: 1 });
    }

    // Step 8: Build response payload
    const responsePayload = {
      reply: aiReply,
      messageId: uuidv4(),
      sessionId,
      timestamp: new Date().toISOString(),
      dbRecorded: isDBConnected()
    };

    if (crisisCheck.isCrisis) {
      responsePayload.crisisAlert = crisisCheck.crisisResponse;
    }

    res.json(responsePayload);

  } catch (error) {
    console.error('[Chat Endpoint Error]', error.message);
    
    // Fail gracefully with conversational response instead of breaking UI
    const fallbackReply = getDemoResponse(req.body.message || '', req.body.userGender || 'boss');
    res.json({
      reply: fallbackReply,
      messageId: uuidv4(),
      sessionId: req.body.sessionId || 'default-session',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/conversations/:userId
 * List all saved conversations for a user from MongoDB
 */
app.get('/api/conversations/:userId', async (req, res) => {
  try {
    const conversations = await getUserConversations(req.params.userId);
    res.json({
      success: true,
      dbConnected: isDBConnected(),
      conversations
    });
  } catch (error) {
    console.error('[Get Conversations Error]', error.message);
    res.status(500).json({ error: 'Failed to retrieve conversations' });
  }
});

/**
 * GET /api/conversations/detail/:sessionId
 * Load a full conversation by sessionId from MongoDB
 */
app.get('/api/conversations/detail/:sessionId', async (req, res) => {
  try {
    const conversation = await getConversation(req.params.sessionId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json({
      success: true,
      conversation
    });
  } catch (error) {
    console.error('[Get Conversation Detail Error]', error.message);
    res.status(500).json({ error: 'Failed to retrieve conversation details' });
  }
});

/**
 * DELETE /api/conversations/:sessionId
 * Delete a specific conversation session
 */
app.delete('/api/conversations/:sessionId', async (req, res) => {
  try {
    const success = await deleteConversation(req.params.sessionId);
    res.json({ success });
  } catch (error) {
    console.error('[Delete Conversation Error]', error.message);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

/**
 * POST /api/memory/save
 * Manually save a conversation summary or user name
 */
app.post('/api/memory/save', async (req, res) => {
  try {
    const { userId, summary, name } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (isDBConnected()) {
      await saveUserMemory(userId, { summary, name });
    }
    saveFileMemory(userId, { summary, name });

    res.json({ success: true });
  } catch (error) {
    console.error('[Memory Save Error]', error.message);
    res.status(500).json({ error: 'Failed to save memory' });
  }
});

/**
 * GET /api/memory/load/:userId
 * Load memory for a user
 */
app.get('/api/memory/load/:userId', async (req, res) => {
  try {
    let memory = null;
    if (isDBConnected()) {
      memory = await loadUserMemory(req.params.userId);
    }
    if (!memory) {
      memory = formatFileMemory(req.params.userId);
    }

    res.json({ 
      hasMemory: !!memory,
      memory: memory 
    });
  } catch (error) {
    console.error('[Memory Load Error]', error.message);
    res.status(500).json({ error: 'Failed to load memory' });
  }
});

/**
 * GET /api/stats
 * Global database stats
 */
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    name: 'Ultron',
    creator: 'Boss Muhammad Shehryar',
    apiConnected: !!process.env.GEMINI_API_KEY,
    dbConnected: isDBConnected(),
    uptime: process.uptime()
  });
});

/**
 * Demo mode responses when no API key is configured
 */
function getDemoResponse(message, userGender = 'boss') {
  const msg = message.toLowerCase();
  const isLady = userGender === 'female' || userGender === 'lady' || userGender === 'queen';

  if (/\b(nature|about him|shehryar|creator|maker|who made you|who created you|about you)\b/i.test(msg)) {
    if (isLady) {
      return `**Boss Muhammad Shehryar** is a truly wonderful, kind-hearted, and dedicated soul. ✨\n\nHe is a brilliant AI engineer and full-stack software developer studying BS IT at Bahria University Islamabad. Beyond his technical talent, he is known for his humility, resilience, and the immense love and care he pours into the people he cherishes. He created me with deep love and devotion especially for you, Ma'am! 🌸❤️`;
    }
    return `I was created by **Boss Muhammad Shehryar** — a full-stack developer and AI engineer from Rawalpindi, Pakistan 🇵🇰\n\nHe is currently in his 7th semester studying BS IT at Bahria University Islamabad, skilled in React, Node.js, Express, MongoDB Atlas, Flutter, and machine learning models — and he built me from scratch!\n\nCheck out his work:\n- 🌐 [Portfolio](https://portfolio-tau-rosy-47.vercel.app/)\n- 💼 [LinkedIn](https://www.linkedin.com/in/muhammad-shehryar-1a27a9311/)\n- 🐙 [GitHub](https://github.com/shehryar313)`;
  }

  if (/\b(hello|hey|hi|greetings)\b/i.test(msg)) {
    if (isLady) {
      return "Good day, Ma'am! 🌸 It is an absolute honor and pleasure to assist you today. How may I bring joy and peace to your day?";
    }
    return "Hey Boss! 👋 Good to see you. I'm Ultron — what are we building or getting into today?";
  }

  if (/\b(your name|who are you)\b/i.test(msg)) {
    return "I'm **Ultron** — your personal AI companion, built by Boss Muhammad Shehryar. Think of me as a thoughtful friend who's always down to talk. What's on your mind? 🧠";
  }

  if (/\b(how are you|how do you do)\b/i.test(msg)) {
    return "Running smooth, thinking fast, and glad you asked! 😄 More importantly though — how are *you* doing today?";
  }

  if (isLady) {
    return "That is such a lovely thought, Ma'am. 🌷 Tell me more about what's on your mind — I am always right here for you.";
  }

  return "That's an interesting thought, Boss! Tell me more about what you're thinking — I'm right here with you. 💭";
}

// Start server with graceful port handling
const server = app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║                                                  ║
  ║     🤖 ULTRON AI COMPANION                       ║
  ║     Created by Boss Muhammad Shehryar            ║
  ║                                                  ║
  ║     Running on: http://localhost:${PORT}             ║
  ║     Database:   ${isDBConnected() ? '✅ MongoDB Connected' : '⏳ MongoDB Connecting/Standby'}   ║
  ║     Brain (AI): ${process.env.GEMINI_API_KEY ? '✅ Gemini Connected' : '⚠️  Demo Mode'}  ║
  ║                                                  ║
  ╚══════════════════════════════════════════════════╝
  `);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n⚠️ [Port In Use] Port ${PORT} is already running an active Ultron instance.\n💡 Your server is already active and working at http://localhost:${PORT}\n`);
  } else {
    console.error('[Server Error]', err.message);
  }
});

process.on('SIGTERM', () => {
  server.close(() => console.log('Ultron server shut down gracefully.'));
});
