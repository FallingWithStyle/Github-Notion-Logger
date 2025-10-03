/**
 * AI Service Circuit Breaker for Epic 10
 * Resilience pattern for AI service failures
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
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      circuitOpens: 0,
      circuitCloses: 0
    };
  }

  /**
   * Execute operation with circuit breaker protection
   * @param {Function} operation - Operation to execute
   * @param {Object} options - Execution options
   * @returns {Promise} Operation result
   */
  async execute(operation, options = {}) {
    this.stats.totalRequests++;
    this.requestCount++;

    // Check circuit state
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        console.log('🔄 Circuit breaker moving to HALF_OPEN state');
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
    }

    try {
      // Execute operation with timeout
      const result = await this.executeWithTimeout(operation, options.timeout);
      
      // Handle success
      this.onSuccess();
      return result;

    } catch (error) {
      // Handle failure
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Execute operation with timeout
   * @param {Function} operation - Operation to execute
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise} Operation result
   */
  async executeWithTimeout(operation, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Operation timeout'));
      }, timeout);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Handle successful operation
   */
  onSuccess() {
    this.stats.successfulRequests++;
    this.successCount++;
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      // If we've had enough successes in HALF_OPEN, close the circuit
      if (this.successCount >= 3) {
        this.state = 'CLOSED';
        this.successCount = 0;
        this.stats.circuitCloses++;
        console.log('✅ Circuit breaker closed - service recovered');
      }
    }
  }

  /**
   * Handle failed operation
   * @param {Error} error - Error that occurred
   */
  onFailure(error) {
    this.stats.failedRequests++;
    this.failureCount++;
    this.lastFailureTime = new Date();

    console.warn(`⚠️ Circuit breaker failure (${this.failureCount}/${this.failureThreshold}):`, error.message);

    // Check if we should open the circuit
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.stats.circuitOpens++;
      console.error('🚨 Circuit breaker OPEN - service marked as unavailable');
    }
  }

  /**
   * Check if we should attempt to reset the circuit
   * @returns {boolean} True if should attempt reset
   */
  shouldAttemptReset() {
    if (!this.lastFailureTime) return false;
    
    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.resetTimeout;
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
      lastFailureTime: this.lastFailureTime,
      stats: { ...this.stats },
      isHealthy: this.state === 'CLOSED',
      timeUntilReset: this.getTimeUntilReset()
    };
  }

  /**
   * Get time until circuit can be reset
   * @returns {number} Milliseconds until reset
   */
  getTimeUntilReset() {
    if (this.state !== 'OPEN' || !this.lastFailureTime) return 0;
    
    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return Math.max(0, this.resetTimeout - timeSinceLastFailure);
  }

  /**
   * Manually reset the circuit breaker
   */
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    console.log('🔄 Circuit breaker manually reset');
  }

  /**
   * Force open the circuit breaker
   */
  forceOpen() {
    this.state = 'OPEN';
    this.lastFailureTime = new Date();
    this.stats.circuitOpens++;
    console.log('🔒 Circuit breaker manually opened');
  }

  /**
   * Get circuit breaker statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const successRate = this.stats.totalRequests > 0 
      ? (this.stats.successfulRequests / this.stats.totalRequests) * 100 
      : 0;

    return {
      ...this.stats,
      successRate: Math.round(successRate * 100) / 100,
      failureRate: Math.round((100 - successRate) * 100) / 100,
      currentState: this.state,
      isHealthy: this.state === 'CLOSED',
      timeUntilReset: this.getTimeUntilReset()
    };
  }

  /**
   * Check if circuit breaker is healthy
   * @returns {boolean} True if healthy
   */
  isHealthy() {
    return this.state === 'CLOSED';
  }

  /**
   * Check if circuit breaker is available for requests
   * @returns {boolean} True if available
   */
  isAvailable() {
    return this.state === 'CLOSED' || this.state === 'HALF_OPEN';
  }
}

/**
 * AI Service Manager with Circuit Breaker
 * Manages multiple AI services with circuit breaker protection
 */
