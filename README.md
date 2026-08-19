# Ultron — AI Companion Chatbot 🤖

> Created with 💜 by **Muhammad Shehryar**

A premium conversational AI companion powered by Google Gemini and MongoDB. Warm, witty, and always ready to talk.

---

## Key Features

- 🧠 **Google Gemini AI Engine** — Fast, contextual, emotionally intuitive replies
- 💜 **Custom Character & Persona** — Warm, witty, calm conversational style
- 💾 **MongoDB Full Conversation Recording** — Records every conversation session, message timestamps, and key extracted facts
- 🗂️ **Session History Sidebar** — Browse, reopen, and delete past conversations directly from MongoDB
- 🛡️ **Crisis Safety Guardrails** — Real emergency helpline detection (including Pakistan, US, UK, Global)
- 🎨 **State-of-the-art Dark UI** — Glassmorphism, animated aurora canvas, glowing avatar ring, markdown syntax highlighting
- 📱 **Mobile & Desktop Responsive** — Seamless drawer sidebar and fluid input field

---

## Quick Start

### 1. Configure Environment
Copy `.env.example` to `.env` (or edit [.env](file:///d:/Ai%20Agent/.env)):
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/ultron
```
> **Tip:** You can get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey). For MongoDB, you can use local MongoDB or MongoDB Atlas.

### 2. Install & Start
```bash
npm install
npm start
```

### 3. Open in Browser
Visit **[http://localhost:3000](http://localhost:3000)**

---

## Project Structure

```
├── server.js          # Express API server (Chat, MongoDB sync, Gemini integration)
├── database.js        # MongoDB Mongoose schemas (Conversations & UserMemory)
├── personality.js     # Ultron's character prompt & embedded owner dataset
├── guardrails.js      # Crisis detection engine & helplines
├── memory.js          # In-memory / file fallback memory module
├── public/
│   ├── index.html     # Semantic chat UI with saved conversation history
│   ├── styles.css     # Dark glassmorphism styling & animations
│   └── app.js         # Frontend state, Markdown rendering, MongoDB sync
├── .env               # Environment variables
└── package.json       # Node.js manifest & dependencies
```

---

## Creator Information

**Muhammad Shehryar** — Full-Stack Developer & AI Engineer
- 🎓 **Education:** BS IT (7th Sem), Bahria University Islamabad
- 📍 **Location:** Rawalpindi, Pakistan
- 🌐 **Portfolio:** [portfolio-tau-rosy-47.vercel.app](https://portfolio-tau-rosy-47.vercel.app/)
- 💼 **LinkedIn:** [linkedin.com/in/muhammad-shehryar-1a27a9311](https://www.linkedin.com/in/muhammad-shehryar-1a27a9311/)
- 🐙 **GitHub:** [github.com/shehryar313](https://github.com/shehryar313)
