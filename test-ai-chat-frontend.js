/**
 * Test for AI Chat Frontend Implementation
 * This test verifies that the AI chat interface is properly implemented
 */

const fs = require('fs');
const path = require('path');

describe('AI Chat Frontend Implementation', () => {
  const aiChatHtmlPath = path.join(__dirname, 'public', 'ai-chat.html');
  const aiChatJsPath = path.join(__dirname, 'public', 'js', 'ai-chat.js');
  const aiChatCssPath = path.join(__dirname, 'public', 'css', 'ai-chat.css');

  test('should have AI chat HTML page', () => {
    expect(fs.existsSync(aiChatHtmlPath)).toBe(true);
  });

  test('should have AI chat JavaScript file', () => {
    expect(fs.existsSync(aiChatJsPath)).toBe(true);
  });

  test('should have AI chat CSS file', () => {
    expect(fs.existsSync(aiChatCssPath)).toBe(true);
  });

  test('AI chat HTML should contain required elements', () => {
    if (fs.existsSync(aiChatHtmlPath)) {
      const content = fs.readFileSync(aiChatHtmlPath, 'utf8');
      
      // Check for required HTML elements
      expect(content).toContain('AI Assistant');
      expect(content).toContain('chat-messages');
      expect(content).toContain('messageInput');
      expect(content).toContain('sendButton');
      expect(content).toContain('contextType');
      expect(content).toContain('ai-chat.js');
    }
  });

  test('AI chat HTML should have proper navigation integration', () => {
    if (fs.existsSync(aiChatHtmlPath)) {
      const content = fs.readFileSync(aiChatHtmlPath, 'utf8');
      
      // Check for navigation elements
      expect(content).toContain('nav-links');
      expect(content).toContain('AI Assistant');
    }
  });

  test('AI chat JavaScript should have required functionality', () => {
    if (fs.existsSync(aiChatJsPath)) {
      const content = fs.readFileSync(aiChatJsPath, 'utf8');
      
      // Check for required JavaScript functions
      expect(content).toContain('sendMessage');
      expect(content).toContain('displayMessage');
      expect(content).toContain('fetchAIResponse');
      expect(content).toContain('/api/v2/ai/chat');
    }
  });

  test('AI chat CSS should have required styling', () => {
    if (fs.existsSync(aiChatCssPath)) {
      const content = fs.readFileSync(aiChatCssPath, 'utf8');
      
      // Check for required CSS classes
      expect(content).toContain('.ai-chat-container');
      expect(content).toContain('.chat-messages');
      expect(content).toContain('.chat-input');
      expect(content).toContain('.message');
    }
  });
});