class AIServiceManager {
  constructor(options = {}) {
    this.services = new Map();
    this.defaultOptions = {
      failureThreshold: 5,
      timeout: 60000,
      resetTimeout: 30000
    };
    this.globalStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      circuitOpens: 0,
      circuitCloses: 0
    };
  }

  /**
   * Register an AI service with circuit breaker
   * @param {string} serviceName - Name of the service
   * @param {Function} serviceFunction - Service function
   * @param {Object} options - Circuit breaker options
   */
  registerService(serviceName, serviceFunction, options = {}) {
    const circuitBreaker = new AIServiceCircuitBreaker({
      ...this.defaultOptions,
      ...options
    });

    this.services.set(serviceName, {
      function: serviceFunction,
      circuitBreaker: circuitBreaker,
      name: serviceName
    });

    console.log(`🔧 Registered AI service: ${serviceName}`);
  }

  /**
   * Execute service with circuit breaker protection
   * @param {string} serviceName - Name of the service
   * @param {Array} args - Arguments to pass to service
   * @param {Object} options - Execution options
   * @returns {Promise} Service result
   */
  async executeService(serviceName, args = [], options = {}) {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }

    this.globalStats.totalRequests++;

    try {
      const result = await service.circuitBreaker.execute(
        () => service.function(...args),
        options
      );
      
      this.globalStats.successfulRequests++;
      return result;

    } catch (error) {
      this.globalStats.failedRequests++;
      throw error;
    }
  }

  /**
   * Get service state
   * @param {string} serviceName - Name of the service
   * @returns {Object} Service state
   */
  getServiceState(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }

    return service.circuitBreaker.getState();
  }

  /**
   * Get all services state
   * @returns {Object} All services state
   */
  getAllServicesState() {
    const states = {};
    for (const [name, service] of this.services) {
      states[name] = service.circuitBreaker.getState();
    }
    return states;
  }

  /**
   * Get global statistics
   * @returns {Object} Global statistics
   */
  getGlobalStats() {
    const successRate = this.globalStats.totalRequests > 0 
      ? (this.globalStats.successfulRequests / this.globalStats.totalRequests) * 100 
      : 0;

    return {
      ...this.globalStats,
      successRate: Math.round(successRate * 100) / 100,
      failureRate: Math.round((100 - successRate) * 100) / 100,
      totalServices: this.services.size,
      healthyServices: Array.from(this.services.values())
        .filter(service => service.circuitBreaker.isHealthy()).length
    };
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const [name, service] of this.services) {
      service.circuitBreaker.reset();
    }
    console.log('🔄 All circuit breakers reset');
  }

  /**
   * Get health status of all services
   * @returns {Object} Health status
   */
  getHealthStatus() {
    const health = {
      overall: 'healthy',
      services: {},
      issues: []
    };

    let unhealthyCount = 0;

    for (const [name, service] of this.services) {
      const state = service.circuitBreaker.getState();
      health.services[name] = {
        state: state.state,
        isHealthy: state.isHealthy,
        failureCount: state.failureCount,
        timeUntilReset: state.timeUntilReset
      };

      if (!state.isHealthy) {
        unhealthyCount++;
        health.issues.push(`${name} is ${state.state}`);
      }
    }

    if (unhealthyCount > 0) {
      health.overall = unhealthyCount === this.services.size ? 'unhealthy' : 'degraded';
    }

    return health;
  }

  /**
   * Check if any service is available
   * @returns {boolean} True if any service is available
   */
  hasAvailableService() {
    return Array.from(this.services.values())
      .some(service => service.circuitBreaker.isAvailable());
  }

  /**
   * Get the best available service
   * @returns {string|null} Name of best available service
   */
  getBestAvailableService() {
    const availableServices = Array.from(this.services.entries())
      .filter(([name, service]) => service.circuitBreaker.isAvailable())
      .sort((a, b) => {
        // Prefer services with fewer failures
        return a[1].circuitBreaker.failureCount - b[1].circuitBreaker.failureCount;
      });

    return availableServices.length > 0 ? availableServices[0][0] : null;
  }
}

module.exports = { AIServiceCircuitBreaker, AIServiceManager };
