/**
 * AI Response Validator for Epic 10
 * Quality assurance and validation for AI responses
 */

class AIResponseValidator {
  constructor() {
    this.qualityThresholds = {
      minLength: 10,
      maxLength: 2000,
      relevanceScore: 0.7,
      coherenceScore: 0.6,
      helpfulnessScore: 0.5
    };

    this.responseTypes = {
      RECOMMENDATION: 'recommendation',
      ANALYSIS: 'analysis',
      ANSWER: 'answer',
      SUGGESTION: 'suggestion',
      ERROR: 'error'
    };

    this.qualityLevels = {
      EXCELLENT: 'excellent',
      GOOD: 'good',
      FAIR: 'fair',
      POOR: 'poor',
      INVALID: 'invalid'
    };
  }

  /**
   * Validate AI response structure and content
   * @param {Object} response - AI response object
   * @param {Object} context - Request context
   * @returns {Object} Validation result
   */
  validateResponse(response, context = {}) {
    try {
      const validation = {
        isValid: true,
        errors: [],
        warnings: [],
        qualityScore: 0,
        qualityLevel: this.qualityLevels.INVALID,
        responseType: this.responseTypes.ERROR,
        suggestions: []
      };

      // Basic structure validation
      this.validateBasicStructure(response, validation);
      
      // Content validation
      this.validateContent(response, validation);
      
      // Context relevance validation
      this.validateContextRelevance(response, context, validation);
      
      // Quality scoring
      this.calculateQualityScore(response, context, validation);
      
      // Determine response type
      this.determineResponseType(response, validation);
      
      // Generate improvement suggestions
      this.generateSuggestions(validation);

      return validation;

    } catch (error) {
      console.error('❌ Error validating AI response:', error);
      return {
        isValid: false,
        errors: ['Validation failed: ' + error.message],
        warnings: [],
        qualityScore: 0,
        qualityLevel: this.qualityLevels.INVALID,
        responseType: this.responseTypes.ERROR,
        suggestions: ['Fix validation errors and try again']
      };
    }
  }

  /**
   * Validate basic response structure
   * @param {Object} response - AI response object
   * @param {Object} validation - Validation result object
   */
  validateBasicStructure(response, validation) {
    // Check if response exists
    if (!response) {
      validation.errors.push('Response is null or undefined');
      validation.isValid = false;
      return;
    }

    // Check if response has content
    if (!response.content && !response.response && !response.text) {
      validation.errors.push('Response has no content field');
      validation.isValid = false;
    }

    // Check response format
    if (typeof response !== 'object') {
      validation.errors.push('Response must be an object');
      validation.isValid = false;
    }

    // Check for required fields in structured responses
    if (response.type === 'recommendation') {
      if (!response.title || !response.reasoning) {
        validation.warnings.push('Recommendation missing title or reasoning');
      }
    }

    if (response.type === 'analysis') {
      if (!response.insights || !Array.isArray(response.insights)) {
        validation.warnings.push('Analysis missing insights array');
      }
    }
  }

  /**
   * Validate response content
   * @param {Object} response - AI response object
   * @param {Object} validation - Validation result object
   */
  validateContent(response, validation) {
    const content = response.content || response.response || response.text || '';
    
    if (typeof content !== 'string') {
      validation.errors.push('Response content must be a string');
      validation.isValid = false;
      return;
    }

    // Length validation
    if (content.length < this.qualityThresholds.minLength) {
      validation.errors.push(`Response too short (min ${this.qualityThresholds.minLength} characters)`);
      validation.isValid = false;
    }

    if (content.length > this.qualityThresholds.maxLength) {
      validation.warnings.push(`Response very long (${content.length} characters, max ${this.qualityThresholds.maxLength})`);
    }

    // Content quality checks
    this.checkContentQuality(content, validation);
  }

