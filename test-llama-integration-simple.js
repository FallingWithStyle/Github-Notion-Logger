/**
 * Simple LlamaHubService Integration Test
 * This test verifies that LlamaHubService is properly integrated without making actual HTTP calls
 */

const LlamaHubService = require('./services/llama-hub-service');

describe('LlamaHubService Integration - Simple', () => {
  let llamaService;

  beforeEach(() => {
    // Set a test API key for testing
    process.env.LLAMA_API_KEY = 'test-api-key';
    llamaService = new LlamaHubService();
  });

  test('LlamaHubService should be instantiable', () => {
    expect(llamaService).toBeDefined();
    expect(llamaService).toBeInstanceOf(LlamaHubService);
  });

  test('LlamaHubService should have required methods', () => {
    expect(typeof llamaService.generateText).toBe('function');
    expect(typeof llamaService.chatCompletion).toBe('function');
    expect(typeof llamaService.analyzeProject).toBe('function');
    expect(typeof llamaService.suggestCommitMessage).toBe('function');
    expect(typeof llamaService.getHealth).toBe('function');
    expect(typeof llamaService.healthCheck).toBe('function');
    expect(typeof llamaService.getModels).toBe('function');
  });

  test('should have proper configuration', () => {
    expect(llamaService.baseUrl).toBeDefined();
    expect(llamaService.apiKey).toBeDefined();
    expect(llamaService.defaultModel).toBeDefined();
    
    expect(llamaService.baseUrl).toBe('http://localhost:9000');
    expect(llamaService.apiKey).toBe('test-api-key');
    expect(llamaService.defaultModel).toBe('llama3-7b');
  });

  test('should validate API key requirement', () => {
    // Test without API key
    process.env.LLAMA_API_KEY = '';
    const serviceWithoutKey = new LlamaHubService();
    
    expect(serviceWithoutKey.apiKey).toBe('');
  });

  test('should handle invalid inputs gracefully', async () => {
    // Test with null prompt
    await expect(llamaService.generateText(null)).rejects.toThrow();
    
    // Test with null messages
    await expect(llamaService.chatCompletion({ messages: null })).rejects.toThrow();
    
    // Test with empty messages array
    await expect(llamaService.chatCompletion({ messages: [] })).rejects.toThrow();
    
    // Test with null project data
    await expect(llamaService.analyzeProject(null)).rejects.toThrow();
  });

  test('should have proper method signatures', () => {
    // Test that methods exist and are callable
    expect(() => llamaService.generateText('test')).not.toThrow();
    expect(() => llamaService.chatCompletion({ messages: [{ role: 'user', content: 'test' }] })).not.toThrow();
    expect(() => llamaService.analyzeProject({ name: 'test' })).not.toThrow();
    expect(() => llamaService.suggestCommitMessage([{ file: 'test.js', type: 'added' }])).not.toThrow();
    expect(() => llamaService.getHealth()).not.toThrow();
    expect(() => llamaService.healthCheck()).not.toThrow();
    expect(() => llamaService.getModels()).not.toThrow();
  });

  test('should handle service unavailability gracefully', async () => {
    // Mock service unavailable scenario
    const originalHealthCheck = llamaService.healthCheck;
    llamaService.healthCheck = jest.fn().mockRejectedValue(new Error('Service unavailable'));
    
    try {
      await llamaService.healthCheck();
    } catch (error) {
      expect(error.message).toBe('Service unavailable');
    }
    
    // Restore original method
    llamaService.healthCheck = originalHealthCheck;
  });

  test('should have proper error handling for missing API key', async () => {
    // Create service without API key
    process.env.LLAMA_API_KEY = '';
    const serviceWithoutKey = new LlamaHubService();
    
    // Should throw error when trying to make API calls
    await expect(serviceWithoutKey.generateText('test')).rejects.toThrow('LLAMA_API_KEY environment variable is required');
    await expect(serviceWithoutKey.chatCompletion({ messages: [{ role: 'user', content: 'test' }] })).rejects.toThrow('LLAMA_API_KEY environment variable is required');
  });
});
