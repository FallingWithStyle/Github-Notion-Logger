/**
 * AI Service Circuit Breaker - Epic 10 Implementation
 * Provides resilience patterns for AI service calls
 */

class AIServiceCircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.timeout = options.timeout || 60000; // 1 minute
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
    this.requestCount = 0;
    this.monitoring = {
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      averageResponseTime: 0,
      lastResetTime: Date.now()
    };
  }

  /**
   * Execute operation with circuit breaker protection
   * @param {Function} operation - The operation to execute
   * @param {Object} context - Additional context for logging
   * @returns {Promise} Operation result
   */
  async execute(operation, context = {}) {
    this.requestCount++;
    this.monitoring.totalRequests++;

    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
        console.log('🔄 Circuit breaker transitioning to HALF_OPEN state');
      } else {
        const error = new Error('Circuit breaker is OPEN - service unavailable');
        error.code = 'CIRCUIT_BREAKER_OPEN';
        error.retryAfter = Math.ceil((this.timeout - (Date.now() - this.lastFailureTime)) / 1000);
        throw error;
      }
    }

    const startTime = Date.now();
    
    try {
      const result = await operation();
      this.onSuccess(startTime);
      return result;
    } catch (error) {
      this.onFailure(error, startTime, context);
      throw error;
    }
  }

  /**
   * Handle successful operation
   * @param {number} startTime - Operation start time
   */
  onSuccess(startTime) {
    const responseTime = Date.now() - startTime;
    this.successCount++;
    this.monitoring.totalSuccesses++;
    
    // Update average response time
    this.updateAverageResponseTime(responseTime);

    // Reset failure count on success
    if (this.state === 'HALF_OPEN') {
      this.failureCount = 0;
      this.state = 'CLOSED';
      console.log('✅ Circuit breaker reset to CLOSED state');
    }

    console.log(`✅ AI service call succeeded (${responseTime}ms)`);
  }

  /**
   * Handle failed operation
   * @param {Error} error - The error that occurred
   * @param {number} startTime - Operation start time
   * @param {Object} context - Additional context
   */
  onFailure(error, startTime, context) {
    const responseTime = Date.now() - startTime;
    this.failureCount++;
    this.monitoring.totalFailures++;
    this.lastFailureTime = Date.now();
    
    // Update average response time
    this.updateAverageResponseTime(responseTime);

    console.error(`❌ AI service call failed (${responseTime}ms):`, {
      error: error.message,
      context: context,
      failureCount: this.failureCount,
      state: this.state
    });

    // Check if we should open the circuit
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      console.warn(`🚨 Circuit breaker opened after ${this.failureCount} failures`);
    }
  }

  /**
   * Update average response time
   * @param {number} responseTime - Current response time
   */
  updateAverageResponseTime(responseTime) {
    const totalTime = this.monitoring.averageResponseTime * (this.monitoring.totalRequests - 1) + responseTime;
    this.monitoring.averageResponseTime = totalTime / this.monitoring.totalRequests;
  }

  /**
   * Get current circuit breaker state
   * @returns {Object} Current state information
   */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      lastFailureTime: this.lastFailureTime,
      isOpen: this.state === 'OPEN',
      isHalfOpen: this.state === 'HALF_OPEN',
      isClosed: this.state === 'CLOSED',
      monitoring: { ...this.monitoring }
    };
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.requestCount = 0;
    this.lastFailureTime = null;
    this.monitoring.lastResetTime = Date.now();
    console.log('🔄 Circuit breaker manually reset');
  }

  /**
   * Get health status
   * @returns {Object} Health status
   */
  getHealth() {
    const now = Date.now();
    const timeSinceLastFailure = this.lastFailureTime ? now - this.lastFailureTime : null;
    const failureRate = this.monitoring.totalRequests > 0 
      ? this.monitoring.totalFailures / this.monitoring.totalRequests 
      : 0;

    return {
      status: this.state === 'CLOSED' ? 'healthy' : this.state === 'HALF_OPEN' ? 'degraded' : 'unhealthy',
      state: this.state,
      failureRate: Math.round(failureRate * 100) / 100,
      averageResponseTime: Math.round(this.monitoring.averageResponseTime),
      totalRequests: this.monitoring.totalRequests,
      totalFailures: this.monitoring.totalFailures,
      totalSuccesses: this.monitoring.totalSuccesses,
      timeSinceLastFailure: timeSinceLastFailure,
      canRetry: this.state !== 'OPEN' || (timeSinceLastFailure && timeSinceLastFailure > this.timeout)
    };
  }

  /**
   * Check if operation can be executed
   * @returns {boolean} True if operation can be executed
   */
  canExecute() {
    if (this.state === 'CLOSED') {
      return true;
    }
    
    if (this.state === 'HALF_OPEN') {
      return true;
    }
    
    if (this.state === 'OPEN') {
      return Date.now() - this.lastFailureTime > this.timeout;
    }
    
    return false;
  }

  /**
   * Get retry delay for failed operations
   * @returns {number} Retry delay in milliseconds
   */
  getRetryDelay() {
    if (this.state === 'OPEN') {
      return this.timeout - (Date.now() - this.lastFailureTime);
    }
    
    return 0;
  }

  /**
   * Create a fallback response for when circuit is open
   * @param {string} operation - Operation name
   * @returns {Object} Fallback response
   */
  createFallbackResponse(operation) {
    return {
      success: false,
      error: 'AI service temporarily unavailable',
      fallback: {
        type: 'circuit_breaker_open',
        data: 'The AI service is currently unavailable due to repeated failures. Please try again later.',
        timestamp: new Date().toISOString(),
        retryAfter: this.getRetryDelay()
      },
      details: {
        errorCode: 'CIRCUIT_BREAKER_OPEN',
        operation: operation,
        state: this.state,
        failureCount: this.failureCount
      }
    };
  }
}

