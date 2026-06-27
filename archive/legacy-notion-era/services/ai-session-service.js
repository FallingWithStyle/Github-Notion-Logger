/**
 * AI Session Service for Epic 10
 * Conversation session and state management
 */

const { v4: uuidv4 } = require('uuid');

class AISessionService {
  constructor() {
    this.sessions = new Map();
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
    this.maxHistoryLength = 50; // messages per session
    this.maxSessions = 1000; // maximum concurrent sessions
    this.cleanupInterval = 5 * 60 * 1000; // 5 minutes
    
    // Start cleanup interval only if not in test environment
    if (process.env.NODE_ENV !== 'test') {
      this.startCleanupInterval();
    }
  }

  /**
   * Create or retrieve conversation session
   * @param {string} sessionId - Session identifier (optional, will generate if not provided)
   * @param {string} userId - User identifier (optional)
   * @returns {Object} Session object
   */
  createSession(sessionId = null, userId = null) {
    try {
      // Generate session ID if not provided
      if (!sessionId) {
        sessionId = this.generateSessionId();
      }

      // Check if session already exists
      if (this.sessions.has(sessionId)) {
        const existingSession = this.sessions.get(sessionId);
        existingSession.lastAccessed = new Date();
        console.log(`🔄 Retrieved existing session: ${sessionId}`);
        return existingSession;
      }

      // Check session limit
      if (this.sessions.size >= this.maxSessions) {
        this.cleanupExpiredSessions();
        if (this.sessions.size >= this.maxSessions) {
          throw new Error('Maximum session limit reached');
        }
      }

      // Create new session
      const session = new Session(sessionId, userId);
      this.sessions.set(sessionId, session);
      
      console.log(`✨ Created new session: ${sessionId}`);
      return session;

    } catch (error) {
      console.error('❌ Error creating session:', error);
      throw error;
    }
  }

