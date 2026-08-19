/**
 * Ultron — MongoDB Database Configuration & Models
 * Stores all conversations, messages, and user memory.
 * Created by Muhammad Shehryar
 */

const mongoose = require('mongoose');

let isConnected = false;

// ─── Connect to MongoDB ───
async function connectDB() {
  const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ultron';
  
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });
    isConnected = true;
    console.log('✅ MongoDB connected successfully:', MONGO_URI);
  } catch (error) {
    isConnected = false;
    console.warn('⚠️  MongoDB connection notice:', error.message);
    console.warn('   Running with in-memory / graceful mode. Once MongoDB is active, restart or set MONGODB_URI.');
  }

  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] Connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.warn('[MongoDB] Disconnected.');
  });

  mongoose.connection.on('connected', () => {
    isConnected = true;
    console.log('[MongoDB] Connected.');
  });
}

function isDBConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

// ─── Schemas ───

/**
 * Message Schema — Individual chat messages
 */
const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  metadata: {
    crisisDetected: { type: Boolean, default: false },
    tokenCount: { type: Number, default: 0 }
  }
});

/**
 * Conversation Schema — A full chat session
 */
const conversationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    default: 'New Conversation'
  },
  messages: [messageSchema],
  summary: {
    type: String,
    default: null
  },
  messageCount: {
    type: Number,
    default: 0
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
conversationSchema.index({ userId: 1, lastMessageAt: -1 });
conversationSchema.index({ userId: 1, isActive: 1 });

/**
 * User Memory Schema — Persistent facts and preferences across sessions
 */
const userMemorySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    default: null
  },
  facts: [{
    fact: String,
    learnedAt: { type: Date, default: Date.now },
    source: { type: String, default: 'conversation' }
  }],
  preferences: {
    type: Map,
    of: String,
    default: {}
  },
  totalConversations: {
    type: Number,
    default: 0
  },
  totalMessages: {
    type: Number,
    default: 0
  },
  firstSeen: {
    type: Date,
    default: Date.now
  },
  lastSeen: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// ─── Models ───
const Conversation = mongoose.model('Conversation', conversationSchema);
const UserMemory = mongoose.model('UserMemory', userMemorySchema);

// ─── Database Operations ───

/**
 * Create or get active conversation for a user session
 */
async function getOrCreateConversation(userId, sessionId) {
  if (!isDBConnected()) return null;
  
  let conversation = await Conversation.findOne({ sessionId });
  
  if (!conversation) {
    conversation = await Conversation.create({
      userId,
      sessionId,
      messages: [],
      messageCount: 0
    });

    // Increment user's total conversations
    await UserMemory.findOneAndUpdate(
      { userId },
      { 
        $inc: { totalConversations: 1 },
        $set: { lastSeen: new Date() },
        $setOnInsert: { firstSeen: new Date() }
      },
      { upsert: true }
    );
  }

  return conversation;
}

/**
 * Add a message to a conversation and update stats
 */
async function addMessage(sessionId, userId, role, content, metadata = {}) {
  if (!isDBConnected()) return null;

  // Make sure conversation exists
  await getOrCreateConversation(userId, sessionId);

  const conversation = await Conversation.findOneAndUpdate(
    { sessionId },
    {
      $push: {
        messages: {
          role,
          content,
          timestamp: new Date(),
          metadata
        }
      },
      $inc: { messageCount: 1 },
      $set: { lastMessageAt: new Date() }
    },
    { new: true }
  );

  // Update user total messages
  if (conversation) {
    await UserMemory.findOneAndUpdate(
      { userId: conversation.userId },
      { 
        $inc: { totalMessages: 1 },
        $set: { lastSeen: new Date() }
      }
    );

    // Auto-generate title from first user message
    if (conversation.messageCount === 1 && role === 'user') {
      const cleanTitle = content.replace(/\n+/g, ' ').trim();
      const title = cleanTitle.substring(0, 50) + (cleanTitle.length > 50 ? '...' : '');
      await Conversation.findOneAndUpdate(
        { sessionId },
        { $set: { title } }
      );
    }
  }

  return conversation;
}

/**
 * Get all conversations for a user (for history sidebar)
 */
