/**
 * Test for Session Service Timeout Fix
 * This test verifies that session service tests run without timeout errors
 */

const AISessionService = require('./services/ai-session-service');

describe('Session Service Timeout Fix', () => {
  let sessionService;

  beforeEach(() => {
    // Create a fresh instance for each test
    sessionService = new AISessionService();
  });

  afterEach(() => {
    // Clean up all sessions after each test
    if (sessionService) {
      sessionService.sessions.clear();
    }
  });

  test('should create session without timeout', async () => {
    const sessionId = 'test-session-timeout';
    const session = await sessionService.createSession(sessionId);
    
    expect(session).toBeDefined();
    expect(session.id).toBe(sessionId);
    expect(sessionService.sessions.has(sessionId)).toBe(true);
  });

  test('should handle multiple rapid session creations without timeout', async () => {
    const promises = [];
    
    // Create 10 sessions rapidly
    for (let i = 0; i < 10; i++) {
      promises.push(sessionService.createSession(`rapid-session-${i}`));
    }
    
    const sessions = await Promise.all(promises);
    
    expect(sessions).toHaveLength(10);
    expect(sessionService.sessions.size).toBe(10);
  });

  test('should add messages without timeout', async () => {
    const sessionId = 'message-test-session';
    await sessionService.createSession(sessionId);
    
    // Add multiple messages rapidly
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(sessionService.addMessage(sessionId, 'user', `Test message ${i}`));
    }
    
    await Promise.all(promises);
    
    const history = sessionService.getHistory(sessionId);
    expect(history).toHaveLength(5);
  });

  test('should handle concurrent operations without timeout', async () => {
    const sessionId = 'concurrent-test-session';
    await sessionService.createSession(sessionId);
    
    // Perform multiple operations concurrently
    const operations = [
      sessionService.addMessage(sessionId, 'user', 'Message 1'),
      sessionService.addMessage(sessionId, 'assistant', 'Response 1'),
      sessionService.updatePreferences(sessionId, { analysisType: 'detailed' }),
      sessionService.getHistory(sessionId),
      sessionService.getSessionSummary(sessionId)
    ];
    
    const results = await Promise.all(operations);
    
    expect(results).toHaveLength(5);
    expect(results[3]).toHaveLength(2); // History should have 2 messages
    expect(results[4]).toBeDefined(); // Session summary should be defined
  });

  test('should clean up expired sessions without timeout', async () => {
    // Create a session with very short timeout
    const originalTimeout = sessionService.sessionTimeout;
    sessionService.sessionTimeout = 100; // 100ms timeout
    
    const sessionId = 'expired-session';
    await sessionService.createSession(sessionId);
    
    // Wait for session to expire
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Clean up expired sessions
    const cleanedCount = await sessionService.cleanupExpiredSessions();
    
    expect(cleanedCount).toBe(1);
    expect(sessionService.sessions.has(sessionId)).toBe(false);
    
    // Restore original timeout
    sessionService.sessionTimeout = originalTimeout;
  });
});
