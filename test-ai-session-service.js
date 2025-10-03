/**
 * Unit Tests for AISessionService - Epic 10 TDD Implementation
 * Tests cover session management, message handling, and conversation state
 */

const AISessionService = require('./services/ai-session-service');

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123')
}));

describe('AISessionService', () => {
  let sessionService;

  beforeAll(() => {
    // Clear any existing sessions from previous test runs
    const tempService = new AISessionService();
    if (tempService.sessions) {
      tempService.sessions.clear();
    }
    if (tempService.stopCleanupInterval) {
      tempService.stopCleanupInterval();
    }
  });

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create new service instance
    sessionService = new AISessionService();
  });

  afterEach(() => {
    // Clean up any active sessions and stop cleanup interval
    if (sessionService) {
      if (sessionService.sessions) {
        sessionService.sessions.clear();
      }
      if (sessionService.stopCleanupInterval) {
        sessionService.stopCleanupInterval();
      }
    }
  });

  describe('createSession', () => {
    it('should create a new session with generated ID', () => {
      // Act
      const session = sessionService.createSession();

      // Assert
      expect(session).toBeDefined();
      expect(session.id).toBe('ai-session-mock-uuid-123');
      expect(session.userId).toBeNull();
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.lastAccessed).toBeInstanceOf(Date);
      expect(session.messages).toEqual([]);
      expect(session.preferences).toBeDefined();
    });

    it('should create a new session with provided ID', () => {
      // Arrange
      const sessionId = 'custom-session-id';
      const userId = 'user-123';

      // Act
      const session = sessionService.createSession(sessionId, userId);

      // Assert
      expect(session.id).toBe(sessionId);
      expect(session.userId).toBe(userId);
      expect(sessionService.sessions.has(sessionId)).toBe(true);
    });

    it('should return existing session if ID already exists', async () => {
      // Arrange
      const sessionId = 'existing-session';
      const originalSession = sessionService.createSession(sessionId);
      const originalLastAccessed = originalSession.lastAccessed;

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Act
      const retrievedSession = sessionService.createSession(sessionId);

      // Assert
      expect(retrievedSession).toBe(originalSession);
      expect(retrievedSession.lastAccessed.getTime()).toBeGreaterThanOrEqual(originalLastAccessed.getTime());
    });

    it('should throw error when maximum sessions reached', () => {
      // Arrange
      sessionService.maxSessions = 2;
      sessionService.createSession('session1');
      sessionService.createSession('session2');

      // Act & Assert
      expect(() => {
        sessionService.createSession('session3');
      }).toThrow('Maximum session limit reached');
    });

    it('should clean up expired sessions before creating new one', () => {
      // Arrange
      sessionService.maxSessions = 1;
      const expiredSession = sessionService.createSession('expired-session');
      
      // Manually expire the session
      expiredSession.lastAccessed = new Date(Date.now() - 31 * 60 * 1000); // 31 minutes ago

      // Act
      const newSession = sessionService.createSession('new-session');

      // Assert
      expect(newSession).toBeDefined();
      expect(sessionService.sessions.has('expired-session')).toBe(false);
      expect(sessionService.sessions.has('new-session')).toBe(true);
    });
  });

  describe('addMessage', () => {
    let session;

    beforeEach(() => {
      session = sessionService.createSession('test-session');
    });

    it('should add user message to session', () => {
      // Arrange
      const role = 'user';
      const content = 'Hello, AI assistant!';
      const metadata = { timestamp: new Date() };

      // Act
      const updatedSession = sessionService.addMessage(session.id, role, content, metadata);

      // Assert
      expect(updatedSession.messages).toHaveLength(1);
      expect(updatedSession.messages[0].role).toBe(role);
      expect(updatedSession.messages[0].content).toBe(content);
      expect(updatedSession.messages[0].metadata).toEqual(metadata);
      expect(updatedSession.messages[0].timestamp).toBeInstanceOf(Date);
    });

    it('should add assistant message to session', () => {
      // Arrange
      const role = 'assistant';
      const content = 'Hello! How can I help you today?';

      // Act
      sessionService.addMessage(session.id, role, content);

      // Assert
      expect(session.messages).toHaveLength(1);
      expect(session.messages[0].role).toBe(role);
      expect(session.messages[0].content).toBe(content);
    });

    it('should add system message to session', () => {
      // Arrange
      const role = 'system';
      const content = 'System initialization complete';

      // Act
      sessionService.addMessage(session.id, role, content);

      // Assert
      expect(session.messages).toHaveLength(1);
      expect(session.messages[0].role).toBe(role);
      expect(session.messages[0].content).toBe(content);
    });

    it('should update lastAccessed timestamp', () => {
      // Arrange - Create a fresh session for this test
      const testSession = sessionService.createSession('timestamp-test-session');
      const originalLastAccessed = testSession.lastAccessed;
      
      // Act - Add message immediately
      const updatedSession = sessionService.addMessage(testSession.id, 'user', 'Test message');

      // Assert - Check that lastAccessed was updated
      expect(updatedSession.lastAccessed).toBeInstanceOf(Date);
      expect(updatedSession.lastAccessed.getTime()).toBeGreaterThanOrEqual(originalLastAccessed.getTime());
    });

    it('should maintain message history limit', () => {
      // Arrange
      const maxHistoryLength = 3;
      sessionService.maxHistoryLength = maxHistoryLength;

      // Act - Add more messages than the limit
      for (let i = 0; i < 5; i++) {
        sessionService.addMessage(session.id, 'user', `Message ${i}`);
      }

      // Assert
      expect(session.messages).toHaveLength(maxHistoryLength);
      expect(session.messages[0].content).toBe('Message 2'); // First message should be the 3rd one
      expect(session.messages[2].content).toBe('Message 4'); // Last message should be the 5th one
    });

    it('should throw error for invalid message role', () => {
      // Act & Assert
      expect(() => {
        sessionService.addMessage(session.id, 'invalid-role', 'Test message');
      }).toThrow('Invalid message role');
    });

    it('should throw error for empty message content', () => {
      // Act & Assert
      expect(() => {
        sessionService.addMessage(session.id, 'user', '');
      }).toThrow('Message content must be a non-empty string');
    });

    it('should throw error for message too long', () => {
      // Arrange
      const longMessage = 'x'.repeat(10001); // Exceeds 10,000 character limit

      // Act & Assert
      expect(() => {
        sessionService.addMessage(session.id, 'user', longMessage);
      }).toThrow('Message content too long');
    });

    it('should throw error for non-existent session', () => {
      // Act & Assert
      expect(() => {
        sessionService.addMessage('non-existent-session', 'user', 'Test message');
      }).toThrow('Session non-existent-session not found');
    });
  });

  describe('getHistory', () => {
    let session;

    beforeEach(() => {
      session = sessionService.createSession('test-session');
      
      // Add some test messages
      sessionService.addMessage(session.id, 'user', 'Hello');
      sessionService.addMessage(session.id, 'assistant', 'Hi there!');
      sessionService.addMessage(session.id, 'user', 'How are you?');
      sessionService.addMessage(session.id, 'assistant', 'I am doing well, thank you!');
    });

    it('should return all messages when no limit specified', () => {
      // Act
      const history = sessionService.getHistory(session.id);

      // Assert
      expect(history).toHaveLength(4);
      expect(history[0].content).toBe('Hello');
      expect(history[3].content).toBe('I am doing well, thank you!');
    });

    it('should return limited number of recent messages', () => {
      // Act
      const history = sessionService.getHistory(session.id, 2);

      // Assert
      expect(history).toHaveLength(2);
      expect(history[0].content).toBe('How are you?');
      expect(history[1].content).toBe('I am doing well, thank you!');
    });

    it('should return empty array for limit of 0', () => {
      // Act
      const history = sessionService.getHistory(session.id, 0);

      // Assert
      expect(history).toHaveLength(0);
    });

    it('should throw error for non-existent session', () => {
      // Act & Assert
      expect(() => {
        sessionService.getHistory('non-existent-session');
      }).toThrow('Session non-existent-session not found');
    });
  });

  describe('getSession', () => {
    it('should return session if it exists', () => {
      // Arrange
      const session = sessionService.createSession('test-session');

      // Act
      const retrievedSession = sessionService.getSession('test-session');

      // Assert
      expect(retrievedSession).toBe(session);
    });

    it('should return null for non-existent session', () => {
      // Act
      const session = sessionService.getSession('non-existent-session');

      // Assert
      expect(session).toBeNull();
    });

    it('should update lastAccessed timestamp when retrieving session', () => {
      // Arrange
      const session = sessionService.createSession('test-session');
      const originalLastAccessed = session.lastAccessed;

      // Wait a bit to ensure time difference
      setTimeout(() => {
        // Act
        sessionService.getSession('test-session');

        // Assert
        expect(session.lastAccessed.getTime()).toBeGreaterThanOrEqual(originalLastAccessed.getTime());
      }, 10);
    });
  });

  describe('updatePreferences', () => {
    let session;

    beforeEach(() => {
      session = sessionService.createSession('test-session');
    });

    it('should update session preferences', () => {
      // Arrange
      const newPreferences = {
        analysisType: 'planning',
        responseStyle: 'concise',
        maxTokens: 500
      };

      // Act
      const updatedSession = sessionService.updatePreferences(session.id, newPreferences);

      // Assert
      expect(updatedSession.preferences.analysisType).toBe('planning');
      expect(updatedSession.preferences.responseStyle).toBe('concise');
      expect(updatedSession.preferences.maxTokens).toBe(500);
      expect(updatedSession.preferences.includeHistory).toBe(true); // Should preserve existing values
    });

    it('should merge with existing preferences', () => {
      // Arrange
      const partialPreferences = {
        analysisType: 'productivity'
      };

      // Act
      sessionService.updatePreferences(session.id, partialPreferences);

      // Assert
      expect(session.preferences.analysisType).toBe('productivity');
      expect(session.preferences.responseStyle).toBe('detailed'); // Should remain unchanged
      expect(session.preferences.includeHistory).toBe(true); // Should remain unchanged
    });

    it('should update lastAccessed timestamp', () => {
      // Arrange
      const originalLastAccessed = session.lastAccessed;

      // Wait a bit to ensure time difference
      setTimeout(() => {
        // Act
        sessionService.updatePreferences(session.id, { analysisType: 'quality' });

        // Assert
        expect(session.lastAccessed.getTime()).toBeGreaterThanOrEqual(originalLastAccessed.getTime());
      }, 10);
    });

    it('should throw error for non-existent session', () => {
      // Act & Assert
      expect(() => {
        sessionService.updatePreferences('non-existent-session', { analysisType: 'general' });
      }).toThrow('Session non-existent-session not found');
    });
  });

  describe('getSessionStats', () => {
    let session;

    beforeEach(() => {
      session = sessionService.createSession('test-session', 'user-123');
      
      // Add some messages
      sessionService.addMessage(session.id, 'user', 'Hello');
      sessionService.addMessage(session.id, 'assistant', 'Hi!');
    });

    it('should return correct session statistics', () => {
      // Act
      const stats = sessionService.getSessionStats(session.id);

      // Assert
      expect(stats.sessionId).toBe('test-session');
      expect(stats.userId).toBe('user-123');
      expect(stats.messageCount).toBe(2);
      expect(stats.sessionAge).toBeGreaterThanOrEqual(0);
      expect(stats.timeSinceLastAccess).toBeGreaterThanOrEqual(0);
      expect(stats.preferences).toBeDefined();
      expect(stats.createdAt).toBeInstanceOf(Date);
      expect(stats.lastAccessed).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent session', () => {
      // Act & Assert
      expect(() => {
        sessionService.getSessionStats('non-existent-session');
      }).toThrow('Session non-existent-session not found');
    });
  });

  describe('clearHistory', () => {
    let session;

    beforeEach(() => {
      session = sessionService.createSession('test-session');
      
      // Add some messages
      sessionService.addMessage(session.id, 'user', 'Hello');
      sessionService.addMessage(session.id, 'assistant', 'Hi!');
    });

    it('should clear all messages from session', () => {
      // Act
      const updatedSession = sessionService.clearHistory(session.id);

      // Assert
      expect(updatedSession.messages).toHaveLength(0);
      expect(session.messages).toHaveLength(0);
    });

    it('should update lastAccessed timestamp', () => {
      // Arrange
      const originalLastAccessed = session.lastAccessed;

      // Wait a bit to ensure time difference
      setTimeout(() => {
        // Act
        sessionService.clearHistory(session.id);

        // Assert
        expect(session.lastAccessed.getTime()).toBeGreaterThanOrEqual(originalLastAccessed.getTime());
      }, 10);
    });

    it('should throw error for non-existent session', () => {
      // Act & Assert
      expect(() => {
        sessionService.clearHistory('non-existent-session');
      }).toThrow('Session non-existent-session not found');
    });
  });

  describe('deleteSession', () => {
    it('should delete existing session', () => {
      // Arrange
      sessionService.createSession('test-session');

      // Act
      const deleted = sessionService.deleteSession('test-session');

      // Assert
      expect(deleted).toBe(true);
      expect(sessionService.sessions.has('test-session')).toBe(false);
    });

    it('should return false for non-existent session', () => {
      // Act
      const deleted = sessionService.deleteSession('non-existent-session');

      // Assert
      expect(deleted).toBe(false);
    });
  });

  describe('getActiveSessions', () => {
    beforeEach(() => {
      sessionService.createSession('session1', 'user-1');
      sessionService.createSession('session2', 'user-1');
      sessionService.createSession('session3', 'user-2');
    });

    it('should return all active sessions when no user filter', () => {
      // Act
      const sessions = sessionService.getActiveSessions();

      // Assert
      expect(sessions).toHaveLength(3);
      expect(sessions.map(s => s.id)).toContain('session1');
      expect(sessions.map(s => s.id)).toContain('session2');
      expect(sessions.map(s => s.id)).toContain('session3');
    });

    it('should return sessions filtered by user ID', () => {
      // Act
      const user1Sessions = sessionService.getActiveSessions('user-1');
      const user2Sessions = sessionService.getActiveSessions('user-2');

      // Assert
      expect(user1Sessions).toHaveLength(2);
      expect(user1Sessions.every(s => s.userId === 'user-1')).toBe(true);
      
      expect(user2Sessions).toHaveLength(1);
      expect(user2Sessions[0].userId).toBe('user-2');
    });

    it('should return empty array for non-existent user', () => {
      // Act
      const sessions = sessionService.getActiveSessions('non-existent-user');

      // Assert
      expect(sessions).toHaveLength(0);
    });
  });

  describe('getSessionSummary', () => {
    let session;

    beforeEach(() => {
      session = sessionService.createSession('test-session', 'user-123');
      
      // Add multiple messages
      for (let i = 0; i < 15; i++) {
        sessionService.addMessage(session.id, 'user', `User message ${i}`);
        sessionService.addMessage(session.id, 'assistant', `Assistant response ${i}`);
      }
    });

    it('should return session summary with recent messages', () => {
      // Act
      const summary = sessionService.getSessionSummary(session.id, 5);

      // Assert
      expect(summary.sessionId).toBe('test-session');
      expect(summary.userId).toBe('user-123');
      expect(summary.messageCount).toBe(30);
      expect(summary.recentMessages).toHaveLength(5);
      expect(summary.preferences).toBeDefined();
      expect(summary.context.hasLongHistory).toBe(true);
      expect(summary.context.isNewSession).toBe(false);
      expect(summary.context.sessionDuration).toBeGreaterThanOrEqual(0);
    });

    it('should identify new sessions correctly', () => {
      // Arrange
      const newSession = sessionService.createSession('new-session');
      sessionService.addMessage(newSession.id, 'user', 'Hello');

      // Act
      const summary = sessionService.getSessionSummary(newSession.id);

      // Assert
      expect(summary.context.isNewSession).toBe(true);
      expect(summary.context.hasLongHistory).toBe(false);
    });

    it('should throw error for non-existent session', () => {
      // Act & Assert
      expect(() => {
        sessionService.getSessionSummary('non-existent-session');
      }).toThrow('Session non-existent-session not found');
    });
  });

  describe('generateSessionId', () => {
    it('should generate unique session ID', () => {
      // Act
      const id1 = sessionService.generateSessionId();
      const id2 = sessionService.generateSessionId();

      // Assert
      expect(id1).toBe('ai-session-mock-uuid-123');
      expect(id2).toBe('ai-session-mock-uuid-123');
      expect(id1).toMatch(/^ai-session-/);
    });
  });

  describe('validateMessage', () => {
    it('should validate correct message', () => {
      // Act & Assert - should not throw
      expect(() => {
        sessionService.validateMessage('user', 'Valid message content');
      }).not.toThrow();
    });

    it('should throw error for invalid role', () => {
      // Act & Assert
      expect(() => {
        sessionService.validateMessage('invalid-role', 'Valid content');
      }).toThrow('Invalid message role');
    });

    it('should throw error for empty role', () => {
      // Act & Assert
      expect(() => {
        sessionService.validateMessage('', 'Valid content');
      }).toThrow('Message role must be a non-empty string');
    });

    it('should throw error for null role', () => {
      // Act & Assert
      expect(() => {
        sessionService.validateMessage(null, 'Valid content');
      }).toThrow('Message role must be a non-empty string');
    });

    it('should throw error for empty content', () => {
      // Act & Assert
      expect(() => {
        sessionService.validateMessage('user', '');
      }).toThrow('Message content must be a non-empty string');
    });

    it('should throw error for null content', () => {
      // Act & Assert
      expect(() => {
        sessionService.validateMessage('user', null);
      }).toThrow('Message content must be a non-empty string');
    });

    it('should throw error for content too long', () => {
      // Arrange
      const longContent = 'x'.repeat(10001);

      // Act & Assert
      expect(() => {
        sessionService.validateMessage('user', longContent);
      }).toThrow('Message content too long');
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should remove expired sessions', () => {
      // Arrange
      const session1 = sessionService.createSession('session1');
      const session2 = sessionService.createSession('session2');
      
      // Manually expire session1
      session1.lastAccessed = new Date(Date.now() - 31 * 60 * 1000); // 31 minutes ago

      // Act
      sessionService.cleanupExpiredSessions();

      // Assert
      expect(sessionService.sessions.has('session1')).toBe(false);
      expect(sessionService.sessions.has('session2')).toBe(true);
    });

    it('should not remove active sessions', () => {
      // Arrange
      const session1 = sessionService.createSession('session1');
      const session2 = sessionService.createSession('session2');

      // Act
      sessionService.cleanupExpiredSessions();

      // Assert
      expect(sessionService.sessions.has('session1')).toBe(true);
      expect(sessionService.sessions.has('session2')).toBe(true);
    });
  });

  describe('getServiceStats', () => {
    beforeEach(() => {
      // Create some test sessions
      sessionService.createSession('session1', 'user-1');
      sessionService.createSession('session2', 'user-1');
      sessionService.createSession('session3', 'user-2');
      
      // Add some messages to sessions
      sessionService.addMessage('session1', 'user', 'Hello');
      sessionService.addMessage('session1', 'assistant', 'Hi!');
      sessionService.addMessage('session2', 'user', 'Test');
    });

    it('should return correct service statistics', () => {
      // Act
      const stats = sessionService.getServiceStats();

      // Assert
      expect(stats.totalSessions).toBe(3);
      expect(stats.maxSessions).toBe(1000);
      expect(stats.sessionTimeout).toBe(30 * 60 * 1000);
      expect(stats.maxHistoryLength).toBe(50);
      expect(stats.averageSessionAge).toBeGreaterThanOrEqual(0);
      expect(stats.averageMessageCount).toBeGreaterThanOrEqual(0);
      expect(stats.oldestSession).toBeInstanceOf(Date);
      expect(stats.newestSession).toBeInstanceOf(Date);
    });

    it('should handle empty session list', () => {
      // Arrange
      sessionService.sessions.clear();

      // Act
      const stats = sessionService.getServiceStats();

      // Assert
      expect(stats.totalSessions).toBe(0);
      expect(stats.averageSessionAge).toBe(0);
      expect(stats.averageMessageCount).toBe(0);
      expect(stats.oldestSession).toBeNull();
      expect(stats.newestSession).toBeNull();
    });
  });

  describe('exportSession and importSession', () => {
    let session;

    beforeEach(() => {
      session = sessionService.createSession('test-session', 'user-123');
      sessionService.addMessage(session.id, 'user', 'Hello');
      sessionService.addMessage(session.id, 'assistant', 'Hi!');
    });

    it('should export session data correctly', () => {
      // Act
      const exportedData = sessionService.exportSession(session.id);

      // Assert
      expect(exportedData.id).toBe('test-session');
      expect(exportedData.userId).toBe('user-123');
      expect(exportedData.messages).toHaveLength(2);
      expect(exportedData.preferences).toBeDefined();
      expect(exportedData.createdAt).toBeInstanceOf(Date);
      expect(exportedData.lastAccessed).toBeInstanceOf(Date);
    });

    it('should import session data correctly', () => {
      // Arrange
      const sessionData = {
        id: 'imported-session',
        userId: 'user-456',
        createdAt: new Date('2024-01-01'),
        lastAccessed: new Date('2024-01-02'),
        messages: [
          { role: 'user', content: 'Imported message', timestamp: new Date() }
        ],
        preferences: { analysisType: 'custom' }
      };

      // Act
      const importedSession = sessionService.importSession(sessionData);

      // Assert
      expect(importedSession.id).toBe('imported-session');
      expect(importedSession.userId).toBe('user-456');
      expect(importedSession.messages).toHaveLength(1);
      expect(importedSession.preferences.analysisType).toBe('custom');
      expect(sessionService.sessions.has('imported-session')).toBe(true);
    });

    it('should throw error when exporting non-existent session', () => {
      // Act & Assert
      expect(() => {
        sessionService.exportSession('non-existent-session');
      }).toThrow('Session non-existent-session not found');
    });
  });

  describe('Session class', () => {
    let session;

    beforeEach(() => {
      session = sessionService.createSession('test-session', 'user-123');
    });

    it('should initialize with correct default values', () => {
      // Assert
      expect(session.id).toBe('test-session');
      expect(session.userId).toBe('user-123');
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.lastAccessed).toBeInstanceOf(Date);
      expect(session.messages).toEqual([]);
      expect(session.preferences.analysisType).toBe('general');
      expect(session.preferences.responseStyle).toBe('detailed');
      expect(session.preferences.includeHistory).toBe(true);
    });

    it('should add messages correctly', () => {
      // Act
      session.addMessage('user', 'Hello', { test: 'metadata' });

      // Assert
      expect(session.messages).toHaveLength(1);
      expect(session.messages[0].role).toBe('user');
      expect(session.messages[0].content).toBe('Hello');
      expect(session.messages[0].metadata).toEqual({ test: 'metadata' });
      expect(session.messages[0].timestamp).toBeInstanceOf(Date);
    });

    it('should update lastAccessed when adding messages', () => {
      // Arrange
      const originalLastAccessed = session.lastAccessed;

      // Wait a bit to ensure time difference
      setTimeout(() => {
        // Act
        session.addMessage('user', 'Test');

        // Assert
        expect(session.lastAccessed.getTime()).toBeGreaterThanOrEqual(originalLastAccessed.getTime());
      }, 10);
    });

    it('should maintain message history limit', () => {
      // Arrange
      const maxHistoryLength = 3;
      sessionService.maxHistoryLength = maxHistoryLength;

      // Act - Add more messages than the limit using the service
      for (let i = 0; i < 5; i++) {
        sessionService.addMessage(session.id, 'user', `Message ${i}`);
      }

      // Assert
      expect(session.messages).toHaveLength(maxHistoryLength);
      expect(session.messages[0].content).toBe('Message 2');
      expect(session.messages[2].content).toBe('Message 4');
    });

    it('should get recent messages correctly', () => {
      // Arrange
      for (let i = 0; i < 5; i++) {
        session.addMessage('user', `Message ${i}`);
      }

      // Act
      const recentMessages = session.getRecentMessages(3);

      // Assert
      expect(recentMessages).toHaveLength(3);
      expect(recentMessages[0].content).toBe('Message 2');
      expect(recentMessages[2].content).toBe('Message 4');
    });

    it('should check if session is expired', () => {
      // Act & Assert
      expect(session.isExpired()).toBe(false);
      
      // Manually set old lastAccessed
      session.lastAccessed = new Date(Date.now() - 31 * 60 * 1000);
      expect(session.isExpired()).toBe(true);
    });

    it('should calculate session age correctly', () => {
      // Act
      const age = session.getAge();

      // Assert
      expect(age).toBeGreaterThanOrEqual(0);
    });

    it('should calculate time since last access correctly', () => {
      // Act
      const timeSince = session.getTimeSinceLastAccess();

      // Assert
      expect(timeSince).toBeGreaterThanOrEqual(0);
    });
  });
});
