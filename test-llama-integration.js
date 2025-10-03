/**
 * Test for LlamaHubService Integration
 * This test verifies that LlamaHubService is properly integrated and working
 */

const LlamaHubService = require('./services/llama-hub-service');

// Mock fetch for testing
global.fetch = jest.fn();

describe('LlamaHubService Integration', () => {
  let llamaService;
  let originalApiKey;

  beforeEach(() => {
    // Store original API key
    originalApiKey = process.env.LLAMA_API_KEY;
    
    // Set a test API key for testing
    process.env.LLAMA_API_KEY = 'test-api-key';
    
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    llamaService = new LlamaHubService();
  });

  afterEach(() => {
    // Restore original API key
    process.env.LLAMA_API_KEY = originalApiKey;
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
    expect(typeof llamaService.getModels).toBe('function');
  });

  test('getHealth should return service status', async () => {
    // Mock successful health check response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'healthy', uptime: 12345 })
    });

    const healthStatus = await llamaService.getHealth();
    
    expect(healthStatus).toBeDefined();
    expect(healthStatus).toHaveProperty('status');
    expect(healthStatus.status).toBe('healthy');
  });

  test('generateText should handle basic text generation', async () => {
    // Mock successful text generation response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'This is a test response' } }]
      })
    });

    const prompt = 'Generate a simple test response';
    const response = await llamaService.generateText(prompt);
    
    expect(response).toBeDefined();
    expect(response).toHaveProperty('text');
    expect(typeof response.text).toBe('string');
    expect(response.text).toBe('This is a test response');
  });

  test('chatCompletion should handle conversation context', async () => {
    // Mock successful chat completion response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'Hello! I am doing well, thank you for asking.' } }]
      })
    });

    const messages = [
      { role: 'user', content: 'Hello, how are you?' }
    ];
    
    const response = await llamaService.chatCompletion({ messages });
    
    expect(response).toBeDefined();
    expect(response).toHaveProperty('message');
    expect(response.message).toHaveProperty('content');
    expect(typeof response.message.content).toBe('string');
    expect(response.message.content).toBe('Hello! I am doing well, thank you for asking.');
  });

  test('analyzeProject should handle project analysis', async () => {
    // Mock successful project analysis response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'Project analysis: The project is progressing well with 75% completion. Focus on completing Story 2 to maintain momentum.' } }]
      })
    });

    const projectData = {
      name: 'test-project',
      status: 'active',
      progress: 75,
      stories: [
        { title: 'Story 1', status: 'completed' },
        { title: 'Story 2', status: 'in-progress' }
      ]
    };
    
    const analysis = await llamaService.analyzeProject(projectData);
    
    expect(analysis).toBeDefined();
    expect(analysis).toHaveProperty('insights');
    expect(analysis).toHaveProperty('recommendations');
    expect(Array.isArray(analysis.recommendations)).toBe(true);
  });

  test('suggestCommitMessage should generate commit suggestions', async () => {
    // Mock successful commit message suggestion response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'feat: add utility functions and update app logic\n\n- Add new utility functions in utils.js\n- Update application logic in app.js\n- Improve code organization' } }]
      })
    });

    const changes = [
      { file: 'src/app.js', type: 'modified', lines: 15 },
      { file: 'src/utils.js', type: 'added', lines: 8 }
    ];
    
    const suggestions = await llamaService.suggestCommitMessage(changes);
    
    expect(suggestions).toBeDefined();
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(typeof suggestions[0]).toBe('string');
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

  test('should have proper error handling for invalid inputs', async () => {
    // Test with invalid prompt
    await expect(llamaService.generateText(null)).rejects.toThrow();
    
    // Test with invalid messages
    await expect(llamaService.chatCompletion(null)).rejects.toThrow();
    
    // Test with invalid project data
    await expect(llamaService.analyzeProject(null)).rejects.toThrow();
  });

  test('should have proper configuration', () => {
    expect(llamaService.baseUrl).toBeDefined();
    expect(llamaService.apiKey).toBeDefined();
    expect(llamaService.defaultModel).toBeDefined();
  });
});