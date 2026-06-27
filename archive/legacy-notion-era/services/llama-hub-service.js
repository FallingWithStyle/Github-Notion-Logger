// Use built-in fetch for Node.js 18+ or fallback to node-fetch
let fetch;
try {
  // Try to use built-in fetch (Node.js 18+)
  fetch = globalThis.fetch;
  if (!fetch) {
    // Fallback to node-fetch for older Node.js versions
    fetch = require('node-fetch');
  }
} catch (error) {
  // If node-fetch is not available, use a mock for testing
  fetch = global.fetch || (() => {
    throw new Error('Fetch is not available. Please install node-fetch or use Node.js 18+');
  });
}

class LlamaHubService {
  constructor() {
    this.baseUrl = process.env.LLAMA_HUB_URL || 'http://localhost:9000';
    this.apiKey = process.env.LLAMA_API_KEY;
    this.defaultModel = process.env.LLAMA_DEFAULT_MODEL || 'llama3-7b';
  }

  /**
   * Send a chat completion request to the Llama-hub
   * @param {Object} options - Chat completion options
   * @param {string} options.model - Model name or number (default: llama3-7b)
   * @param {Array} options.messages - Array of message objects with role and content
   * @param {number} options.maxTokens - Maximum tokens to generate (default: 1000)
   * @param {number} options.temperature - Temperature for response generation (default: 0.7)
   * @param {boolean} options.stream - Whether to stream the response (default: false)
   * @returns {Promise<Object>} Chat completion response
   */
  async chatCompletion(options = {}) {
    const {
      model = this.defaultModel,
      messages = [],
      maxTokens = 1000,
      temperature = 0.7,
      stream = false
    } = options;

    if (!this.apiKey) {
      throw new Error('LLAMA_API_KEY environment variable is required');
    }

    if (!messages || messages.length === 0) {
      throw new Error('Messages array is required and cannot be empty');
    }

    const requestBody = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream
    };

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Llama-hub API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error calling Llama-hub API:', error);
      throw error;
    }
  }

  /**
   * Get available models from the hub
   * @returns {Promise<Array>} Array of available models
   */
  async getModels() {
    if (!this.apiKey) {
      throw new Error('LLAMA_API_KEY environment variable is required');
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Llama-hub API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching models from Llama-hub:', error);
      throw error;
    }
  }

  /**
   * Check the health status of the hub
   * @returns {Promise<Object>} Health status response
   */
  async getHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error checking Llama-hub health:', error);
      throw error;
    }
  }

  /**
   * Health check method (alias for getHealth)
   * @returns {Promise<Object>} Health status response
   */
  async healthCheck() {
    const health = await this.getHealth();
    return {
      status: health.status || 'unknown',
      timestamp: new Date().toISOString(),
      service: 'llama-hub',
      url: this.baseUrl
    };
  }

  /**
   * Generate a simple text completion using the default model
   * @param {string} prompt - The prompt to complete
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Generated text
   */
  async generateText(prompt, options = {}) {
    const messages = [
      { role: 'user', content: prompt }
    ];

    const response = await this.chatCompletion({
      ...options,
      messages
    });

    return response.choices?.[0]?.message?.content || '';
  }

  /**
   * Generate a structured response for project analysis
   * @param {string} projectData - Project data to analyze
   * @param {string} analysisType - Type of analysis to perform
   * @returns {Promise<string>} Analysis result
   */
  async analyzeProject(projectData, analysisType = 'general') {
    const prompts = {
      general: `Analyze the following project data and provide insights about development patterns, productivity trends, and recommendations for improvement:\n\n${projectData}`,
      productivity: `Analyze the productivity patterns in this project data. Focus on commit frequency, time distribution, and development velocity:\n\n${projectData}`,
      quality: `Analyze the code quality indicators in this project data. Look for patterns in commit messages, file changes, and development practices:\n\n${projectData}`,
      planning: `Analyze this project data for planning and project management insights. Identify trends, blockers, and opportunities for better project organization:\n\n${projectData}`
    };

    const prompt = prompts[analysisType] || prompts.general;
    return await this.generateText(prompt, { maxTokens: 2000, temperature: 0.3 });
  }

  /**
   * Generate commit message suggestions
   * @param {Array} changes - Array of file changes
   * @param {string} context - Additional context about the changes
   * @returns {Promise<string>} Suggested commit message
   */
  async suggestCommitMessage(changes, context = '') {
    const changesText = changes.map(change => 
      `${change.status}: ${change.filename} (${change.additions}+, ${change.deletions}-)`
    ).join('\n');

    const prompt = `Based on the following changes, suggest a clear and descriptive commit message following conventional commit format:\n\nChanges:\n${changesText}\n\nContext: ${context}\n\nProvide only the commit message, no additional text.`;

    return await this.generateText(prompt, { maxTokens: 100, temperature: 0.2 });
  }
}

module.exports = LlamaHubService;
