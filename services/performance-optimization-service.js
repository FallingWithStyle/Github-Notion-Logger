/**
 * Performance Optimization Service for Epic 9
 * Handles caching, pagination, and performance optimizations
 */

class PerformanceOptimizationService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.maxCacheSize = 1000; // Maximum number of cache entries
    this.performanceMetrics = new Map();
  }

  /**
   * Get cached data with timeout check
   * @param {string} key - Cache key
   * @returns {Object|null} Cached data or null if expired/missing
   */
  getCachedData(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      this.updateAccessMetrics(key);
      return cached.data;
    }
    
    if (cached) {
      this.cache.delete(key); // Remove expired entry
    }
    
    return null;
  }

  /**
   * Set cached data with size management
   * @param {string} key - Cache key
   * @param {Object} data - Data to cache
   * @param {number} customTimeout - Custom timeout in milliseconds
   */
  setCachedData(key, data, customTimeout = null) {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldestEntries();
    }

    this.cache.set(key, {
      data: data,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now()
    });
  }

  /**
   * Evict oldest cache entries (LRU-like behavior)
   */
  evictOldestEntries() {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    // Remove oldest 20% of entries
    const toRemove = Math.ceil(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Update access metrics for cache entry
   * @param {string} key - Cache key
   */
  updateAccessMetrics(key) {
    const cached = this.cache.get(key);
    if (cached) {
      cached.accessCount++;
      cached.lastAccessed = Date.now();
    }
  }

  /**
   * Create paginated response
   * @param {Array} data - Full dataset
   * @param {number} page - Page number (1-based)
   * @param {number} limit - Items per page
   * @param {Object} additionalMetadata - Additional metadata to include
   * @returns {Object} Paginated response
   */
  createPaginatedResponse(data, page, limit, additionalMetadata = {}) {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);
    
    return {
      data: paginatedData,
      pagination: {
        page: page,
        limit: limit,
        total: data.length,
        totalPages: Math.ceil(data.length / limit),
        hasNext: endIndex < data.length,
        hasPrev: page > 1,
        startIndex: startIndex,
        endIndex: Math.min(endIndex, data.length)
      },
      ...additionalMetadata
    };
  }

  /**
   * Optimize database queries with batching
   * @param {Array} items - Items to process
   * @param {Function} processor - Processing function
   * @param {number} batchSize - Batch size
   * @returns {Promise<Array>} Processed results
   */
  async batchProcess(items, processor, batchSize = 10) {
    const results = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(item => processor(item))
      );
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Debounce function calls
   * @param {Function} func - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Debounced function
   */
  debounce(func, delay) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * Throttle function calls
   * @param {Function} func - Function to throttle
   * @param {number} limit - Calls per time window
   * @param {number} window - Time window in milliseconds
   * @returns {Function} Throttled function
   */
  throttle(func, limit, window = 1000) {
    let inThrottle;
    let lastFunc;
    let lastRan;
    
    return (...args) => {
      if (!inThrottle) {
        func.apply(this, args);
        lastRan = Date.now();
        inThrottle = true;
      } else {
        clearTimeout(lastFunc);
        lastFunc = setTimeout(() => {
          if ((Date.now() - lastRan) >= window) {
            func.apply(this, args);
            lastRan = Date.now();
          }
        }, window - (Date.now() - lastRan));
      }
    };
  }

  /**
   * Optimize data aggregation
   * @param {Array} data - Data to aggregate
   * @param {Object} aggregationConfig - Aggregation configuration
   * @returns {Object} Aggregated data
   */
  optimizeDataAggregation(data, aggregationConfig) {
    const startTime = Date.now();
    
    const aggregated = {
      total: data.length,
      groups: {},
      metrics: {}
    };

    // Group data by specified fields
    if (aggregationConfig.groupBy) {
      data.forEach(item => {
        const groupKey = aggregationConfig.groupBy.map(field => item[field]).join('|');
        if (!aggregated.groups[groupKey]) {
          aggregated.groups[groupKey] = [];
        }
        aggregated.groups[groupKey].push(item);
      });
    }

    // Calculate metrics
    if (aggregationConfig.metrics) {
      aggregationConfig.metrics.forEach(metric => {
        switch (metric.type) {
          case 'sum':
            aggregated.metrics[metric.field] = data.reduce((sum, item) => sum + (item[metric.field] || 0), 0);
            break;
          case 'average':
            const sum = data.reduce((sum, item) => sum + (item[metric.field] || 0), 0);
            aggregated.metrics[metric.field] = data.length > 0 ? sum / data.length : 0;
            break;
          case 'count':
            aggregated.metrics[metric.field] = data.filter(item => item[metric.field]).length;
            break;
          case 'min':
            aggregated.metrics[metric.field] = Math.min(...data.map(item => item[metric.field] || Infinity));
            break;
          case 'max':
            aggregated.metrics[metric.field] = Math.max(...data.map(item => item[metric.field] || -Infinity));
            break;
        }
      });
    }

    const processingTime = Date.now() - startTime;
    this.recordPerformanceMetric('dataAggregation', processingTime, data.length);

    return {
      ...aggregated,
      processingTime: processingTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Optimize sorting with performance tracking
   * @param {Array} data - Data to sort
   * @param {string} sortBy - Field to sort by
   * @param {string} direction - Sort direction ('asc' or 'desc')
   * @returns {Array} Sorted data
   */
  optimizeSorting(data, sortBy, direction = 'asc') {
    const startTime = Date.now();
    
    const sorted = [...data].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      
      if (aVal === bVal) return 0;
      
      const comparison = aVal < bVal ? -1 : 1;
      return direction === 'desc' ? -comparison : comparison;
    });

    const processingTime = Date.now() - startTime;
    this.recordPerformanceMetric('sorting', processingTime, data.length);

    return sorted;
  }

  /**
   * Optimize filtering with performance tracking
   * @param {Array} data - Data to filter
   * @param {Object} filters - Filter criteria
   * @returns {Array} Filtered data
   */
  optimizeFiltering(data, filters) {
    const startTime = Date.now();
    
    let filtered = [...data];

    Object.entries(filters).forEach(([field, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        filtered = filtered.filter(item => {
          const itemValue = item[field];
          
          if (typeof value === 'string' && typeof itemValue === 'string') {
            return itemValue.toLowerCase().includes(value.toLowerCase());
          }
          
          if (typeof value === 'number' && typeof itemValue === 'number') {
            return itemValue === value;
          }
          
          if (Array.isArray(value)) {
            return value.includes(itemValue);
          }
          
          return itemValue === value;
        });
      }
    });

    const processingTime = Date.now() - startTime;
    this.recordPerformanceMetric('filtering', processingTime, data.length);

    return filtered;
  }

  /**
   * Record performance metrics
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {number} dataSize - Size of data processed
   */
  recordPerformanceMetric(operation, duration, dataSize) {
    const key = `${operation}_${Date.now()}`;
    this.performanceMetrics.set(key, {
      operation,
      duration,
      dataSize,
      timestamp: new Date(),
      throughput: dataSize / (duration / 1000) // items per second
    });

    // Keep only last 1000 metrics
    if (this.performanceMetrics.size > 1000) {
      const firstKey = this.performanceMetrics.keys().next().value;
      this.performanceMetrics.delete(firstKey);
    }
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance statistics
   */
  getPerformanceStatistics() {
    const metrics = Array.from(this.performanceMetrics.values());
    
    if (metrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        averageThroughput: 0,
        operations: {}
      };
    }

    const operations = {};
    metrics.forEach(metric => {
      if (!operations[metric.operation]) {
        operations[metric.operation] = {
          count: 0,
          totalDuration: 0,
          totalDataSize: 0,
          averageDuration: 0,
          averageThroughput: 0
        };
      }
      
      operations[metric.operation].count++;
      operations[metric.operation].totalDuration += metric.duration;
      operations[metric.operation].totalDataSize += metric.dataSize;
    });

    // Calculate averages
    Object.values(operations).forEach(op => {
      op.averageDuration = op.totalDuration / op.count;
      op.averageThroughput = op.totalDataSize / (op.totalDuration / 1000);
    });

    const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
    const totalDataSize = metrics.reduce((sum, m) => sum + m.dataSize, 0);

    return {
      totalOperations: metrics.length,
      averageDuration: totalDuration / metrics.length,
      averageThroughput: totalDataSize / (totalDuration / 1000),
      operations: operations,
      cacheStats: {
        size: this.cache.size,
        maxSize: this.maxCacheSize,
        hitRate: this.calculateCacheHitRate()
      }
    };
  }

  /**
   * Calculate cache hit rate
   * @returns {number} Cache hit rate percentage
   */
  calculateCacheHitRate() {
    const entries = Array.from(this.cache.values());
    const totalAccesses = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
    const cacheHits = entries.length;
    
    return totalAccesses > 0 ? (cacheHits / totalAccesses) * 100 : 0;
  }

  /**
   * Clear all caches
   */
  clearAllCaches() {
    this.cache.clear();
    this.performanceMetrics.clear();
    console.log('🗑️ All performance caches cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStatistics() {
    const entries = Array.from(this.cache.values());
    const now = Date.now();
    
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      timeout: this.cacheTimeout,
      expiredEntries: entries.filter(entry => now - entry.timestamp >= this.cacheTimeout).length,
      averageAccessCount: entries.length > 0 ? 
        entries.reduce((sum, entry) => sum + entry.accessCount, 0) / entries.length : 0,
      hitRate: this.calculateCacheHitRate()
    };
  }

  /**
   * Warm up cache with frequently accessed data
   * @param {Function} dataProvider - Function that provides data
   * @param {Array} keys - Cache keys to warm up
   */
  async warmUpCache(dataProvider, keys) {
    console.log(`🔥 Warming up cache with ${keys.length} keys...`);
    
    const warmUpPromises = keys.map(async key => {
      try {
        const data = await dataProvider(key);
        this.setCachedData(key, data);
      } catch (error) {
        console.warn(`⚠️ Failed to warm up cache for key ${key}:`, error.message);
      }
    });

    await Promise.all(warmUpPromises);
    console.log(`✅ Cache warm-up completed`);
  }
}

module.exports = PerformanceOptimizationService;
