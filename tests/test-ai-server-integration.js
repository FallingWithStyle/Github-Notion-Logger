/**
 * Test for AI Server Integration
 * This test verifies that AI chat routes are properly integrated into the main server
 */

const fs = require('fs');
const path = require('path');

describe('AI Server Integration', () => {
  const serverPath = path.join(__dirname, 'server.js');

  test('server.js should exist', () => {
    expect(fs.existsSync(serverPath)).toBe(true);
  });

  test('server.js should import ai-chat routes', () => {
    if (fs.existsSync(serverPath)) {
      const content = fs.readFileSync(serverPath, 'utf8');
      expect(content).toContain("require('./routes/ai-chat')");
    }
  });

  test('server.js should use ai-chat routes with /api/v2/ai prefix', () => {
    if (fs.existsSync(serverPath)) {
      const content = fs.readFileSync(serverPath, 'utf8');
      expect(content).toContain("app.use('/api/v2/ai', aiChatRoutes)");
    }
  });

  test('ai-chat.js route file should exist', () => {
    const aiChatRoutePath = path.join(__dirname, 'routes', 'ai-chat.js');
    expect(fs.existsSync(aiChatRoutePath)).toBe(true);
  });

  test('ai-chat.js should export router', () => {
    const aiChatRoutePath = path.join(__dirname, 'routes', 'ai-chat.js');
    if (fs.existsSync(aiChatRoutePath)) {
      const content = fs.readFileSync(aiChatRoutePath, 'utf8');
      expect(content).toContain('module.exports = router');
    }
  });

  test('ai-chat.js should have /chat endpoint', () => {
    const aiChatRoutePath = path.join(__dirname, 'routes', 'ai-chat.js');
    if (fs.existsSync(aiChatRoutePath)) {
      const content = fs.readFileSync(aiChatRoutePath, 'utf8');
      expect(content).toContain("router.post('/chat'");
    }
  });

  test('ai-chat.js should have /recommendations endpoint', () => {
    const aiChatRoutePath = path.join(__dirname, 'routes', 'ai-chat.js');
    if (fs.existsSync(aiChatRoutePath)) {
      const content = fs.readFileSync(aiChatRoutePath, 'utf8');
      expect(content).toContain("router.get('/recommendations'");
    }
  });

  test('ai-chat.js should have /analyze endpoint', () => {
    const aiChatRoutePath = path.join(__dirname, 'routes', 'ai-chat.js');
    if (fs.existsSync(aiChatRoutePath)) {
      const content = fs.readFileSync(aiChatRoutePath, 'utf8');
      expect(content).toContain("router.post('/analyze'");
    }
  });
});
