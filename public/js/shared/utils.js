/**
 * Shared JavaScript Utilities
 * 
 * This module provides common utility functions used across the application.
 * All functions are designed to be pure and reusable.
 */

export const Utils = {
  /**
   * Debounce function to limit the rate of function execution
   * @param {Function} func - Function to debounce
   * @param {number} wait - Delay in milliseconds
   * @returns {Function} Debounced function
   */
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Show or hide loading indicator
   * @param {boolean} show - Whether to show loading
   */
  showLoading: (show = true) => {
    const loading = document.getElementById('loading');
    if (loading) {
      loading.style.display = show ? 'block' : 'none';
    }
  },

  /**
   * Show error message
   * @param {string} message - Error message to display
   */
  showError: (message) => {
    const error = document.getElementById('error');
    if (error) {
      error.textContent = message;
      error.style.display = 'block';
    }
  },

  /**
   * Hide error message
   */
  hideError: () => {
    const error = document.getElementById('error');
    if (error) {
      error.style.display = 'none';
    }
  },

  /**
   * Update status message
   * @param {string} message - Status message
   * @param {string} type - Status type (success, error, warning)
   */
  updateStatus: (message, type = '') => {
    const status = document.getElementById('status');
    if (status) {
      status.textContent = message;
      status.className = `status ${type}`;
    }
  },

  /**
   * Format date for display
   * @param {string|Date} date - Date to format
   * @returns {string} Formatted date string
   */
  formatDate: (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  /**
   * Format number with commas
   * @param {number} num - Number to format
   * @returns {string} Formatted number string
   */
  formatNumber: (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  },

  /**
   * Format percentage
   * @param {number} value - Value to format as percentage
   * @param {number} decimals - Number of decimal places
   * @returns {string} Formatted percentage string
   */
  formatPercentage: (value, decimals = 1) => {
    return `${value.toFixed(decimals)}%`;
  },

  /**
   * Get health badge class based on health score
   * @param {number} score - Health score (0-100)
   * @returns {string} CSS class for health badge
   */
  getHealthClass: (score) => {
    if (score >= 90) return 'health-excellent';
    if (score >= 75) return 'health-good';
    if (score >= 50) return 'health-fair';
    if (score >= 25) return 'health-poor';
    return 'health-critical';
  },

  /**
   * Get health label based on health score
   * @param {number} score - Health score (0-100)
   * @returns {string} Human-readable health label
   */
  getHealthLabel: (score) => {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 50) return 'Fair';
    if (score >= 25) return 'Poor';
    return 'Critical';
  },

  /**
   * Calculate time ago string
   * @param {string|Date} date - Date to calculate from
   * @returns {string} Time ago string
   */
  timeAgo: (date) => {
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now - past) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
    return `${Math.floor(diffInSeconds / 31536000)}y ago`;
  },

  /**
   * Generate unique ID
   * @returns {string} Unique identifier
   */
  generateId: () => {
    return Math.random().toString(36).substr(2, 9);
  },

  /**
   * Deep clone an object
   * @param {any} obj - Object to clone
   * @returns {any} Cloned object
   */
  deepClone: (obj) => {
    return JSON.parse(JSON.stringify(obj));
  },

  /**
   * Check if element is in viewport
   * @param {Element} element - Element to check
   * @returns {boolean} Whether element is in viewport
   */
  isInViewport: (element) => {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  },

  /**
   * Smooth scroll to element
   * @param {string|Element} target - Element or selector to scroll to
   * @param {number} offset - Offset from top
   */
  scrollTo: (target, offset = 0) => {
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    if (element) {
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  },

  /**
   * Local storage helpers
   */
  storage: {
    get: (key, defaultValue = null) => {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch (error) {
        console.error('Error reading from localStorage:', error);
        return defaultValue;
      }
    },
    
    set: (key, value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        console.error('Error writing to localStorage:', error);
        return false;
      }
    },
    
    remove: (key) => {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.error('Error removing from localStorage:', error);
        return false;
      }
    }
  },

  /**
   * API helpers
   */
  api: {
    /**
     * Make API request with error handling
     * @param {string} url - API endpoint
     * @param {Object} options - Fetch options
     * @returns {Promise} API response
     */
    request: async (url, options = {}) => {
      try {
        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          },
          ...options
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('API request failed:', error);
        throw error;
      }
    },
    
    /**
     * GET request helper
     * @param {string} url - API endpoint
     * @returns {Promise} API response
     */
    get: (url) => Utils.api.request(url),
    
    /**
     * POST request helper
     * @param {string} url - API endpoint
     * @param {Object} data - Request data
     * @returns {Promise} API response
     */
    post: (url, data) => Utils.api.request(url, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    
    /**
     * PUT request helper
     * @param {string} url - API endpoint
     * @param {Object} data - Request data
     * @returns {Promise} API response
     */
    put: (url, data) => Utils.api.request(url, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    
    /**
     * DELETE request helper
     * @param {string} url - API endpoint
     * @returns {Promise} API response
     */
    delete: (url) => Utils.api.request(url, {
      method: 'DELETE'
    })
  },

  /**
   * Event handling helpers
   */
  events: {
    /**
     * Add event listener with automatic cleanup
     * @param {Element} element - Element to attach listener to
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     * @param {Object} options - Event options
     * @returns {Function} Cleanup function
     */
    on: (element, event, handler, options = {}) => {
      element.addEventListener(event, handler, options);
      return () => element.removeEventListener(event, handler, options);
    },
    
    /**
     * Add multiple event listeners
     * @param {Element} element - Element to attach listeners to
     * @param {Object} events - Event handlers object
     * @returns {Function} Cleanup function
     */
    onMultiple: (element, events) => {
      const cleanupFunctions = Object.entries(events).map(([event, handler]) =>
        Utils.events.on(element, event, handler)
      );
      return () => cleanupFunctions.forEach(cleanup => cleanup());
    }
  }
};

// Export for both ES6 modules and CommonJS
export default Utils;