/**
 * Circuit Breaker Manager for multiple services
 */
class AICircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
    this.defaultOptions = {
      failureThreshold: 5,
      timeout: 60000,
      resetTimeout: 30000
    };
  }

  /**
   * Get or create circuit breaker for a service
   * @param {string} serviceName - Name of the service
   * @param {Object} options - Circuit breaker options
   * @returns {AIServiceCircuitBreaker} Circuit breaker instance
   */
  getBreaker(serviceName, options = {}) {
    if (!this.breakers.has(serviceName)) {
      const breakerOptions = { ...this.defaultOptions, ...options };
      this.breakers.set(serviceName, new AIServiceCircuitBreaker(breakerOptions));
    }
    
    return this.breakers.get(serviceName);
  }

  /**
   * Execute operation with circuit breaker for specific service
   * @param {string} serviceName - Name of the service
   * @param {Function} operation - Operation to execute
   * @param {Object} context - Additional context
   * @returns {Promise} Operation result
   */
  async execute(serviceName, operation, context = {}) {
    const breaker = this.getBreaker(serviceName);
    return await breaker.execute(operation, context);
  }

  /**
   * Get health status for all circuit breakers
   * @returns {Object} Health status for all services
   */
  getAllHealth() {
    const health = {};
    
    for (const [serviceName, breaker] of this.breakers.entries()) {
      health[serviceName] = breaker.getHealth();
    }
    
    return health;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    console.log('🔄 All circuit breakers reset');
  }

  /**
   * Get overall system health
   * @returns {Object} Overall system health
   */
  getSystemHealth() {
    const allHealth = this.getAllHealth();
    const services = Object.keys(allHealth);
    
    if (services.length === 0) {
      return {
        status: 'unknown',
        services: 0,
        healthy: 0,
        degraded: 0,
        unhealthy: 0
      };
    }

    const statusCounts = services.reduce((counts, service) => {
      const status = allHealth[service].status;
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});

    const overallStatus = statusCounts.unhealthy > 0 ? 'unhealthy' :
                         statusCounts.degraded > 0 ? 'degraded' : 'healthy';

    return {
      status: overallStatus,
      services: services.length,
      healthy: statusCounts.healthy || 0,
      degraded: statusCounts.degraded || 0,
      unhealthy: statusCounts.unhealthy || 0,
      details: allHealth
    };
  }
}

// Create global circuit breaker manager
const circuitBreakerManager = new AICircuitBreakerManager();

module.exports = {
  AIServiceCircuitBreaker,
  AICircuitBreakerManager,
  circuitBreakerManager
};