  /**
   * Add message to session history
   * @param {string} sessionId - Session identifier
   * @param {string} role - Message role (user, assistant, system)
   * @param {string} content - Message content
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Updated session
   */
  addMessage(sessionId, role, content, metadata = {}) {
    try {
      const session = this.getSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      // Validate message
      this.validateMessage(role, content);

      // Add message to session
      session.addMessage(role, content, metadata);
      
      // Maintain history limit
      if (session.messages.length > this.maxHistoryLength) {
        session.messages = session.messages.slice(-this.maxHistoryLength);
      }
      
      console.log(`💬 Added ${role} message to session ${sessionId}`);
      return session;

    } catch (error) {
      console.error(`❌ Error adding message to session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get conversation history
   * @param {string} sessionId - Session identifier
   * @param {number} limit - Maximum number of messages to return
   * @returns {Array} Message history
   */
  getHistory(sessionId, limit = null) {
    try {
      const session = this.getSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      let messages = session.messages;
      if (limit !== null && limit >= 0) {
        if (limit === 0) {
          messages = [];
        } else {
          messages = messages.slice(-limit);
        }
      }

      return messages;

    } catch (error) {
      console.error(`❌ Error getting history for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session identifier
   * @returns {Object|null} Session object or null
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessed = new Date();
      return session;
    }
    return null;
  }

  /**
   * Update session preferences
   * @param {string} sessionId - Session identifier
   * @param {Object} preferences - New preferences
   * @returns {Object} Updated session
   */
  updatePreferences(sessionId, preferences) {
    try {
      const session = this.getSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      session.preferences = { ...session.preferences, ...preferences };
      session.lastAccessed = new Date();
      
      console.log(`⚙️ Updated preferences for session ${sessionId}`);
      return session;

    } catch (error) {
      console.error(`❌ Error updating preferences for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get session statistics
   * @param {string} sessionId - Session identifier
   * @returns {Object} Session statistics
   */
  getSessionStats(sessionId) {
    try {
      const session = this.getSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const now = new Date();
      const sessionAge = now - session.createdAt;
      const timeSinceLastAccess = now - session.lastAccessed;

      return {
        sessionId: session.id,
        userId: session.userId,
        messageCount: session.messages.length,
        sessionAge: Math.floor(sessionAge / 1000 / 60), // minutes
        timeSinceLastAccess: Math.floor(timeSinceLastAccess / 1000 / 60), // minutes
        preferences: session.preferences,
        createdAt: session.createdAt,
        lastAccessed: session.lastAccessed
      };

    } catch (error) {
      console.error(`❌ Error getting stats for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Clear session history
   * @param {string} sessionId - Session identifier
   * @returns {Object} Updated session
   */
  clearHistory(sessionId) {
    try {
      const session = this.getSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      session.messages = [];
      session.lastAccessed = new Date();
      
      console.log(`🗑️ Cleared history for session ${sessionId}`);
      return session;

    } catch (error) {
      console.error(`❌ Error clearing history for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Delete session
   * @param {string} sessionId - Session identifier
   * @returns {boolean} Success status
   */
  deleteSession(sessionId) {
    try {
      const deleted = this.sessions.delete(sessionId);
      if (deleted) {
        console.log(`🗑️ Deleted session ${sessionId}`);
      }
      return deleted;

    } catch (error) {
      console.error(`❌ Error deleting session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get all active sessions
   * @param {string} userId - Filter by user ID (optional)
   * @returns {Array} Array of session objects
   */
  getActiveSessions(userId = null) {
    const sessions = Array.from(this.sessions.values());
    
    if (userId) {
      return sessions.filter(session => session.userId === userId);
    }
    
    return sessions;
  }

  /**
   * Get session summary for AI context
   * @param {string} sessionId - Session identifier
   * @param {number} maxMessages - Maximum messages to include
   * @returns {Object} Session summary
   */
  getSessionSummary(sessionId, maxMessages = 10) {
    try {
      const session = this.getSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const recentMessages = this.getHistory(sessionId, maxMessages);
      const messageCount = session.messages.length;
      const sessionAge = Math.floor((new Date() - session.createdAt) / 1000 / 60);

      return {
        sessionId: session.id,
        userId: session.userId,
        messageCount,
        sessionAge,
        recentMessages,
        preferences: session.preferences,
        context: {
          hasLongHistory: messageCount > maxMessages,
          isNewSession: messageCount <= 2,
          sessionDuration: sessionAge
        }
      };

    } catch (error) {
      console.error(`❌ Error getting session summary for ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Generate unique session ID
   * @returns {string} Unique session identifier
   */
  generateSessionId() {
    return `ai-session-${uuidv4()}`;
  }

  /**
   * Validate message before adding to session
   * @param {string} role - Message role
   * @param {string} content - Message content
   */
  validateMessage(role, content) {
    if (!role || typeof role !== 'string') {
      throw new Error('Message role must be a non-empty string');
    }

    if (!content || typeof content !== 'string') {
      throw new Error('Message content must be a non-empty string');
    }

    if (content.length > 10000) {
      throw new Error('Message content too long (max 10,000 characters)');
    }

    const validRoles = ['user', 'assistant', 'system'];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid message role. Must be one of: ${validRoles.join(', ')}`);
    }
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastAccessed > this.sessionTimeout) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`);
    }

    return cleanedCount;
  }

  /**
   * Start cleanup interval
   */
  startCleanupInterval() {
    this.cleanupTimer = setInterval(() => {
      try {
        this.cleanupExpiredSessions();
      } catch (error) {
        console.error('❌ Error during session cleanup:', error);
      }
    }, this.cleanupInterval);
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Get service statistics
   * @returns {Object} Service statistics
   */
  getServiceStats() {
    const now = new Date();
    const activeSessions = Array.from(this.sessions.values());
    
    const stats = {
      totalSessions: this.sessions.size,
      maxSessions: this.maxSessions,
      sessionTimeout: this.sessionTimeout,
      maxHistoryLength: this.maxHistoryLength,
      averageSessionAge: 0,
      averageMessageCount: 0,
      oldestSession: null,
      newestSession: null
    };

    if (activeSessions.length > 0) {
      const totalAge = activeSessions.reduce((sum, session) => {
        return sum + (now - session.createdAt);
      }, 0);
      
      const totalMessages = activeSessions.reduce((sum, session) => {
        return sum + session.messages.length;
      }, 0);

      stats.averageSessionAge = Math.floor(totalAge / activeSessions.length / 1000 / 60); // minutes
      stats.averageMessageCount = Math.floor(totalMessages / activeSessions.length);

      // Find oldest and newest sessions
      const sortedByAge = activeSessions.sort((a, b) => a.createdAt - b.createdAt);
      stats.oldestSession = sortedByAge[0].createdAt;
      stats.newestSession = sortedByAge[sortedByAge.length - 1].createdAt;
    }

    return stats;
  }

  /**
   * Export session data (for backup/debugging)
   * @param {string} sessionId - Session identifier
   * @returns {Object} Session data
   */
  exportSession(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return {
      id: session.id,
      userId: session.userId,
      createdAt: session.createdAt,
      lastAccessed: session.lastAccessed,
      messages: session.messages,
      preferences: session.preferences
    };
  }

  /**
   * Import session data (for restore/debugging)
   * @param {Object} sessionData - Session data
   * @returns {Object} Restored session
   */
  importSession(sessionData) {
    try {
      const session = new Session(sessionData.id, sessionData.userId);
      session.createdAt = new Date(sessionData.createdAt);
      session.lastAccessed = new Date(sessionData.lastAccessed);
      session.messages = sessionData.messages || [];
      session.preferences = sessionData.preferences || {};

      this.sessions.set(session.id, session);
      console.log(`📥 Imported session ${session.id}`);
      return session;

    } catch (error) {
      console.error('❌ Error importing session:', error);
      throw error;
    }
  }
}

/**
 * Session class representing a conversation session
 */
class Session {
  constructor(sessionId, userId) {
    this.id = sessionId;
    this.userId = userId;
    this.createdAt = new Date();
    this.lastAccessed = new Date();
    this.messages = [];
    this.preferences = {
      analysisType: 'general',
      responseStyle: 'detailed',
      includeHistory: true,
      maxTokens: 1000,
      temperature: 0.7
    };
  }

  /**
   * Add message to session
   * @param {string} role - Message role
   * @param {string} content - Message content
   * @param {Object} metadata - Additional metadata
   */
  addMessage(role, content, metadata = {}) {
    const message = {
      role,
      content,
      timestamp: new Date(),
      metadata
    };

    this.messages.push(message);
    this.lastAccessed = new Date();

    // Maintain history limit - this will be handled by the service
    // The service will call this method and manage the limit
  }

  /**
   * Get recent messages
   * @param {number} count - Number of recent messages
   * @returns {Array} Recent messages
   */
  getRecentMessages(count = 10) {
    return this.messages.slice(-count);
  }

  /**
   * Check if session is expired
   * @param {number} timeout - Timeout in milliseconds
   * @returns {boolean} True if expired
   */
  isExpired(timeout = 30 * 60 * 1000) {
    return (new Date() - this.lastAccessed) > timeout;
  }

  /**
   * Get session age in minutes
   * @returns {number} Session age in minutes
   */
  getAge() {
    return Math.floor((new Date() - this.createdAt) / 1000 / 60);
  }

  /**
   * Get time since last access in minutes
   * @returns {number} Time since last access in minutes
   */
  getTimeSinceLastAccess() {
    return Math.floor((new Date() - this.lastAccessed) / 1000 / 60);
  }
}

module.exports = AISessionService;
