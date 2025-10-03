/**
 * AI-specific data models for Epic 10
 * Defines data structures and validation schemas for AI services
 */

/**
 * AI Context Types
 */
const AIContextType = {
  PROJECT: 'project',
  PORTFOLIO: 'portfolio',
  QUICK_WINS: 'quickWins',
  FOCUS_AREAS: 'focusAreas',
  PLANNING: 'planning',
  PRODUCTIVITY: 'productivity',
  QUALITY: 'quality'
};

/**
 * AI Response Types
 */
const AIResponseType = {
  RECOMMENDATION: 'recommendation',
  ANALYSIS: 'analysis',
  ANSWER: 'answer',
  SUGGESTION: 'suggestion',
  ERROR: 'error'
};

/**
 * AI Quality Levels
 */
const AIQualityLevel = {
  EXCELLENT: 'excellent',
  GOOD: 'good',
  FAIR: 'fair',
  POOR: 'poor',
  INVALID: 'invalid'
};

/**
 * AI Session Status
 */
const AISessionStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  EXPIRED: 'expired',
  DELETED: 'deleted'
};

/**
 * AI Context Model
 * Represents aggregated context data for AI consumption
 */
class AIContextModel {
  constructor(data = {}) {
    this.type = data.type || AIContextType.PROJECT;
    this.timestamp = data.timestamp || new Date().toISOString();
    this.project = data.project || {};
    this.portfolio = data.portfolio || {};
    this.analysis = data.analysis || {};
    this.metadata = data.metadata || {};
    this.error = data.error || null;
    this.fallback = data.fallback || false;
  }

  /**
   * Validate context data
   * @returns {Object} Validation result
   */
  validate() {
    const errors = [];
    const warnings = [];

    // Required fields validation
    if (!this.type) {
      errors.push('Context type is required');
    }

    if (!this.timestamp) {
      errors.push('Timestamp is required');
    }

    // Type-specific validation
    if (this.type === AIContextType.PROJECT && !this.project.name) {
      errors.push('Project name is required for project context');
    }

    if (this.type === AIContextType.PORTFOLIO && !this.portfolio.summary) {
      warnings.push('Portfolio summary missing');
    }

    // Timestamp validation
    if (this.timestamp && isNaN(new Date(this.timestamp).getTime())) {
      errors.push('Invalid timestamp format');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Convert to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      type: this.type,
      timestamp: this.timestamp,
      project: this.project,
      portfolio: this.portfolio,
      analysis: this.analysis,
      metadata: this.metadata,
      error: this.error,
      fallback: this.fallback
    };
  }

  /**
   * Get context size in bytes
   * @returns {number} Context size
   */
  getSize() {
    return JSON.stringify(this.toJSON()).length;
  }

  /**
   * Check if context is expired
   * @param {number} ttl - Time to live in milliseconds
   * @returns {boolean} True if expired
   */
  isExpired(ttl = 2 * 60 * 1000) {
    const age = Date.now() - new Date(this.timestamp).getTime();
    return age > ttl;
  }
}

/**
 * AI Session Model
 * Represents a conversation session
 */
