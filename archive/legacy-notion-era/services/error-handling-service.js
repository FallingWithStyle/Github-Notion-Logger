/**
 * Error Handling Service for Epic 9
 * Provides comprehensive error handling and fallback mechanisms
 */

const { ApiResponseModel } = require('../models/project-models');

class ErrorHandlingService {
  constructor() {
    this.errorLog = new Map();
    this.fallbackData = new Map();
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Handle API errors with fallback mechanisms
   * @param {Error} error - The error to handle
   * @param {string} context - Context where error occurred
   * @param {Object} fallbackData - Fallback data to return
   * @returns {Object} Standardized error response
   */
  handleApiError(error, context = 'unknown', fallbackData = null) {
    console.error(`❌ API Error in ${context}:`, error);

    // Log error for monitoring
    this.logError(error, context);

    // Determine error type and severity
    const errorInfo = this.categorizeError(error);
    
    // Create fallback response if available
    if (fallbackData) {
      console.warn(`⚠️ Using fallback data for ${context}`);
      return ApiResponseModel.success(fallbackData, {
        warning: `Using fallback data due to error: ${errorInfo.message}`,
        errorType: errorInfo.type,
        context: context
      });
    }

    // Return error response
    return ApiResponseModel.error(errorInfo.message, {
      errorType: errorInfo.type,
      severity: errorInfo.severity,
      context: context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle data consistency errors
   * @param {Error} error - The error to handle
   * @param {string} projectName - Project name where error occurred
   * @param {Object} partialData - Partial data available
   * @returns {Object} Standardized response with partial data
   */
  handleDataConsistencyError(error, projectName, partialData = null) {
    console.warn(`⚠️ Data consistency error for ${projectName}:`, error.message);

    // Log the inconsistency
    this.logDataInconsistency(projectName, error, partialData);

    if (partialData) {
      return ApiResponseModel.success(partialData, {
        warning: `Data inconsistency detected for ${projectName}. Using partial data.`,
        errorType: 'data_consistency',
        projectName: projectName,
        hasPartialData: true
      });
    }

    return ApiResponseModel.error(`Data consistency error for ${projectName}: ${error.message}`, {
      errorType: 'data_consistency',
      projectName: projectName,
      severity: 'medium'
    });
  }

  /**
   * Handle service unavailable errors with retry logic
   * @param {Function} operation - The operation to retry
   * @param {string} context - Context for the operation
   * @param {Object} fallbackData - Fallback data if all retries fail
   * @returns {Promise<Object>} Result of operation or fallback
   */
  async handleServiceUnavailable(operation, context = 'unknown', fallbackData = null) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${this.maxRetries} for ${context}`);
        const result = await operation();
        console.log(`✅ Success on attempt ${attempt} for ${context}`);
        return result;
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ Attempt ${attempt} failed for ${context}:`, error.message);
        
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }
      }
    }

    console.error(`❌ All retry attempts failed for ${context}`);
    
    if (fallbackData) {
      console.warn(`⚠️ Using fallback data for ${context} after all retries failed`);
      return ApiResponseModel.success(fallbackData, {
        warning: `Service unavailable after ${this.maxRetries} attempts. Using fallback data.`,
        errorType: 'service_unavailable',
        context: context,
        attempts: this.maxRetries
      });
    }