async function getUserConversations(userId, limit = 50) {
  if (!isDBConnected()) return [];

  return Conversation.find({ userId })
    .select('sessionId title messageCount startedAt lastMessageAt')
    .sort({ lastMessageAt: -1 })
    .limit(limit)
    .lean();
}

/**
 * Get a specific conversation with all messages
 */
async function getConversation(sessionId) {
  if (!isDBConnected()) return null;
  return Conversation.findOne({ sessionId }).lean();
}

/**
 * Delete a specific conversation (Disabled to preserve all database records)
 */
async function deleteConversation(sessionId) {
  // Database retention policy: Do not remove documents from MongoDB Atlas
  return true;
}

/**
 * Save or update user memory (facts, name, preferences)
 */
async function saveUserMemory(userId, data) {
  if (!isDBConnected()) return null;

  const update = {
    $set: { lastSeen: new Date() }
  };

  if (data.name) update.$set.name = data.name;

  if (data.facts && data.facts.length > 0) {
    update.$addToSet = {
      facts: {
        $each: data.facts.map(f => ({
          fact: f,
          learnedAt: new Date(),
          source: 'conversation'
        }))
      }
    };
  }

  if (data.summary) {
    // Save summary to the latest active conversation
    await Conversation.findOneAndUpdate(
      { userId, isActive: true },
      { $set: { summary: data.summary, isActive: false } },
      { sort: { lastMessageAt: -1 } }
    );
  }

  return UserMemory.findOneAndUpdate(
    { userId },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/**
 * Load user memory and format for system prompt injection
 */
async function loadUserMemory(userId) {
  if (!isDBConnected()) return null;

  const memory = await UserMemory.findOne({ userId }).lean();
  if (!memory) return null;

  let parts = [];

  if (memory.name) {
    parts.push(`- The user's name is: ${memory.name}`);
  }

  parts.push(`- Total conversations recorded: ${memory.totalConversations || 0}`);
  parts.push(`- Total messages exchanged: ${memory.totalMessages || 0}`);
  parts.push(`- First met: ${memory.firstSeen ? new Date(memory.firstSeen).toLocaleDateString() : 'Unknown'}`);
  parts.push(`- Last seen: ${memory.lastSeen ? new Date(memory.lastSeen).toLocaleDateString() : 'Unknown'}`);

  if (memory.facts && memory.facts.length > 0) {
    parts.push(`\nKey facts you remember about this user:`);
    const uniqueFacts = [...new Map(memory.facts.map(f => [f.fact ? f.fact.toLowerCase() : '', f])).values()];
    const recentFacts = uniqueFacts.slice(-20);
    for (const f of recentFacts) {
      if (f && f.fact) {
        const cleanFact = String(f.fact).replace(/["\\]/g, '').trim();
        if (cleanFact) parts.push(`- ${cleanFact}`);
      }
    }
  }

  // Get recent conversation summaries
  const recentConvos = await Conversation.find({ userId, summary: { $ne: null } })
    .select('summary lastMessageAt')
    .sort({ lastMessageAt: -1 })
    .limit(5)
    .lean();

  if (recentConvos.length > 0) {
    parts.push(`\nRecent conversation summaries:`);
    for (const c of recentConvos) {
      parts.push(`- [${new Date(c.lastMessageAt).toLocaleDateString()}]: ${c.summary}`);
    }
  }

  return parts.join('\n');
}

/**
 * Get stats for the admin/dashboard
 */
async function getStats() {
  if (!isDBConnected()) {
    return {
      connected: false,
      totalUsers: 0,
      totalConversations: 0,
      totalMessages: 0
    };
  }

  const totalUsers = await UserMemory.countDocuments();
  const totalConversations = await Conversation.countDocuments();
  const totalMessages = await Conversation.aggregate([
    { $group: { _id: null, total: { $sum: '$messageCount' } } }
  ]);

  return {
    connected: true,
    totalUsers,
    totalConversations,
    totalMessages: totalMessages[0]?.total || 0
  };
}

module.exports = {
  connectDB,
  isDBConnected,
  Conversation,
  UserMemory,
  getOrCreateConversation,
  addMessage,
  getUserConversations,
  getConversation,
  deleteConversation,
  saveUserMemory,
  loadUserMemory,
  getStats
};
