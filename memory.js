/**
 * Ultron — Memory System
 * Simple file-based memory for cross-session persistence.
 * 
 * Stores user data as JSON files in /data/users/.
 * Each user gets their own file with:
 *   - Key facts about them
 *   - Conversation summaries
 *   - Last seen timestamp
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data', 'users');

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Get the file path for a user's memory file.
 * @param {string} userId 
 * @returns {string}
 */
function getUserFilePath(userId) {
  return path.join(DATA_DIR, `${userId}.json`);
}

/**
 * Load a user's memory from disk.
 * @param {string} userId 
 * @returns {object|null} The user's memory data, or null if not found
 */
function loadMemory(userId) {
  ensureDataDir();
  const filePath = getUserFilePath(userId);
  
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`[Memory] Failed to load memory for user ${userId}:`, err.message);
    return null;
  }
}

/**
 * Save/update a user's memory to disk.
 * @param {string} userId 
 * @param {object} memoryData - { name, facts, summaries, lastSeen }
 */
function saveMemory(userId, memoryData) {
  ensureDataDir();
  const filePath = getUserFilePath(userId);

  // Merge with existing data if present
  let existing = loadMemory(userId) || {
    userId,
    name: null,
    facts: [],
    conversationSummaries: [],
    messageCount: 0,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString()
  };

  // Update fields
  if (memoryData.name) existing.name = memoryData.name;
  if (memoryData.facts && memoryData.facts.length > 0) {
    // Deduplicate facts
    const existingFacts = new Set(existing.facts.map(f => f.toLowerCase()));
    for (const fact of memoryData.facts) {
      if (!existingFacts.has(fact.toLowerCase())) {
        existing.facts.push(fact);
      }
    }
    // Keep only last 50 facts
    if (existing.facts.length > 50) {
      existing.facts = existing.facts.slice(-50);
    }
  }
  if (memoryData.summary) {
    existing.conversationSummaries.push({
      summary: memoryData.summary,
      date: new Date().toISOString()
    });
    // Keep only last 20 summaries
    if (existing.conversationSummaries.length > 20) {
      existing.conversationSummaries = existing.conversationSummaries.slice(-20);
    }
  }
  if (memoryData.messageCount) {
    existing.messageCount += memoryData.messageCount;
  }
  existing.lastSeen = new Date().toISOString();

  try {
    fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[Memory] Failed to save memory for user ${userId}:`, err.message);
  }
}

/**
 * Format a user's memory into a string for injection into the system prompt.
 * @param {string} userId 
 * @returns {string|null}
 */
function formatMemoryForPrompt(userId) {
  const memory = loadMemory(userId);
  if (!memory) return null;

  let parts = [];

  if (memory.name) {
    parts.push(`- The user's name is: ${memory.name}`);
  }

  parts.push(`- You've had ${memory.messageCount || 0} messages with this user`);
  parts.push(`- First conversation: ${memory.firstSeen}`);
  parts.push(`- Last conversation: ${memory.lastSeen}`);

  if (memory.facts && memory.facts.length > 0) {
    parts.push(`\nKey facts about this user:`);
    for (const fact of memory.facts) {
      parts.push(`- ${fact}`);
    }
  }

  if (memory.conversationSummaries && memory.conversationSummaries.length > 0) {
    parts.push(`\nRecent conversation summaries:`);
    const recentSummaries = memory.conversationSummaries.slice(-5);
    for (const s of recentSummaries) {
      parts.push(`- [${s.date}]: ${s.summary}`);
    }
  }

  return parts.join('\n');
}

/**
 * Extract facts from a conversation using simple heuristics.
 * (In production, you'd use the LLM to extract these)
 * @param {Array} messages - Array of { role, content } messages
 * @returns {string[]} Extracted facts
 */
function extractSimpleFacts(messages) {
  const facts = [];
  const userMessages = messages.filter(m => m.role === 'user');
  
  for (const msg of userMessages) {
    const content = msg.content;
    
    // Name detection
    const nameMatch = content.match(/(?:my name is|i'm|i am|call me)\s+([A-Za-z0-9_\s]+)/i);
    if (nameMatch) {
      const cleanName = nameMatch[1].replace(/["\\]/g, '').trim();
      facts.push(`Their name is ${cleanName}`);
    }

    // Age detection
    const ageMatch = content.match(/(?:i'm|i am|im)\s+(\d{1,2})\s*(?:years?\s*old)?/i);
    if (ageMatch) {
      facts.push(`They are ${ageMatch[1]} years old`);
    }

    // Location detection
    const locationMatch = content.match(/(?:i live in|i'm from|i am from|from)\s+([A-Z][a-zA-Z\s,]+)/i);
    if (locationMatch) {
      facts.push(`They are from ${locationMatch[1].trim()}`);
    }

    // Job/study detection
    const jobMatch = content.match(/(?:i work as|i'm a|i am a|i study|i'm studying)\s+(.+?)(?:\.|$)/i);
    if (jobMatch) {
      facts.push(`They ${jobMatch[0].trim()}`);
    }

    // Interest detection
    const interestMatch = content.match(/(?:i love|i enjoy|i like|i'm into|my hobby is)\s+(.+?)(?:\.|$)/i);
    if (interestMatch) {
      facts.push(`They enjoy ${interestMatch[1].trim()}`);
    }
  }

  return facts;
}

module.exports = { loadMemory, saveMemory, formatMemoryForPrompt, extractSimpleFacts };