class AISessionModel {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.userId = data.userId || null;
    this.status = data.status || AISessionStatus.ACTIVE;
    this.createdAt = data.createdAt || new Date();
    this.lastAccessed = data.lastAccessed || new Date();
    this.messages = data.messages || [];
    this.preferences = data.preferences || this.getDefaultPreferences();
    this.metadata = data.metadata || {};
  }

  /**
   * Generate unique session ID
   * @returns {string} Session ID
   */
  generateId() {
    return `ai-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get default preferences
   * @returns {Object} Default preferences
   */
  getDefaultPreferences() {
    return {
      analysisType: 'general',
      responseStyle: 'detailed',
      includeHistory: true,
      maxTokens: 1000,
      temperature: 0.7,
      contextType: AIContextType.PROJECT
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
      id: this.generateMessageId(),
      role,
      content,
      timestamp: new Date().toISOString(),
      metadata
    };

    this.messages.push(message);
    this.lastAccessed = new Date();

    // Maintain message limit
    if (this.messages.length > 50) {
      this.messages = this.messages.slice(-50);
    }
  }

  /**
   * Generate unique message ID
   * @returns {string} Message ID
   */
  generateMessageId() {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get recent messages
   * @param {number} count - Number of messages
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
    const age = Date.now() - this.lastAccessed.getTime();
    return age > timeout;
  }

  /**
   * Validate session data
   * @returns {Object} Validation result
   */
  validate() {
    const errors = [];
    const warnings = [];

    if (!this.id) {
      errors.push('Session ID is required');
    }

    if (!this.createdAt || isNaN(this.createdAt.getTime())) {
      errors.push('Valid creation date is required');
    }

    if (!this.lastAccessed || isNaN(this.lastAccessed.getTime())) {
      errors.push('Valid last accessed date is required');
    }

    if (this.messages.length > 100) {
      warnings.push('Session has many messages, consider cleanup');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Convert to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      status: this.status,
      createdAt: this.createdAt,
      lastAccessed: this.lastAccessed,
      messages: this.messages,
      preferences: this.preferences,
      metadata: this.metadata
    };
  }
}

/**
 * AI Response Model
 * Represents an AI-generated response
 */
class AIResponseModel {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.type = data.type || AIResponseType.ANSWER;
    this.content = data.content || '';
    this.metadata = data.metadata || {};
    this.quality = data.quality || {};
    this.timestamp = data.timestamp || new Date().toISOString();
    this.sessionId = data.sessionId || null;
    this.contextId = data.contextId || null;
    this.error = data.error || null;
  }

  /**
   * Generate unique response ID
   * @returns {string} Response ID
   */
  generateId() {
    return `ai-response-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set quality metrics
   * @param {Object} quality - Quality metrics
   */
  setQuality(quality) {
    this.quality = {
      score: quality.score || 0,
      level: quality.level || AIQualityLevel.INVALID,
      factors: quality.factors || {},
      suggestions: quality.suggestions || []
    };
  }

  /**
   * Check if response is high quality
   * @returns {boolean} True if high quality
   */
  isHighQuality() {
    return this.quality.level === AIQualityLevel.EXCELLENT || 
           this.quality.level === AIQualityLevel.GOOD;
  }

  /**
   * Validate response data
   * @returns {Object} Validation result
   */
  validate() {
    const errors = [];
    const warnings = [];

    if (!this.content || this.content.trim().length === 0) {
      errors.push('Response content is required');
    }

    if (this.content && this.content.length > 10000) {
      warnings.push('Response content is very long');
    }

    if (!this.type || !Object.values(AIResponseType).includes(this.type)) {
      errors.push('Valid response type is required');
    }

    if (this.quality.score && (this.quality.score < 0 || this.quality.score > 1)) {
      errors.push('Quality score must be between 0 and 1');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Convert to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      content: this.content,
      metadata: this.metadata,
      quality: this.quality,
      timestamp: this.timestamp,
      sessionId: this.sessionId,
      contextId: this.contextId,
      error: this.error
    };
  }
}

/**
 * AI Recommendation Model
 * Represents an AI-generated recommendation
 */
