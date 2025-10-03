/**
 * Unit Tests for AIResponseValidator - Epic 10 TDD Implementation
 * Tests cover response validation, quality scoring, and content analysis
 * Updated to use new test utilities for better stability and consistency
 */

const AIResponseValidator = require('./services/ai-response-validator');
const testUtils = require('./test-utilities');

describe('AIResponseValidator', () => {
  let validator;

  beforeEach(async () => {
    // Use test utilities for consistent setup
    testUtils.cleanup();
    validator = new AIResponseValidator();
    await testUtils.waitForPendingOperations();
  });

  afterEach(async () => {
    // Use test utilities for proper cleanup
    await testUtils.waitForPendingOperations();
    testUtils.cleanup();
  });

  describe('validateResponse', () => {
    it('should validate a well-formed response', () => {
      // Arrange
      const response = {
        content: 'I recommend focusing on quick wins to improve project velocity.',
        type: 'recommendation',
        title: 'Focus on Quick Wins',
        reasoning: 'Based on current project data'
      };
      const context = {
        type: 'project',
        project: { name: 'test-project' }
      };

      // Act
      const result = validator.validateResponse(response, context);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.qualityScore).toBeGreaterThan(0);
      expect(result.qualityLevel).toBeDefined();
      expect(result.responseType).toBe('recommendation');
    });

    it('should identify invalid responses', () => {
      // Arrange
      const response = null;
      const context = {};

      // Act
      const result = validator.validateResponse(response, context);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Validation failed: Cannot read properties of null (reading \'content\')');
      expect(result.qualityLevel).toBe('invalid');
    });

    it('should validate response structure', () => {
      // Arrange
      const response = { content: 'Valid response' };
      const context = {};

      // Act
      const result = validator.validateResponse(response, context);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should identify missing content', () => {
      // Arrange
      const response = { type: 'recommendation' };
      const context = {};

      // Act
      const result = validator.validateResponse(response, context);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Response has no content field');
    });

    it('should validate content length', () => {
      // Arrange
      const shortResponse = { content: 'Hi' };
      const longResponse = { content: 'x'.repeat(2001) };
      const context = {};

      // Act
      const shortResult = validator.validateResponse(shortResponse, context);
      const longResult = validator.validateResponse(longResponse, context);

      // Assert
      expect(shortResult.isValid).toBe(false);
      expect(shortResult.errors).toContain('Response too short (min 10 characters)');
      
      expect(longResult.isValid).toBe(true);
      expect(longResult.warnings.some(w => w.includes('Response very long'))).toBe(true);
    });

    it('should detect placeholder content', () => {
      // Arrange
      const response = { content: 'This is a [placeholder] response' };
      const context = {};

      // Act
      const result = validator.validateResponse(response, context);

      // Assert
      expect(result.warnings).toContain('Response contains placeholder text');
    });

    it('should detect repetitive content', () => {
      // Arrange
      const response = { content: 'test test test test test test test test test test test' };
      const context = {};

      // Act
      const result = validator.validateResponse(response, context);

      // Assert
      expect(result.warnings).toContain('Response contains repetitive content');
    });

    it('should validate context relevance', () => {
      // Arrange
      const response = { content: 'This is about test-project development' };
      const context = {
        type: 'project',
        project: { name: 'test-project' }
      };

      // Act
      const result = validator.validateResponse(response, context);

      // Assert
      expect(result.warnings).not.toContain('Response does not mention the specific project');
    });

    it('should warn about low relevance', () => {
      // Arrange
      const response = { content: 'This is completely unrelated content' };
      const context = {
        type: 'project',
        project: { name: 'test-project' }
      };

      // Act
      const result = validator.validateResponse(response, context);

      // Assert
      expect(result.warnings.some(w => w.includes('relevance'))).toBe(true);
    });
  });

  describe('calculateQualityScore', () => {
    it('should calculate quality score based on multiple factors', () => {
      // Arrange
      const response = {
        content: 'This is a well-structured response with specific recommendations for the test-project. It provides actionable insights based on current data.',
        type: 'recommendation',
        title: 'Project Optimization',
        reasoning: 'Based on analysis'
      };
      const context = {
        type: 'project',
        project: { name: 'test-project' },
        data: { completion: 75 }
      };

      // Act
      const result = validator.validateResponse(response, context);

      // Assert
      expect(result.qualityScore).toBeGreaterThan(0.5);
      expect(result.qualityLevel).toBe('fair');
    });

    it('should score length appropriately', () => {
      // Arrange
      const shortResponse = { content: 'Short' };
      const optimalResponse = { content: 'This is an optimal length response that provides good detail without being too verbose.' };
      const context = {};

      // Act
      const shortResult = validator.validateResponse(shortResponse, context);
      const optimalResult = validator.validateResponse(optimalResponse, context);

      // Assert
      expect(optimalResult.qualityScore).toBeGreaterThan(shortResult.qualityScore);
    });
  });

  describe('determineResponseType', () => {
    it('should identify recommendation responses', () => {
      // Arrange
      const response = { content: 'I recommend focusing on quick wins' };
      const context = {};

      // Act
      const result = validator.validateResponse(response, context);

      // Assert
      expect(result.responseType).toBe('recommendation');
    });

    it('should identify analysis responses', () => {
      // Arrange
      const response = { content: 'Based on my analysis of the project data' };
      const context = {};

      // Act
      const result = validator.validateResponse(response, context);

      // Assert
      expect(result.responseType).toBe('analysis');
    });

    it('should identify suggestion responses', () => {
      // Arrange
      const response = { content: 'You should try implementing this approach' };
      const context = {};

      // Act
      const result = validator.validateResponse(response, context);

      // Assert
      expect(result.responseType).toBe('suggestion');
    });

    it('should identify error responses', () => {
      // Arrange
      const response = { content: 'An error occurred during processing' };
      const context = {};

      // Act
      const result = validator.validateResponse(response, context);

      // Assert
      expect(result.responseType).toBe('error');
    });

    it('should default to answer for general responses', () => {
      // Arrange
      const response = { content: 'This is a general response' };
      const context = {};

      // Act
      const result = validator.validateResponse(response, context);

      // Assert
      expect(result.responseType).toBe('answer');
    });
  });

  describe('calculateRelevanceScore', () => {
    it('should score project name relevance', () => {
      // Arrange
      const content = 'This is about test-project development';
      const context = { project: { name: 'test-project' } };

      // Act
      const score = validator.calculateRelevanceScore(content, context);

      // Assert
      expect(score).toBeGreaterThan(0.2);
    });

    it('should score context type relevance', () => {
      // Arrange
      const content = 'This is a project analysis with development insights';
      const context = { type: 'project' };

      // Act
      const score = validator.calculateRelevanceScore(content, context);

      // Assert
      expect(score).toBeGreaterThan(0.2);
    });

    it('should score data relevance', () => {
      // Arrange
      const content = 'The completion rate is 75% with 15 stories completed';
      const context = { analysis: { completion: 75 } };

      // Act
      const score = validator.calculateRelevanceScore(content, context);

      // Assert
      expect(score).toBeGreaterThan(0.2);
    });

    it('should return 0 for empty context', () => {
      // Arrange
      const content = 'Some content';
      const context = {};

      // Act
      const score = validator.calculateRelevanceScore(content, context);

      // Assert
      expect(score).toBe(0);
    });
  });

  describe('containsDataInsights', () => {
    it('should detect percentage data', () => {
      // Arrange
      const content = 'The project is 75% complete';

      // Act
      const result = validator.containsDataInsights(content);

      // Assert
      expect(result).toBe(true);
    });

    it('should detect count data', () => {
      // Arrange
      const content = 'There are 15 stories completed';

      // Act
      const result = validator.containsDataInsights(content);

      // Assert
      expect(result).toBe(true);
    });

    it('should detect trend data', () => {
      // Arrange
      const content = 'The velocity has increased significantly';

      // Act
      const result = validator.containsDataInsights(content);

      // Assert
      expect(result).toBe(true);
    });

    it('should detect level data', () => {
      // Arrange
      const content = 'The project has high completion rate';

      // Act
      const result = validator.containsDataInsights(content);

      // Assert
      expect(result).toBe(true);
    });

    it('should detect time period data', () => {
      // Arrange
      const content = 'The project will be completed in 2 weeks';

      // Act
      const result = validator.containsDataInsights(content);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for content without data insights', () => {
      // Arrange
      const content = 'This is just general advice without specific data';

      // Act
      const result = validator.containsDataInsights(content);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('determineQualityLevel', () => {
    it('should categorize excellent quality', () => {
      // Act
      const level = validator.determineQualityLevel(0.85);

      // Assert
      expect(level).toBe('excellent');
    });

    it('should categorize good quality', () => {
      // Act
      const level = validator.determineQualityLevel(0.75);

      // Assert
      expect(level).toBe('good');
    });

    it('should categorize fair quality', () => {
      // Act
      const level = validator.determineQualityLevel(0.55);

      // Assert
      expect(level).toBe('fair');
    });

    it('should categorize poor quality', () => {
      // Act
      const level = validator.determineQualityLevel(0.35);

      // Assert
      expect(level).toBe('poor');
    });

    it('should categorize invalid quality', () => {
      // Act
      const level = validator.determineQualityLevel(0.15);

      // Assert
      expect(level).toBe('invalid');
    });
  });

  describe('validateAgainstCriteria', () => {
    it('should validate against custom criteria', () => {
      // Arrange
      const response = { content: 'This is a good response' };
      const criteria = {
        minQualityScore: 0.8,
        maxLength: 1000,
        requiredType: 'answer'
      };

      // Act
      const result = validator.validateAgainstCriteria(response, criteria);

      // Assert
      expect(result.isValid).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
    });

    it('should fail validation for low quality score', () => {
      // Arrange
      const response = { content: 'Bad' };
      const criteria = {
        minQualityScore: 0.8,
        context: {}
      };

      // Act
      const result = validator.validateAgainstCriteria(response, criteria);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Quality score'))).toBe(true);
    });

    it('should warn for wrong response type', () => {
      // Arrange
      const response = { content: 'I recommend this approach' };
      const criteria = {
        requiredType: 'analysis',
        context: {}
      };

      // Act
      const result = validator.validateAgainstCriteria(response, criteria);

      // Assert
      expect(result.warnings.some(w => w.includes('Expected response type'))).toBe(true);
    });

    it('should fail for excessive length', () => {
      // Arrange
      const response = { content: 'x'.repeat(1001) };
      const criteria = {
        maxLength: 1000,
        context: {}
      };

      // Act
      const result = validator.validateAgainstCriteria(response, criteria);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Response length exceeds'))).toBe(true);
    });
  });

  describe('getValidationStats', () => {
    it('should calculate validation statistics', () => {
      // Arrange
      const validations = [
        { isValid: true, qualityScore: 0.8, qualityLevel: 'excellent', responseType: 'recommendation' },
        { isValid: true, qualityScore: 0.6, qualityLevel: 'good', responseType: 'analysis' },
        { isValid: false, qualityScore: 0.3, qualityLevel: 'poor', responseType: 'error' }
      ];

      // Act
      const stats = validator.getValidationStats(validations);

      // Assert
      expect(stats.total).toBe(3);
      expect(stats.valid).toBe(2);
      expect(stats.invalid).toBe(1);
      expect(stats.averageScore).toBeCloseTo(0.57, 2);
      expect(stats.validityRate).toBeCloseTo(0.67, 2);
      expect(stats.qualityDistribution.excellent).toBe(1);
      expect(stats.qualityDistribution.good).toBe(1);
      expect(stats.qualityDistribution.poor).toBe(1);
      expect(stats.responseTypes.recommendation).toBe(1);
      expect(stats.responseTypes.analysis).toBe(1);
      expect(stats.responseTypes.error).toBe(1);
    });

    it('should handle empty validations array', () => {
      // Act
      const stats = validator.getValidationStats([]);

      // Assert
      expect(stats.total).toBe(0);
      expect(stats.valid).toBe(0);
      expect(stats.invalid).toBe(0);
      expect(stats.averageScore).toBe(0);
    });

    it('should handle null validations', () => {
      // Act
      const stats = validator.getValidationStats(null);

      // Assert
      expect(stats.total).toBe(0);
      expect(stats.valid).toBe(0);
      expect(stats.invalid).toBe(0);
      expect(stats.averageScore).toBe(0);
    });
  });

  describe('getTypeKeywords', () => {
    it('should return keywords for project type', () => {
      // Act
      const keywords = validator.getTypeKeywords('project');

      // Assert
      expect(keywords).toContain('project');
      expect(keywords).toContain('development');
      expect(keywords).toContain('code');
    });

    it('should return keywords for portfolio type', () => {
      // Act
      const keywords = validator.getTypeKeywords('portfolio');

      // Assert
      expect(keywords).toContain('portfolio');
      expect(keywords).toContain('projects');
      expect(keywords).toContain('overview');
    });

    it('should return empty array for unknown type', () => {
      // Act
      const keywords = validator.getTypeKeywords('unknown');

      // Assert
      expect(keywords).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle validation errors gracefully', () => {
      // Arrange
      const response = { content: 'Test' };
      const context = {};

      // Mock a method to throw an error
      const originalMethod = validator.validateBasicStructure;
      validator.validateBasicStructure = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      // Act
      const result = validator.validateResponse(response, context);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Validation failed: Test error');
      expect(result.qualityLevel).toBe('invalid');

      // Restore original method
      validator.validateBasicStructure = originalMethod;
    });
  });
});
