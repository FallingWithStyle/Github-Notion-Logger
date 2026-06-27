/**
 * AI Monitoring Service for Epic 10
 * Health checks, metrics, and monitoring for AI services
 */

const { AIServiceHealthModel } = require('../models/ai-models');

class AIMonitoringService {
  constructor() {
    this.healthChecks = new Map();
    this.metrics = new Map();
    this.alerts = [];
    this.monitoringInterval = 30000; // 30 seconds
    this.alertThresholds = {
      responseTime: 5000, // 5 seconds
      errorRate: 0.1, // 10%
      successRate: 0.8, // 80%
      uptime: 0.95 // 95%
    };
    this.isMonitoring = false;
    this.startTime = Date.now();
  }

  /**
   * Register a service for monitoring
   * @param {string} serviceName - Name of the service
   * @param {Function} healthCheckFunction - Function to check service health
   * @param {Object} options - Monitoring options
   */
  registerService(serviceName, healthCheckFunction, options = {}) {
    const config = {
      name: serviceName,
      healthCheck: healthCheckFunction,
      interval: options.interval || 30000,
      timeout: options.timeout || 10000,
      retries: options.retries || 3,
      enabled: options.enabled !== false,
      lastCheck: null,
      consecutiveFailures: 0,
      lastSuccess: null
    };

    this.healthChecks.set(serviceName, config);
    this.metrics.set(serviceName, {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      averageResponseTime: 0,
      lastResponseTime: 0,
      uptime: 100,
      errorRate: 0
    });

    console.log(`🔍 Registered monitoring for service: ${serviceName}`);
  }

  /**
   * Start monitoring all registered services
   */
  startMonitoring() {
    if (this.isMonitoring) {
      console.log('⚠️ Monitoring already started');
      return;
    }

    this.isMonitoring = true;
    console.log('🚀 Starting AI service monitoring');

    // Start monitoring interval
    this.monitoringIntervalId = setInterval(() => {
      this.performHealthChecks();
    }, this.monitoringInterval);

    // Start metrics collection
    this.metricsIntervalId = setInterval(() => {
      this.collectMetrics();
    }, 60000); // Collect metrics every minute
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringIntervalId) {
      clearInterval(this.monitoringIntervalId);
    }
    
    if (this.metricsIntervalId) {
      clearInterval(this.metricsIntervalId);
    }

