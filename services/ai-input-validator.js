/**
 * AI Input Validator for Epic 10
 * Input validation and sanitization for AI services
 */

class AIInputValidator {
  constructor() {
    this.maxInputLength = 10000;
    this.maxMessageLength = 2000;
    this.maxSessionIdLength = 100;
    this.allowedRoles = ['user', 'assistant', 'system'];
    this.blockedPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
      /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi
    ];
    this.suspiciousPatterns = [
      /password\s*[:=]/gi,
      /api[_-]?key\s*[:=]/gi,
      /token\s*[:=]/gi,
      /secret\s*[:=]/gi,
      /credential\s*[:=]/gi,
      /\.env/gi,
      /config\s*[:=]/gi
    ];
  }

  /**
   * Validate and sanitize user input
   * @param {string} input - User input
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  validateInput(input, options = {}) {
    const result = {
      isValid: true,
      sanitizedInput: input,
      errors: [],
      warnings: [],
      metadata: {
        originalLength: input ? input.length : 0,
        sanitizedLength: 0,
        patternsDetected: [],
        suspiciousContent: false
      }
    };

    try {
      // Basic validation
      this.validateBasicInput(input, result);
      
      // Sanitize input
      result.sanitizedInput = this.sanitizeInput(input, options);
      result.metadata.sanitizedLength = result.sanitizedInput.length;
      
      // Check for blocked patterns
      this.checkBlockedPatterns(input, result);
      
      // Check for suspicious content
      this.checkSuspiciousContent(input, result);
      
      // Validate length
      this.validateLength(result.sanitizedInput, options, result);
      
      // Check encoding
      this.validateEncoding(result.sanitizedInput, result);

    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation error: ${error.message}`);
    }

    return result;
  }

  /**
   * Validate chat message
   * @param {Object} message - Chat message object
   * @returns {Object} Validation result
   */
  validateChatMessage(message) {
    const result = {
      isValid: true,
      sanitizedMessage: message,
      errors: [],
      warnings: [],
      metadata: {
        originalSize: JSON.stringify(message).length,
        sanitizedSize: 0
      }
    };

    try {
      // Validate message structure
      this.validateMessageStructure(message, result);
      
      // Validate and sanitize content
      if (message.content) {
        const contentValidation = this.validateInput(message.content, {
          maxLength: this.maxMessageLength,
          allowHtml: false
        });
        
        if (!contentValidation.isValid) {
          result.isValid = false;
          result.errors.push(...contentValidation.errors);
        }
        
        result.sanitizedMessage.content = contentValidation.sanitizedInput;
        result.warnings.push(...contentValidation.warnings);
      }
      
      // Validate role
      this.validateRole(message.role, result);
      
      // Validate metadata
      if (message.metadata) {
        this.validateMetadata(message.metadata, result);
      }
      
      result.metadata.sanitizedSize = JSON.stringify(result.sanitizedMessage).length;

    } catch (error) {
      result.isValid = false;
      result.errors.push(`Message validation error: ${error.message}`);
    }

    return result;
  }

  /**
   * Validate session ID
   * @param {string} sessionId - Session identifier
   * @returns {Object} Validation result
   */
  validateSessionId(sessionId) {
    const result = {
      isValid: true,
      sanitizedSessionId: sessionId,
      errors: [],
      warnings: []
    };

    if (!sessionId || typeof sessionId !== 'string') {
      result.isValid = false;
      result.errors.push('Session ID must be a non-empty string');
      return result;
    }

    // Check length
    if (sessionId.length > this.maxSessionIdLength) {
      result.isValid = false;
      result.errors.push(`Session ID too long (max ${this.maxSessionIdLength} characters)`);
    }

    // Check for valid characters
    if (!/^[a-zA-Z0-9\-_]+$/.test(sessionId)) {
      result.isValid = false;
      result.errors.push('Session ID contains invalid characters');
    }

    // Sanitize
    result.sanitizedSessionId = sessionId.trim().replace(/[^a-zA-Z0-9\-_]/g, '');

    return result;
  }

  /**
   * Validate context filters
   * @param {Object} filters - Context filters
   * @returns {Object} Validation result
   */
  validateContextFilters(filters) {
    const result = {
      isValid: true,
      sanitizedFilters: {},
      errors: [],
      warnings: []
    };

    if (!filters || typeof filters !== 'object') {
      result.isValid = false;
      result.errors.push('Filters must be an object');
      return result;
    }

    // Validate each filter
    Object.entries(filters).forEach(([key, value]) => {
      const filterValidation = this.validateFilterValue(key, value);
      if (filterValidation.isValid) {
        result.sanitizedFilters[key] = filterValidation.sanitizedValue;
      } else {
        result.isValid = false;
        result.errors.push(...filterValidation.errors);
      }
    });

    return result;
  }

  /**
   * Validate basic input
   * @param {string} input - Input string
   * @param {Object} result - Validation result object
   */
  validateBasicInput(input, result) {
    if (input === null || input === undefined) {
      result.isValid = false;
      result.errors.push('Input cannot be null or undefined');
      return;
    }

    if (typeof input !== 'string') {
      result.isValid = false;
      result.errors.push('Input must be a string');
      return;
    }

    if (input.length === 0) {
      result.isValid = false;
      result.errors.push('Input cannot be empty');
      return;
    }
  }

  /**
   * Sanitize input string
   * @param {string} input - Input string
   * @param {Object} options - Sanitization options
   * @returns {string} Sanitized input
   */
  sanitizeInput(input, options = {}) {
    if (!input || typeof input !== 'string') {
      return '';
    }

    let sanitized = input;

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // Remove control characters except newlines and tabs
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Handle HTML based on options
    if (!options.allowHtml) {
      sanitized = this.stripHtml(sanitized);
    } else {
      sanitized = this.sanitizeHtml(sanitized);
    }

    // Limit length
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    return sanitized;
  }

  /**
   * Strip HTML tags
   * @param {string} input - Input string
   * @returns {string} String with HTML stripped
   */
  stripHtml(input) {
    return input.replace(/<[^>]*>/g, '');
  }

  /**
   * Sanitize HTML content
   * @param {string} input - Input string
   * @returns {string} Sanitized HTML
   */
  sanitizeHtml(input) {
    // Remove dangerous tags and attributes
    let sanitized = input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '');

    return sanitized;
  }

  /**
   * Check for blocked patterns
   * @param {string} input - Input string
   * @param {Object} result - Validation result object
   */
  checkBlockedPatterns(input, result) {
    this.blockedPatterns.forEach((pattern, index) => {
      if (pattern.test(input)) {
        result.isValid = false;
        result.errors.push(`Blocked pattern detected: ${pattern.source}`);
        result.metadata.patternsDetected.push(`blocked-${index}`);
      }
    });
  }

  /**
   * Check for suspicious content
   * @param {string} input - Input string
   * @param {Object} result - Validation result object
   */
  checkSuspiciousContent(input, result) {
    this.suspiciousPatterns.forEach((pattern, index) => {
      if (pattern.test(input)) {
        result.warnings.push(`Suspicious content detected: ${pattern.source}`);
        result.metadata.patternsDetected.push(`suspicious-${index}`);
        result.metadata.suspiciousContent = true;
      }
    });
  }

  /**
   * Validate input length
   * @param {string} input - Input string
   * @param {Object} options - Validation options
   * @param {Object} result - Validation result object
   */
  validateLength(input, options, result) {
    const maxLength = options.maxLength || this.maxInputLength;
    
    if (input.length > maxLength) {
      result.isValid = false;
      result.errors.push(`Input too long (max ${maxLength} characters)`);
    }
  }

  /**
   * Validate encoding
   * @param {string} input - Input string
   * @param {Object} result - Validation result object
   */
  validateEncoding(input, result) {
    try {
      // Check if string is valid UTF-8
      const encoded = encodeURIComponent(input);
      const decoded = decodeURIComponent(encoded);
      
      if (decoded !== input) {
        result.warnings.push('Input contains invalid UTF-8 characters');
      }
    } catch (error) {
      result.warnings.push('Input encoding validation failed');
    }
  }

  /**
   * Validate message structure
   * @param {Object} message - Message object
   * @param {Object} result - Validation result object
   */
  validateMessageStructure(message, result) {
    if (!message || typeof message !== 'object') {
      result.isValid = false;
      result.errors.push('Message must be an object');
      return;
    }

    if (!message.role) {
      result.isValid = false;
      result.errors.push('Message role is required');
    }

    if (!message.content) {
      result.isValid = false;
      result.errors.push('Message content is required');
    }
  }

  /**
   * Validate message role
   * @param {string} role - Message role
   * @param {Object} result - Validation result object
   */
  validateRole(role, result) {
    if (!role || typeof role !== 'string') {
      result.isValid = false;
      result.errors.push('Role must be a non-empty string');
      return;
    }

    if (!this.allowedRoles.includes(role)) {
      result.isValid = false;
      result.errors.push(`Invalid role. Must be one of: ${this.allowedRoles.join(', ')}`);
    }
  }

  /**
   * Validate metadata object
   * @param {Object} metadata - Metadata object
   * @param {Object} result - Validation result object
   */
  validateMetadata(metadata, result) {
    if (typeof metadata !== 'object' || Array.isArray(metadata)) {
      result.isValid = false;
      result.errors.push('Metadata must be an object');
      return;
    }

    // Check for dangerous metadata
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    dangerousKeys.forEach(key => {
      if (key in metadata) {
        result.warnings.push(`Potentially dangerous metadata key: ${key}`);
      }
    });
  }

  /**
   * Validate filter value
   * @param {string} key - Filter key
   * @param {*} value - Filter value
   * @returns {Object} Validation result
   */
  validateFilterValue(key, value) {
    const result = {
      isValid: true,
      sanitizedValue: value,
      errors: [],
      warnings: []
    };

    // Validate based on key type
    switch (key) {
      case 'page':
      case 'limit':
        if (typeof value !== 'number' || value < 0) {
          result.isValid = false;
          result.errors.push(`${key} must be a non-negative number`);
        } else {
          result.sanitizedValue = Math.floor(value);
        }
        break;

      case 'search':
      case 'category':
      case 'status':
        if (typeof value !== 'string') {
          result.isValid = false;
          result.errors.push(`${key} must be a string`);
        } else {
          result.sanitizedValue = this.sanitizeInput(value, { maxLength: 100 });
        }
        break;

      case 'sortBy':
        const allowedSortFields = ['lastActivity', 'name', 'healthScore', 'completionPercentage'];
        if (!allowedSortFields.includes(value)) {
          result.isValid = false;
          result.errors.push(`Invalid sort field: ${value}`);
        } else {
          result.sanitizedValue = value;
        }
        break;

      default:
        // Generic validation for unknown keys
        if (typeof value === 'string') {
          result.sanitizedValue = this.sanitizeInput(value, { maxLength: 200 });
        }
        break;
    }

    return result;
  }

  /**
   * Validate AI service options
   * @param {Object} options - AI service options
   * @returns {Object} Validation result
   */
  validateAIOptions(options) {
    const result = {
      isValid: true,
      sanitizedOptions: {},
      errors: [],
      warnings: []
    };

    if (!options || typeof options !== 'object') {
      result.isValid = false;
      result.errors.push('Options must be an object');
      return result;
    }

    // Validate maxTokens
    if (options.maxTokens !== undefined) {
      if (typeof options.maxTokens !== 'number' || options.maxTokens < 1 || options.maxTokens > 4000) {
        result.isValid = false;
        result.errors.push('maxTokens must be a number between 1 and 4000');
      } else {
        result.sanitizedOptions.maxTokens = Math.floor(options.maxTokens);
      }
    }

    // Validate temperature
    if (options.temperature !== undefined) {
      if (typeof options.temperature !== 'number' || options.temperature < 0 || options.temperature > 2) {
        result.isValid = false;
        result.errors.push('temperature must be a number between 0 and 2');
      } else {
        result.sanitizedOptions.temperature = Math.round(options.temperature * 100) / 100;
      }
    }

    // Validate model
    if (options.model !== undefined) {
      if (typeof options.model !== 'string' || options.model.length === 0) {
        result.isValid = false;
        result.errors.push('model must be a non-empty string');
      } else {
        result.sanitizedOptions.model = this.sanitizeInput(options.model, { maxLength: 50 });
      }
    }

    // Validate stream
    if (options.stream !== undefined) {
      if (typeof options.stream !== 'boolean') {
        result.isValid = false;
        result.errors.push('stream must be a boolean');
      } else {
        result.sanitizedOptions.stream = options.stream;
      }
    }

    return result;
  }

  /**
   * Get validation statistics
   * @returns {Object} Validation statistics
   */
  getValidationStats() {
    return {
      maxInputLength: this.maxInputLength,
      maxMessageLength: this.maxMessageLength,
      maxSessionIdLength: this.maxSessionIdLength,
      allowedRoles: this.allowedRoles,
      blockedPatternsCount: this.blockedPatterns.length,
      suspiciousPatternsCount: this.suspiciousPatterns.length
    };
  }

  /**
   * Add custom blocked pattern
   * @param {RegExp} pattern - Pattern to block
   */
  addBlockedPattern(pattern) {
    if (pattern instanceof RegExp) {
      this.blockedPatterns.push(pattern);
    }
  }

  /**
   * Add custom suspicious pattern
   * @param {RegExp} pattern - Pattern to flag as suspicious
   */
  addSuspiciousPattern(pattern) {
    if (pattern instanceof RegExp) {
      this.suspiciousPatterns.push(pattern);
    }
  }

  /**
   * Remove blocked pattern
   * @param {RegExp} pattern - Pattern to remove
   */
  removeBlockedPattern(pattern) {
    const index = this.blockedPatterns.indexOf(pattern);
    if (index > -1) {
      this.blockedPatterns.splice(index, 1);
    }
  }

  /**
   * Remove suspicious pattern
   * @param {RegExp} pattern - Pattern to remove
   */
  removeSuspiciousPattern(pattern) {
    const index = this.suspiciousPatterns.indexOf(pattern);
    if (index > -1) {
      this.suspiciousPatterns.splice(index, 1);
    }
  }
}

module.exports = AIInputValidator;
