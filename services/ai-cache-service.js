/**
 * AI Cache Service for Epic 10
 * Specialized caching for AI context and responses
 */

class AICacheService {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000; // 5 minutes
    this.cleanupInterval = options.cleanupInterval || 60 * 1000; // 1 minute
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      size: 0
    };
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Get cached data
   * @param {string} key - Cache key
   * @returns {Object|null} Cached data or null
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (this.isExpired(item)) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      return null;
    }

    // Update access time
    item.lastAccessed = Date.now();
    this.stats.hits++;
    
    return item.data;
  }

  /**
   * Set cached data
   * @param {string} key - Cache key
   * @param {Object} data - Data to cache
   * @param {Object} options - Cache options
   */
  set(key, data, options = {}) {
    const ttl = options.ttl || this.defaultTTL;
    const priority = options.priority || 'normal';
    const tags = options.tags || [];
    
    // Check if we need to evict
    if (this.cache.size >= this.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    const item = {
      data,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      ttl,
      priority,
      tags,
      accessCount: 0
    };

    this.cache.set(key, item);
    this.stats.sets++;
    this.stats.size = this.cache.size;
  }

  /**
   * Delete cached data
   * @param {string} key - Cache key
   * @returns {boolean} True if deleted
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
      this.stats.size = this.cache.size;
    }
    return deleted;
  }

  /**
   * Clear all cached data
   */
  clear() {
    this.cache.clear();
    this.stats.size = 0;
    console.log('🧹 Cleared all AI cache');
  }

  /**
   * Check if item is expired
   * @param {Object} item - Cache item
   * @returns {boolean} True if expired
   */
  isExpired(item) {
    const age = Date.now() - item.createdAt;
    return age > item.ttl;
  }

  /**
   * Evict least recently used item
   */
  evictLeastRecentlyUsed() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      this.stats.size = this.cache.size;
    }
  }

  /**
   * Evict by priority (lowest priority first)
   */
  evictByPriority() {
    const priorityOrder = { low: 0, normal: 1, high: 2 };
    const items = Array.from(this.cache.entries())
      .sort((a, b) => priorityOrder[a[1].priority] - priorityOrder[b[1].priority]);

    if (items.length > 0) {
      const [key] = items[0];
      this.cache.delete(key);
      this.stats.evictions++;
      this.stats.size = this.cache.size;
    }
  }

  /**
   * Evict by tags
   * @param {Array} tags - Tags to evict
   */
  evictByTags(tags) {
    const keysToDelete = [];
    
    for (const [key, item] of this.cache.entries()) {
      if (tags.some(tag => item.tags.includes(tag))) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.stats.evictions++;
    });

    this.stats.size = this.cache.size;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
      : 0;

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      maxSize: this.maxSize,
      utilization: (this.cache.size / this.maxSize) * 100
    };
  }

  /**
   * Get cache keys by pattern
   * @param {string} pattern - Pattern to match
   * @returns {Array} Matching keys
   */
  getKeysByPattern(pattern) {
    const regex = new RegExp(pattern);
    return Array.from(this.cache.keys()).filter(key => regex.test(key));
  }

  /**
   * Get cache keys by tags
   * @param {Array} tags - Tags to match
   * @returns {Array} Matching keys
   */
  getKeysByTags(tags) {
    const matchingKeys = [];
    
    for (const [key, item] of this.cache.entries()) {
      if (tags.some(tag => item.tags.includes(tag))) {
        matchingKeys.push(key);
      }
    }

    return matchingKeys;
  }

  /**
   * Warm cache with data
   * @param {Object} data - Data to warm cache with
   * @param {Object} options - Warming options
   */
  warmCache(data, options = {}) {
    const prefix = options.prefix || 'warm';
    const ttl = options.ttl || this.defaultTTL;
    const priority = options.priority || 'high';

    Object.entries(data).forEach(([key, value]) => {
      const cacheKey = `${prefix}:${key}`;
      this.set(cacheKey, value, { ttl, priority });
    });

    console.log(`🔥 Warmed cache with ${Object.keys(data).length} items`);
  }

  /**
   * Preload context data
   * @param {string} projectName - Project name
   * @param {Function} contextLoader - Function to load context
   */
  async preloadContext(projectName, contextLoader) {
    try {
      const context = await contextLoader(projectName);
      const key = `context:project:${projectName}`;
      this.set(key, context, { 
        ttl: 2 * 60 * 1000, // 2 minutes
        priority: 'high',
        tags: ['context', 'project', projectName]
      });
      console.log(`📦 Preloaded context for project: ${projectName}`);
    } catch (error) {
      console.error(`❌ Failed to preload context for ${projectName}:`, error);
    }
  }

  /**
   * Clean up expired items
   */
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (this.isExpired(item)) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    this.stats.evictions += cleanedCount;
    this.stats.size = this.cache.size;

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired cache items`);
    }
  }

  /**
   * Start cleanup interval
   */
  startCleanupInterval() {
    setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Get cache item metadata
   * @param {string} key - Cache key
   * @returns {Object|null} Item metadata
   */
  getItemMetadata(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    return {
      key,
      createdAt: item.createdAt,
      lastAccessed: item.lastAccessed,
      ttl: item.ttl,
      priority: item.priority,
      tags: item.tags,
      accessCount: item.accessCount,
      age: Date.now() - item.createdAt,
      expiresAt: item.createdAt + item.ttl,
      isExpired: this.isExpired(item)
    };
  }

  /**
   * Get all cache metadata
   * @returns {Array} All items metadata
   */
  getAllMetadata() {
    return Array.from(this.cache.keys()).map(key => this.getItemMetadata(key));
  }

  /**
   * Export cache data
   * @param {Array} keys - Keys to export (optional)
   * @returns {Object} Exported cache data
   */
  exportCache(keys = null) {
    const exportData = {};
    const keysToExport = keys || Array.from(this.cache.keys());

    keysToExport.forEach(key => {
      const item = this.cache.get(key);
      if (item && !this.isExpired(item)) {
        exportData[key] = {
          data: item.data,
          metadata: this.getItemMetadata(key)
        };
      }
    });

    return exportData;
  }

  /**
   * Import cache data
   * @param {Object} cacheData - Cache data to import
   * @param {Object} options - Import options
   */
  importCache(cacheData, options = {}) {
    const overwrite = options.overwrite || false;
    let importedCount = 0;

    Object.entries(cacheData).forEach(([key, item]) => {
      if (overwrite || !this.cache.has(key)) {
        this.cache.set(key, {
          data: item.data,
          createdAt: item.metadata?.createdAt || Date.now(),
          lastAccessed: item.metadata?.lastAccessed || Date.now(),
          ttl: item.metadata?.ttl || this.defaultTTL,
          priority: item.metadata?.priority || 'normal',
          tags: item.metadata?.tags || [],
          accessCount: item.metadata?.accessCount || 0
        });
        importedCount++;
      }
    });

    this.stats.size = this.cache.size;
    console.log(`📥 Imported ${importedCount} cache items`);
  }

  /**
   * Get memory usage estimate
   * @returns {Object} Memory usage information
   */
  getMemoryUsage() {
    let totalSize = 0;
    let itemCount = 0;

    for (const [key, item] of this.cache.entries()) {
      totalSize += JSON.stringify({ key, data: item.data }).length;
      itemCount++;
    }

    return {
      itemCount,
      estimatedSize: totalSize,
      averageItemSize: itemCount > 0 ? Math.round(totalSize / itemCount) : 0,
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Optimize cache (remove low-value items)
   */
  optimize() {
    const items = Array.from(this.cache.entries())
      .map(([key, item]) => ({
        key,
        item,
        score: this.calculateItemScore(item)
      }))
      .sort((a, b) => a.score - b.score);

    // Remove bottom 10% of items
    const removeCount = Math.floor(items.length * 0.1);
    for (let i = 0; i < removeCount; i++) {
      this.cache.delete(items[i].key);
      this.stats.evictions++;
    }

    this.stats.size = this.cache.size;
    console.log(`⚡ Optimized cache, removed ${removeCount} low-value items`);
  }

  /**
   * Calculate item score for optimization
   * @param {Object} item - Cache item
   * @returns {number} Item score
   */
  calculateItemScore(item) {
    const age = Date.now() - item.createdAt;
    const accessFrequency = item.accessCount / (age / 1000); // accesses per second
    const priorityScore = { low: 0, normal: 1, high: 2 }[item.priority] || 1;
    
    return accessFrequency * priorityScore - (age / 1000 / 60); // older items score lower
  }
}

module.exports = AICacheService;