    return this.handleApiError(lastError, context, fallbackData);
  }

  /**
   * Handle cache errors with fallback to fresh data
   * @param {Error} error - Cache error
   * @param {Function} freshDataOperation - Operation to get fresh data
   * @param {string} context - Context for the operation
   * @returns {Promise<Object>} Fresh data or error response
   */
  async handleCacheError(error, freshDataOperation, context = 'unknown') {
    console.warn(`⚠️ Cache error in ${context}:`, error.message);
    
    try {
      console.log(`🔄 Fetching fresh data for ${context}`);
      const freshData = await freshDataOperation();
      console.log(`✅ Fresh data retrieved for ${context}`);
      return freshData;
    } catch (freshError) {
      console.error(`❌ Failed to fetch fresh data for ${context}:`, freshError);
      return this.handleApiError(freshError, context);
    }
  }

  /**
   * Handle validation errors
   * @param {Error} error - Validation error
   * @param {Object} data - Data that failed validation
   * @param {string} context - Context for validation
   * @returns {Object} Standardized validation error response
   */
  handleValidationError(error, data = null, context = 'unknown') {
    console.warn(`⚠️ Validation error in ${context}:`, error.message);
    
    return ApiResponseModel.error(`Validation failed: ${error.message}`, {
      errorType: 'validation',
      severity: 'low',
      context: context,
      data: data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Categorize error by type and severity
   * @param {Error} error - Error to categorize
   * @returns {Object} Error categorization
   */
  categorizeError(error) {
    const message = error.message.toLowerCase();
    
    // Network/connectivity errors
    if (message.includes('timeout') || message.includes('econnreset') || message.includes('enotfound')) {
      return {
        type: 'network',
        severity: 'high',
        message: 'Network connectivity issue. Please check your connection.',
        retryable: true
      };
    }

    // API rate limiting
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return {
        type: 'rate_limit',
        severity: 'medium',
        message: 'API rate limit exceeded. Please try again later.',
        retryable: true
      };
    }

    // Authentication errors
    if (message.includes('unauthorized') || message.includes('forbidden') || message.includes('401') || message.includes('403')) {
      return {
        type: 'authentication',
        severity: 'high',
        message: 'Authentication failed. Please check your credentials.',
        retryable: false
      };
    }

    // Data not found
    if (message.includes('not found') || message.includes('404')) {
      return {
        type: 'not_found',
        severity: 'low',
        message: 'Requested data not found.',
        retryable: false
      };
    }

    // Server errors
    if (message.includes('internal server error') || message.includes('500')) {
      return {
        type: 'server_error',
        severity: 'high',
        message: 'Internal server error. Please try again later.',
        retryable: true
      };
    }

    // Data consistency errors
    if (message.includes('inconsistent') || message.includes('mismatch')) {
      return {
        type: 'data_consistency',
        severity: 'medium',
        message: 'Data consistency issue detected.',
        retryable: false
      };
    }

    // Default error
    return {
      type: 'unknown',
      severity: 'medium',
      message: error.message || 'An unexpected error occurred.',
      retryable: false
    };
  }

  /**
   * Log error for monitoring
   * @param {Error} error - Error to log
   * @param {string} context - Context where error occurred
   */
  logError(error, context) {
    const errorId = `${context}_${Date.now()}`;
    this.errorLog.set(errorId, {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context: context,
      timestamp: new Date(),
      count: 1
    });

    // Keep only last 100 errors
    if (this.errorLog.size > 100) {
      const firstKey = this.errorLog.keys().next().value;
      this.errorLog.delete(firstKey);
    }
  }

  /**
   * Log data inconsistency
   * @param {string} projectName - Project name
   * @param {Error} error - Error details
   * @param {Object} partialData - Partial data available
   */
  logDataInconsistency(projectName, error, partialData) {
    const inconsistencyId = `inconsistency_${projectName}_${Date.now()}`;
    this.errorLog.set(inconsistencyId, {
      type: 'data_inconsistency',
      projectName: projectName,
      error: error.message,
      partialData: partialData,
      timestamp: new Date()
    });
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics
   */
  getErrorStatistics() {
    const errors = Array.from(this.errorLog.values());
    const errorTypes = {};
    const contexts = {};

    errors.forEach(error => {
      // Count by type
      const type = error.type || 'unknown';
      errorTypes[type] = (errorTypes[type] || 0) + 1;

      // Count by context
      const context = error.context || 'unknown';
      contexts[context] = (contexts[context] || 0) + 1;
    });

    return {
      totalErrors: errors.length,
      errorTypes: errorTypes,
      contexts: contexts,
      recentErrors: errors.slice(-10), // Last 10 errors
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clear error log
   */
  clearErrorLog() {
    this.errorLog.clear();
    console.log('🗑️ Error log cleared');
  }

  /**
   * Set fallback data for a context
   * @param {string} context - Context identifier
   * @param {Object} data - Fallback data
   */
  setFallbackData(context, data) {
    this.fallbackData.set(context, {
      data: data,
      timestamp: new Date()
    });
  }

  /**
   * Get fallback data for a context
   * @param {string} context - Context identifier
   * @returns {Object|null} Fallback data or null
   */
  getFallbackData(context) {
    const fallback = this.fallbackData.get(context);
    if (fallback) {
      // Check if fallback data is not too old (1 hour)
      const age = Date.now() - fallback.timestamp.getTime();
      if (age < 60 * 60 * 1000) {
        return fallback.data;
      }
    }
    return null;
  }

  /**
   * Sleep utility for retry delays
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a safe wrapper for async operations
   * @param {Function} operation - Async operation to wrap
   * @param {string} context - Context for error handling
   * @param {Object} fallbackData - Fallback data
   * @returns {Function} Wrapped operation
   */
  wrapAsyncOperation(operation, context, fallbackData = null) {
    return async (...args) => {
      try {
        return await operation(...args);
      } catch (error) {
        return this.handleApiError(error, context, fallbackData);
      }
    };
  }

  /**
   * Create a safe wrapper for sync operations
   * @param {Function} operation - Sync operation to wrap
   * @param {string} context - Context for error handling
   * @param {Object} fallbackData - Fallback data
   * @returns {Function} Wrapped operation
   */
  wrapSyncOperation(operation, context, fallbackData = null) {
    return (...args) => {
      try {
        return operation(...args);
      } catch (error) {
        return this.handleApiError(error, context, fallbackData);
      }
    };
  }
}

module.exports = ErrorHandlingService;