    console.log('🛑 Stopped AI service monitoring');
  }

  /**
   * Perform health checks for all services
   */
  async performHealthChecks() {
    const checkPromises = Array.from(this.healthChecks.entries())
      .filter(([name, config]) => config.enabled)
      .map(([name, config]) => this.checkServiceHealth(name, config));

    await Promise.allSettled(checkPromises);
  }

  /**
   * Check health of a specific service
   * @param {string} serviceName - Name of the service
   * @param {Object} config - Service configuration
   */
  async checkServiceHealth(serviceName, config) {
    const startTime = Date.now();
    let success = false;
    let error = null;

    try {
      // Perform health check with timeout
      const result = await this.executeWithTimeout(
        config.healthCheck(),
        config.timeout
      );

      success = true;
      config.consecutiveFailures = 0;
      config.lastSuccess = new Date();

    } catch (err) {
      error = err;
      config.consecutiveFailures++;
    }

    const responseTime = Date.now() - startTime;
    config.lastCheck = new Date();

    // Update metrics
    this.updateServiceMetrics(serviceName, success, responseTime, error);

    // Check for alerts
    this.checkAlerts(serviceName, success, responseTime);

    // Log result
    if (success) {
      console.log(`✅ Health check passed for ${serviceName} (${responseTime}ms)`);
    } else {
      console.error(`❌ Health check failed for ${serviceName}: ${error?.message}`);
    }
  }

  /**
   * Execute function with timeout
   * @param {Promise} promise - Promise to execute
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise} Result or timeout error
   */
  async executeWithTimeout(promise, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Health check timeout'));
      }, timeout);

      promise
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
   * Update service metrics
   * @param {string} serviceName - Name of the service
   * @param {boolean} success - Whether check was successful
   * @param {number} responseTime - Response time in milliseconds
   * @param {Error} error - Error if any
   */
  updateServiceMetrics(serviceName, success, responseTime, error) {
    const metrics = this.metrics.get(serviceName);
    if (!metrics) return;

    metrics.totalChecks++;
    metrics.lastResponseTime = responseTime;

    if (success) {
      metrics.successfulChecks++;
    } else {
      metrics.failedChecks++;
    }

    // Update average response time
    const totalResponseTime = metrics.averageResponseTime * (metrics.totalChecks - 1) + responseTime;
    metrics.averageResponseTime = totalResponseTime / metrics.totalChecks;

    // Update success rate
    metrics.successRate = metrics.successfulChecks / metrics.totalChecks;

    // Update error rate
    metrics.errorRate = metrics.failedChecks / metrics.totalChecks;

    // Update uptime
    const uptimeMs = Date.now() - this.startTime;
    const downtimeMs = metrics.failedChecks * 30000; // Assume 30s downtime per failure
    metrics.uptime = Math.max(0, (uptimeMs - downtimeMs) / uptimeMs) * 100;
  }

  /**
   * Check for alert conditions
   * @param {string} serviceName - Name of the service
   * @param {boolean} success - Whether check was successful
   * @param {number} responseTime - Response time in milliseconds
   */
  checkAlerts(serviceName, success, responseTime) {
    const metrics = this.metrics.get(serviceName);
    if (!metrics) return;

    const alerts = [];

    // Response time alert
    if (responseTime > this.alertThresholds.responseTime) {
      alerts.push({
        type: 'high_response_time',
        service: serviceName,
        value: responseTime,
        threshold: this.alertThresholds.responseTime,
        message: `High response time: ${responseTime}ms > ${this.alertThresholds.responseTime}ms`
      });
    }

    // Error rate alert
    if (metrics.errorRate > this.alertThresholds.errorRate) {
      alerts.push({
        type: 'high_error_rate',
        service: serviceName,
        value: metrics.errorRate,
        threshold: this.alertThresholds.errorRate,
        message: `High error rate: ${(metrics.errorRate * 100).toFixed(1)}% > ${(this.alertThresholds.errorRate * 100)}%`
      });
    }

    // Success rate alert
    if (metrics.successRate < this.alertThresholds.successRate) {
      alerts.push({
        type: 'low_success_rate',
        service: serviceName,
        value: metrics.successRate,
        threshold: this.alertThresholds.successRate,
        message: `Low success rate: ${(metrics.successRate * 100).toFixed(1)}% < ${(this.alertThresholds.successRate * 100)}%`
      });
    }

    // Uptime alert
    if (metrics.uptime < this.alertThresholds.uptime * 100) {
      alerts.push({
        type: 'low_uptime',
        service: serviceName,
        value: metrics.uptime,
        threshold: this.alertThresholds.uptime * 100,
        message: `Low uptime: ${metrics.uptime.toFixed(1)}% < ${this.alertThresholds.uptime * 100}%`
      });
    }

    // Add alerts
    alerts.forEach(alert => {
      alert.timestamp = new Date().toISOString();
      this.alerts.push(alert);
      console.warn(`🚨 Alert: ${alert.message}`);
    });
  }

  /**
   * Collect additional metrics
   */
  collectMetrics() {
    // Collect system metrics
    const systemMetrics = {
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };

    // Store system metrics
    this.metrics.set('system', systemMetrics);
  }

  /**
   * Get health status of a service
   * @param {string} serviceName - Name of the service
   * @returns {Object} Health status
   */
  getServiceHealth(serviceName) {
    const config = this.healthChecks.get(serviceName);
    const metrics = this.metrics.get(serviceName);

    if (!config || !metrics) {
      return {
        serviceName,
        status: 'unknown',
        error: 'Service not found'
      };
    }

    const healthModel = new AIServiceHealthModel({
      serviceName,
      status: this.determineHealthStatus(metrics),
      uptime: metrics.uptime,
      responseTime: metrics.averageResponseTime,
      successRate: metrics.successRate,
      errorRate: metrics.errorRate,
      lastCheck: config.lastCheck,
      circuitBreakerState: 'CLOSED', // Would come from circuit breaker
      metadata: {
        totalChecks: metrics.totalChecks,
        consecutiveFailures: config.consecutiveFailures,
        lastSuccess: config.lastSuccess
      }
    });

    return healthModel.toJSON();
  }

  /**
   * Get health status of all services
   * @returns {Object} All services health status
   */
  getAllServicesHealth() {
    const services = {};
    
    for (const [serviceName] of this.healthChecks) {
      services[serviceName] = this.getServiceHealth(serviceName);
    }

    return {
      overall: this.getOverallHealthStatus(services),
      services,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Determine health status based on metrics
   * @param {Object} metrics - Service metrics
   * @returns {string} Health status
   */
  determineHealthStatus(metrics) {
    if (metrics.successRate < 0.5) return 'unhealthy';
    if (metrics.successRate < 0.8 || metrics.errorRate > 0.1) return 'degraded';
    if (metrics.averageResponseTime > 5000) return 'degraded';
    return 'healthy';
  }

  /**
   * Get overall health status
   * @param {Object} services - All services health
   * @returns {string} Overall health status
   */
  getOverallHealthStatus(services) {
    const serviceStatuses = Object.values(services).map(s => s.status);
    
    if (serviceStatuses.includes('unhealthy')) return 'unhealthy';
    if (serviceStatuses.includes('degraded')) return 'degraded';
    if (serviceStatuses.every(s => s === 'healthy')) return 'healthy';
    
    return 'unknown';
  }

  /**
   * Get service metrics
   * @param {string} serviceName - Name of the service
   * @returns {Object} Service metrics
   */
  getServiceMetrics(serviceName) {
    return this.metrics.get(serviceName) || null;
  }

  /**
   * Get all metrics
   * @returns {Object} All metrics
   */
  getAllMetrics() {
    const allMetrics = {};
    
    for (const [serviceName, metrics] of this.metrics) {
      allMetrics[serviceName] = metrics;
    }

    return allMetrics;
  }

  /**
   * Get recent alerts
   * @param {number} limit - Maximum number of alerts
   * @returns {Array} Recent alerts
   */
  getRecentAlerts(limit = 50) {
    return this.alerts
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Clear old alerts
   * @param {number} maxAge - Maximum age in milliseconds
   */
  clearOldAlerts(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
    const cutoff = Date.now() - maxAge;
    this.alerts = this.alerts.filter(alert => 
      new Date(alert.timestamp).getTime() > cutoff
    );
  }

  /**
   * Get monitoring statistics
   * @returns {Object} Monitoring statistics
   */
  getMonitoringStats() {
    const totalServices = this.healthChecks.size;
    const enabledServices = Array.from(this.healthChecks.values())
      .filter(config => config.enabled).length;
    
    const totalChecks = Array.from(this.metrics.values())
      .reduce((sum, metrics) => sum + (metrics.totalChecks || 0), 0);
    
    const totalAlerts = this.alerts.length;
    const recentAlerts = this.getRecentAlerts(10).length;

    return {
      totalServices,
      enabledServices,
      totalChecks,
      totalAlerts,
      recentAlerts,
      isMonitoring: this.isMonitoring,
      uptime: Date.now() - this.startTime,
      monitoringInterval: this.monitoringInterval
    };
  }

  /**
   * Update alert thresholds
   * @param {Object} thresholds - New thresholds
   */
  updateAlertThresholds(thresholds) {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    console.log('⚙️ Updated alert thresholds:', this.alertThresholds);
  }

  /**
   * Enable/disable service monitoring
   * @param {string} serviceName - Name of the service
   * @param {boolean} enabled - Whether to enable monitoring
   */
  setServiceMonitoring(serviceName, enabled) {
    const config = this.healthChecks.get(serviceName);
    if (config) {
      config.enabled = enabled;
      console.log(`${enabled ? '✅' : '❌'} ${enabled ? 'Enabled' : 'Disabled'} monitoring for ${serviceName}`);
    }
  }

  /**
   * Get service configuration
   * @param {string} serviceName - Name of the service
   * @returns {Object} Service configuration
   */
  getServiceConfig(serviceName) {
    return this.healthChecks.get(serviceName) || null;
  }

  /**
   * Update service configuration
   * @param {string} serviceName - Name of the service
   * @param {Object} config - New configuration
   */
  updateServiceConfig(serviceName, config) {
    const existingConfig = this.healthChecks.get(serviceName);
    if (existingConfig) {
      Object.assign(existingConfig, config);
      console.log(`⚙️ Updated configuration for ${serviceName}`);
    }
  }
}

module.exports = AIMonitoringService;