class AIRecommendationModel {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.type = data.type || 'general';
    this.title = data.title || '';
    this.description = data.description || '';
    this.priority = data.priority || 'medium';
    this.confidence = data.confidence || 0.5;
    this.effort = data.effort || 'unknown';
    this.impact = data.impact || 'unknown';
    this.reasoning = data.reasoning || '';
    this.actions = data.actions || [];
    this.project = data.project || null;
    this.metadata = data.metadata || {};
    this.timestamp = data.timestamp || new Date().toISOString();
  }

  /**
   * Generate unique recommendation ID
   * @returns {string} Recommendation ID
   */
  generateId() {
    return `ai-rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add action item
   * @param {string} action - Action description
   * @param {string} priority - Action priority
   */
  addAction(action, priority = 'medium') {
    this.actions.push({
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      description: action,
      priority,
      completed: false,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Calculate recommendation score
   * @returns {number} Recommendation score (0-100)
   */
  calculateScore() {
    let score = 0;
    let factors = 0;

    // Confidence factor (40%)
    score += this.confidence * 40;
    factors += 40;

    // Priority factor (30%)
    const priorityScores = { high: 30, medium: 20, low: 10 };
    score += priorityScores[this.priority] || 20;
    factors += 30;

    // Effort factor (20%) - lower effort = higher score
    const effortScores = { low: 20, medium: 15, high: 10, unknown: 10 };
    score += effortScores[this.effort] || 10;
    factors += 20;

    // Impact factor (10%)
    const impactScores = { high: 10, medium: 7, low: 4, unknown: 5 };
    score += impactScores[this.impact] || 5;
    factors += 10;

    return factors > 0 ? Math.round(score) : 0;
  }

  /**
   * Validate recommendation data
   * @returns {Object} Validation result
   */
  validate() {
    const errors = [];
    const warnings = [];

    if (!this.title || this.title.trim().length === 0) {
      errors.push('Recommendation title is required');
    }

    if (!this.description || this.description.trim().length === 0) {
      warnings.push('Recommendation description is missing');
    }

    if (this.confidence < 0 || this.confidence > 1) {
      errors.push('Confidence must be between 0 and 1');
    }

    const validPriorities = ['high', 'medium', 'low'];
    if (!validPriorities.includes(this.priority)) {
      errors.push('Priority must be high, medium, or low');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Convert to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      title: this.title,
      description: this.description,
      priority: this.priority,
      confidence: this.confidence,
      effort: this.effort,
      impact: this.impact,
      reasoning: this.reasoning,
      actions: this.actions,
      project: this.project,
      metadata: this.metadata,
      timestamp: this.timestamp,
      score: this.calculateScore()
    };
  }
}

/**
 * AI Analysis Model
 * Represents an AI-generated analysis
 */
class AIAnalysisModel {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.type = data.type || 'general';
    this.insights = data.insights || [];
    this.summary = data.summary || '';
    this.trends = data.trends || [];
    this.risks = data.risks || [];
    this.opportunities = data.opportunities || [];
    this.metrics = data.metrics || {};
    this.recommendations = data.recommendations || [];
    this.confidence = data.confidence || 0.5;
    this.metadata = data.metadata || {};
    this.timestamp = data.timestamp || new Date().toISOString();
  }

  /**
   * Generate unique analysis ID
   * @returns {string} Analysis ID
   */
  generateId() {
    return `ai-analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add insight
   * @param {string} insight - Insight text
   * @param {string} category - Insight category
   * @param {number} confidence - Insight confidence
   */
  addInsight(insight, category = 'general', confidence = 0.5) {
    this.insights.push({
      id: `insight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: insight,
      category,
      confidence,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Add trend
   * @param {string} trend - Trend description
   * @param {string} direction - Trend direction
   * @param {number} strength - Trend strength
   */
  addTrend(trend, direction = 'stable', strength = 0.5) {
    this.trends.push({
      id: `trend-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      description: trend,
      direction,
      strength,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Add risk
   * @param {string} risk - Risk description
   * @param {string} severity - Risk severity
   * @param {string} mitigation - Mitigation strategy
   */
  addRisk(risk, severity = 'medium', mitigation = '') {
    this.risks.push({
      id: `risk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      description: risk,
      severity,
      mitigation,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Validate analysis data
   * @returns {Object} Validation result
   */
  validate() {
    const errors = [];
    const warnings = [];

    if (!this.summary || this.summary.trim().length === 0) {
      warnings.push('Analysis summary is missing');
    }

    if (this.insights.length === 0) {
      warnings.push('No insights provided');
    }

    if (this.confidence < 0 || this.confidence > 1) {
      errors.push('Confidence must be between 0 and 1');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Convert to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      insights: this.insights,
      summary: this.summary,
      trends: this.trends,
      risks: this.risks,
      opportunities: this.opportunities,
      metrics: this.metrics,
      recommendations: this.recommendations,
      confidence: this.confidence,
      metadata: this.metadata,
      timestamp: this.timestamp
    };
  }
}

/**
 * AI Service Health Model
 * Represents the health status of AI services
 */
class AIServiceHealthModel {
  constructor(data = {}) {
    this.serviceName = data.serviceName || 'unknown';
    this.status = data.status || 'unknown';
    this.uptime = data.uptime || 0;
    this.responseTime = data.responseTime || 0;
    this.successRate = data.successRate || 0;
    this.errorRate = data.errorRate || 0;
    this.lastCheck = data.lastCheck || new Date().toISOString();
    this.circuitBreakerState = data.circuitBreakerState || 'CLOSED';
    this.metadata = data.metadata || {};
  }

  /**
   * Check if service is healthy
   * @returns {boolean} True if healthy
   */
  isHealthy() {
    return this.status === 'healthy' && 
           this.circuitBreakerState === 'CLOSED' &&
           this.successRate > 0.8;
  }

  /**
   * Get health score (0-100)
   * @returns {number} Health score
   */
  getHealthScore() {
    let score = 0;
    let factors = 0;

    // Status factor (40%)
    const statusScores = { healthy: 40, degraded: 20, unhealthy: 0 };
    score += statusScores[this.status] || 0;
    factors += 40;

    // Success rate factor (30%)
    score += this.successRate * 30;
    factors += 30;

    // Response time factor (20%) - lower is better
    const responseTimeScore = Math.max(0, 20 - (this.responseTime / 1000));
    score += responseTimeScore;
    factors += 20;

    // Circuit breaker factor (10%)
    const circuitScores = { CLOSED: 10, HALF_OPEN: 5, OPEN: 0 };
    score += circuitScores[this.circuitBreakerState] || 0;
    factors += 10;

    return factors > 0 ? Math.round(score) : 0;
  }

  /**
   * Convert to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      serviceName: this.serviceName,
      status: this.status,
      uptime: this.uptime,
      responseTime: this.responseTime,
      successRate: this.successRate,
      errorRate: this.errorRate,
      lastCheck: this.lastCheck,
      circuitBreakerState: this.circuitBreakerState,
      metadata: this.metadata,
      isHealthy: this.isHealthy(),
      healthScore: this.getHealthScore()
    };
  }
}

module.exports = {
  AIContextType,
  AIResponseType,
  AIQualityLevel,
  AISessionStatus,
  AIContextModel,
  AISessionModel,
  AIResponseModel,
  AIRecommendationModel,
  AIAnalysisModel,
  AIServiceHealthModel
};