  /**
   * Check content quality indicators
   * @param {string} content - Response content
   * @param {Object} validation - Validation result object
   */
  checkContentQuality(content, validation) {
    // Check for empty or placeholder content
    if (content.trim().length === 0) {
      validation.errors.push('Response content is empty');
      validation.isValid = false;
      return;
    }

    // Check for placeholder text
    const placeholders = ['[placeholder]', '[insert text]', 'TODO:', 'FIXME:', '...'];
    const hasPlaceholder = placeholders.some(placeholder => 
      content.toLowerCase().includes(placeholder.toLowerCase())
    );
    
    if (hasPlaceholder) {
      validation.warnings.push('Response contains placeholder text');
    }

    // Check for repetitive content
    const words = content.toLowerCase().split(/\s+/);
    const wordCounts = {};
    words.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
    
    const maxRepetition = Math.max(...Object.values(wordCounts));
    if (maxRepetition > words.length * 0.3) {
      validation.warnings.push('Response contains repetitive content');
    }

    // Check for proper sentence structure
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) {
      validation.warnings.push('Response has no complete sentences');
    }

    // Check for question marks in answers
    const questionCount = (content.match(/\?/g) || []).length;
    if (questionCount > sentences.length * 0.5) {
      validation.warnings.push('Response contains too many questions');
    }
  }

  /**
   * Validate context relevance
   * @param {Object} response - AI response object
   * @param {Object} context - Request context
   * @param {Object} validation - Validation result object
   */
  validateContextRelevance(response, context, validation) {
    if (!context || Object.keys(context).length === 0) {
      validation.warnings.push('No context provided for relevance validation');
      return;
    }

    const content = response.content || response.response || response.text || '';
    const relevanceScore = this.calculateRelevanceScore(content, context);
    
    if (relevanceScore < this.qualityThresholds.relevanceScore) {
      validation.warnings.push(`Low relevance score: ${relevanceScore.toFixed(2)}`);
    }

    // Check for project-specific content
    if (context.project && context.project.name) {
      const projectMentioned = content.toLowerCase().includes(context.project.name.toLowerCase());
      if (!projectMentioned && context.type === 'project') {
        validation.warnings.push('Response does not mention the specific project');
      }
    }

    // Check for data-driven insights
    if (context.type === 'portfolio' && !this.containsDataInsights(content)) {
      validation.warnings.push('Portfolio response lacks data-driven insights');
    }
  }

  /**
   * Calculate relevance score
   * @param {string} content - Response content
   * @param {Object} context - Request context
   * @returns {number} Relevance score (0-1)
   */
  calculateRelevanceScore(content, context) {
    let score = 0;
    let factors = 0;

    // Project name relevance
    if (context.project && context.project.name) {
      const projectName = context.project.name.toLowerCase();
      const contentLower = content.toLowerCase();
      if (contentLower.includes(projectName)) {
        score += 0.3;
      }
      factors += 0.3;
    }

    // Context type relevance
    if (context.type) {
      const typeKeywords = this.getTypeKeywords(context.type);
      const typeMatches = typeKeywords.filter(keyword => 
        content.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      score += (typeMatches / typeKeywords.length) * 0.3;
      factors += 0.3;
    }

    // Data relevance
    if (context.analysis || context.data) {
      const dataKeywords = ['completion', 'progress', 'health', 'velocity', 'stories', 'tasks'];
      const dataMatches = dataKeywords.filter(keyword => 
        content.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      score += (dataMatches / dataKeywords.length) * 0.4;
      factors += 0.4;
    }

    return factors > 0 ? score / factors : 0;
  }

  /**
   * Get keywords for context type
   * @param {string} type - Context type
   * @returns {Array} Relevant keywords
   */
  getTypeKeywords(type) {
    const keywordMap = {
      'project': ['project', 'development', 'code', 'repository', 'commits'],
      'portfolio': ['portfolio', 'projects', 'overview', 'summary', 'comparison'],
      'quickWins': ['quick', 'wins', 'easy', 'fast', 'complete', 'finish'],
      'focusAreas': ['focus', 'priority', 'important', 'critical', 'attention'],
      'planning': ['plan', 'planning', 'goals', 'objectives', 'strategy'],
      'productivity': ['productivity', 'efficiency', 'velocity', 'performance', 'metrics'],
      'quality': ['quality', 'standards', 'best practices', 'improvement', 'review']
    };

    return keywordMap[type] || [];
  }

  /**
   * Check if content contains data insights
   * @param {string} content - Response content
   * @returns {boolean} True if contains data insights
   */
  containsDataInsights(content) {
    const dataIndicators = [
      /\d+%/, // percentages
      /\d+\s+(stories|tasks|commits|projects)/, // counts
      /(increased|decreased|improved|declined)/, // trends
      /(high|low|medium)\s+(completion|health|activity)/, // levels
      /\d+\s+(days|weeks|months)/ // time periods
    ];

    return dataIndicators.some(pattern => pattern.test(content));
  }

  /**
   * Calculate overall quality score
   * @param {Object} response - AI response object
   * @param {Object} context - Request context
   * @param {Object} validation - Validation result object
   */
  calculateQualityScore(response, context, validation) {
    let score = 0;
    let factors = 0;

    // Length score (0-1)
    const content = response.content || response.response || response.text || '';
    const lengthScore = Math.min(content.length / 200, 1); // Optimal around 200 chars
    score += lengthScore * 0.2;
    factors += 0.2;

    // Structure score (0-1)
    const structureScore = this.calculateStructureScore(response);
    score += structureScore * 0.2;
    factors += 0.2;

    // Relevance score (0-1)
    const relevanceScore = this.calculateRelevanceScore(content, context);
    score += relevanceScore * 0.3;
    factors += 0.3;

    // Coherence score (0-1)
    const coherenceScore = this.calculateCoherenceScore(content);
    score += coherenceScore * 0.2;
    factors += 0.2;

    // Helpfulness score (0-1)
    const helpfulnessScore = this.calculateHelpfulnessScore(content, context);
    score += helpfulnessScore * 0.1;
    factors += 0.1;

    validation.qualityScore = factors > 0 ? Math.round((score / factors) * 100) / 100 : 0;
    validation.qualityLevel = this.determineQualityLevel(validation.qualityScore);
  }

  /**
   * Calculate structure score
   * @param {Object} response - AI response object
   * @returns {number} Structure score (0-1)
   */
  calculateStructureScore(response) {
    let score = 0;
    let factors = 0;

    // Has content
    const hasContent = !!(response.content || response.response || response.text);
    score += hasContent ? 1 : 0;
    factors += 1;

    // Has proper formatting
    const content = response.content || response.response || response.text || '';
    const hasParagraphs = content.includes('\n\n') || content.split('.').length > 3;
    score += hasParagraphs ? 0.5 : 0;
    factors += 0.5;

    // Has actionable content
    const hasActionWords = /(should|recommend|suggest|consider|try|implement|focus)/i.test(content);
    score += hasActionWords ? 0.5 : 0;
    factors += 0.5;

    return factors > 0 ? score / factors : 0;
  }

  /**
   * Calculate coherence score
   * @param {string} content - Response content
   * @returns {number} Coherence score (0-1)
   */
  calculateCoherenceScore(content) {
    let score = 0;
    let factors = 0;

    // Sentence structure
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 0) {
      const avgWordsPerSentence = content.split(/\s+/).length / sentences.length;
      const structureScore = Math.min(avgWordsPerSentence / 15, 1); // Optimal around 15 words
      score += structureScore;
      factors += 1;
    }

    // Transition words
    const transitionWords = ['however', 'therefore', 'additionally', 'furthermore', 'moreover', 'consequently'];
    const hasTransitions = transitionWords.some(word => content.toLowerCase().includes(word));
    score += hasTransitions ? 0.3 : 0;
    factors += 0.3;

    // Logical flow
    const hasLogicalFlow = content.includes('because') || content.includes('due to') || content.includes('as a result');
    score += hasLogicalFlow ? 0.2 : 0;
    factors += 0.2;

    return factors > 0 ? score / factors : 0;
  }

  /**
   * Calculate helpfulness score
   * @param {string} content - Response content
   * @param {Object} context - Request context
   * @returns {number} Helpfulness score (0-1)
   */
  calculateHelpfulnessScore(content, context) {
    let score = 0;
    let factors = 0;

    // Contains specific recommendations
    const hasRecommendations = /(recommend|suggest|should|consider|try)/i.test(content);
    score += hasRecommendations ? 0.4 : 0;
    factors += 0.4;

    // Contains data references
    const hasDataReferences = /\d+/.test(content);
    score += hasDataReferences ? 0.3 : 0;
    factors += 0.3;

    // Contains actionable steps
    const hasActionSteps = /(step|action|next|implement|do|create)/i.test(content);
    score += hasActionSteps ? 0.3 : 0;
    factors += 0.3;

    return factors > 0 ? score / factors : 0;
  }

  /**
   * Determine quality level based on score
   * @param {number} score - Quality score (0-1)
   * @returns {string} Quality level
   */
  determineQualityLevel(score) {
    if (score >= 0.8) return this.qualityLevels.EXCELLENT;
    if (score >= 0.6) return this.qualityLevels.GOOD;
    if (score >= 0.4) return this.qualityLevels.FAIR;
    if (score >= 0.2) return this.qualityLevels.POOR;
    return this.qualityLevels.INVALID;
  }

  /**
   * Determine response type
   * @param {Object} response - AI response object
   * @param {Object} validation - Validation result object
   */
  determineResponseType(response, validation) {
    const content = (response.content || response.response || response.text || '').toLowerCase();

    if (content.includes('recommend') || content.includes('suggest')) {
      validation.responseType = this.responseTypes.RECOMMENDATION;
    } else if (content.includes('analyze') || content.includes('analysis')) {
      validation.responseType = this.responseTypes.ANALYSIS;
    } else if (content.includes('error') || content.includes('failed')) {
      validation.responseType = this.responseTypes.ERROR;
    } else if (content.includes('try') || content.includes('consider')) {
      validation.responseType = this.responseTypes.SUGGESTION;
    } else {
      validation.responseType = this.responseTypes.ANSWER;
    }
  }

  /**
   * Generate improvement suggestions
   * @param {Object} validation - Validation result object
   */
  generateSuggestions(validation) {
    const suggestions = [];

    if (validation.qualityScore < 0.6) {
      suggestions.push('Improve response quality by adding more specific details');
    }

    if (validation.warnings.some(w => w.includes('relevance'))) {
      suggestions.push('Make response more relevant to the specific context');
    }

    if (validation.warnings.some(w => w.includes('placeholder'))) {
      suggestions.push('Replace placeholder text with actual content');
    }

    if (validation.warnings.some(w => w.includes('repetitive'))) {
      suggestions.push('Reduce repetitive content and improve variety');
    }

    if (validation.qualityLevel === this.qualityLevels.POOR) {
      suggestions.push('Consider regenerating the response with better context');
    }

    validation.suggestions = suggestions;
  }

  /**
   * Validate response against specific criteria
   * @param {Object} response - AI response object
   * @param {Object} criteria - Validation criteria
   * @returns {Object} Validation result
   */
  validateAgainstCriteria(response, criteria = {}) {
    const validation = this.validateResponse(response, criteria.context || {});
    
    // Apply custom criteria
    if (criteria.minQualityScore && validation.qualityScore < criteria.minQualityScore) {
      validation.errors.push(`Quality score ${validation.qualityScore} below minimum ${criteria.minQualityScore}`);
      validation.isValid = false;
    }

    if (criteria.requiredType && validation.responseType !== criteria.requiredType) {
      validation.warnings.push(`Expected response type ${criteria.requiredType}, got ${validation.responseType}`);
    }

    if (criteria.maxLength && (response.content || response.response || response.text || '').length > criteria.maxLength) {
      validation.errors.push(`Response length exceeds maximum ${criteria.maxLength} characters`);
      validation.isValid = false;
    }

    return validation;
  }

  /**
   * Get validation statistics
   * @param {Array} validations - Array of validation results
   * @returns {Object} Validation statistics
   */
  getValidationStats(validations) {
    if (!validations || validations.length === 0) {
      return { total: 0, valid: 0, invalid: 0, averageScore: 0 };
    }

    const stats = {
      total: validations.length,
      valid: validations.filter(v => v.isValid).length,
      invalid: validations.filter(v => !v.isValid).length,
      averageScore: 0,
      qualityDistribution: {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0,
        invalid: 0
      },
      responseTypes: {}
    };

    let totalScore = 0;
    validations.forEach(validation => {
      totalScore += validation.qualityScore;
      stats.qualityDistribution[validation.qualityLevel]++;
      stats.responseTypes[validation.responseType] = (stats.responseTypes[validation.responseType] || 0) + 1;
    });

    stats.averageScore = totalScore / validations.length;
    stats.validityRate = stats.valid / stats.total;

    return stats;
  }
}

module.exports = AIResponseValidator;
