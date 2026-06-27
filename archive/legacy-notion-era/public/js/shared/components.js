/**
 * Shared JavaScript Components
 * 
 * This module provides reusable UI components used across the application.
 * All components are designed to be self-contained and reusable.
 */

import { Utils } from './utils.js';

/**
 * Project Card Component
 * Renders a project card with health indicators and metrics
 */
export class ProjectCard {
  constructor(project, container) {
    this.project = project;
    this.container = container;
  }

  /**
   * Render the project card
   * @returns {HTMLElement} Rendered card element
   */
  render() {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = this.getTemplate();
    this.container.appendChild(card);
    return card;
  }

  /**
   * Get the HTML template for the project card
   * @returns {string} HTML template
   */
  getTemplate() {
    const healthClass = Utils.getHealthClass(this.project.healthScore || 0);
    const healthLabel = Utils.getHealthLabel(this.project.healthScore || 0);
    
    return `
      <div class="project-header">
        <h3>${this.project.name}</h3>
        <span class="health-badge ${healthClass}">${healthLabel}</span>
      </div>
      <div class="project-metrics">
        <div class="metric">
          <span class="label">Progress:</span>
          <span class="value">${Utils.formatPercentage(this.project.progress || 0)}</span>
        </div>
        <div class="metric">
          <span class="label">Last Activity:</span>
          <span class="value">${Utils.timeAgo(this.project.lastActivity || new Date())}</span>
        </div>
        <div class="metric">
          <span class="label">Stories:</span>
          <span class="value">${this.project.storyCount || 0}</span>
        </div>
        <div class="metric">
          <span class="label">Tasks:</span>
          <span class="value">${this.project.taskCount || 0}</span>
        </div>
      </div>
      <div class="project-card-footer">
        <div class="project-tags">
          ${this.getTags()}
        </div>
        <div class="project-actions">
          <button class="btn btn--sm" onclick="this.viewDetails('${this.project.name}')">View Details</button>
          <button class="btn btn--sm btn--help help-button" onclick="this.showHelp('${this.project.name}')">
            <span class="help-icon">❓</span> Get Help
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Get project tags HTML
   * @returns {string} Tags HTML
   */
  getTags() {
    const tags = [];
    
    if (this.project.category) {
      tags.push(`<span class="project-tag category">${this.project.category}</span>`);
    }
    
    if (this.project.status) {
      tags.push(`<span class="project-tag status-${this.project.status}">${this.project.status}</span>`);
    }
    
    return tags.join('');
  }

  /**
   * View project details (placeholder for now)
   * @param {string} projectName - Name of the project
   */
  viewDetails(projectName) {
    console.log('Viewing details for project:', projectName);
    // This would typically navigate to a project details page
  }

  /**
   * Show contextual help for the project
   * @param {string} projectName - Name of the project
   */
  showHelp(projectName) {
    const helpContent = this.getContextualHelp(projectName);
    this.showHelpModal(helpContent);
  }

  /**
   * Get contextual help content for the project
   * @param {string} projectName - Name of the project
   * @returns {Object} Help content object
   */
  getContextualHelp(projectName) {
    const project = this.project;
    const healthScore = project.healthScore || 0;
    const progress = project.progress || 0;
    const status = project.status || 'unknown';
    
    let suggestions = [];
    let tips = [];

    // Health-based suggestions
    if (healthScore < 30) {
      suggestions.push('Consider reviewing project scope and breaking down large tasks');
      suggestions.push('Check for any blockers or dependencies that need attention');
    } else if (healthScore < 60) {
      suggestions.push('Focus on completing in-progress tasks to improve momentum');
      suggestions.push('Review and update project timeline if needed');
    } else if (healthScore >= 80) {
      suggestions.push('Great progress! Consider documenting lessons learned');
      suggestions.push('Plan for project completion and handover activities');
    }

    // Progress-based tips
    if (progress < 25) {
      tips.push('Start with quick wins to build momentum');
      tips.push('Break down large stories into smaller, manageable tasks');
    } else if (progress > 75) {
      tips.push('Focus on testing and quality assurance');
      tips.push('Prepare for project delivery and documentation');
    }

    // Status-based advice
    if (status === 'paused') {
      tips.push('Review why the project was paused and plan for resumption');
      tips.push('Consider if scope or timeline adjustments are needed');
    } else if (status === 'active') {
      tips.push('Maintain regular check-ins and progress updates');
      tips.push('Keep stakeholders informed of any changes or blockers');
    }

    return {
      title: `Help for ${projectName}`,
      project: {
        name: projectName,
        healthScore: healthScore,
        progress: progress,
        status: status,
        lastActivity: project.lastActivity,
        storyCount: project.storyCount || 0,
        taskCount: project.taskCount || 0
      },
      suggestions: suggestions,
      tips: tips,
      resources: [
        'Project Management Best Practices',
        'Agile Development Guidelines',
        'Team Communication Tips'
      ]
    };
  }

  /**
   * Show help modal with contextual information
   * @param {Object} helpContent - Help content to display
   */
  showHelpModal(helpContent) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('help-modal');
    if (!modal) {
      modal = this.createHelpModal();
      document.body.appendChild(modal);
    }

    // Update modal content
    this.updateHelpModalContent(modal, helpContent);

    // Show modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  /**
   * Create help modal element
   * @returns {HTMLElement} Modal element
   */
  createHelpModal() {
    const modal = document.createElement('div');
    modal.id = 'help-modal';
    modal.className = 'help-modal';
    modal.innerHTML = `
      <div class="help-modal-content">
        <div class="help-modal-header">
          <h3 class="help-modal-title"></h3>
          <button class="help-modal-close">&times;</button>
        </div>
        <div class="help-modal-body"></div>
      </div>
    `;

    // Add event listeners
    modal.querySelector('.help-modal-close').addEventListener('click', () => {
      this.hideHelpModal();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hideHelpModal();
      }
    });

    return modal;
  }

  /**
   * Update help modal content
   * @param {HTMLElement} modal - Modal element
   * @param {Object} helpContent - Help content to display
   */
  updateHelpModalContent(modal, helpContent) {
    const title = modal.querySelector('.help-modal-title');
    const body = modal.querySelector('.help-modal-body');

    title.textContent = helpContent.title;

    body.innerHTML = `
      <div class="help-project-info">
        <h4>Project Information</h4>
        <div class="help-metrics">
          <div class="help-metric">
            <span class="label">Health Score:</span>
            <span class="value">${helpContent.project.healthScore}/100</span>
          </div>
          <div class="help-metric">
            <span class="label">Progress:</span>
            <span class="value">${Utils.formatPercentage(helpContent.project.progress)}</span>
          </div>
          <div class="help-metric">
            <span class="label">Status:</span>
            <span class="value">${helpContent.project.status}</span>
          </div>
          <div class="help-metric">
            <span class="label">Stories:</span>
            <span class="value">${helpContent.project.storyCount}</span>
          </div>
          <div class="help-metric">
            <span class="label">Tasks:</span>
            <span class="value">${helpContent.project.taskCount}</span>
          </div>
        </div>
      </div>

      ${helpContent.suggestions.length > 0 ? `
        <div class="help-suggestions">
          <h4>Suggestions</h4>
          <ul>
            ${helpContent.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${helpContent.tips.length > 0 ? `
        <div class="help-tips">
          <h4>Tips</h4>
          <ul>
            ${helpContent.tips.map(tip => `<li>${tip}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <div class="help-resources">
        <h4>Resources</h4>
        <ul>
          ${helpContent.resources.map(resource => `<li>${resource}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  /**
   * Hide help modal
   */
  hideHelpModal() {
    const modal = document.getElementById('help-modal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
  }
}

/**
 * Progress Bar Component
 * Renders a progress bar with percentage display
 */
export class ProgressBar {
  constructor(progress, container, options = {}) {
    this.progress = Math.min(100, Math.max(0, progress || 0));
    this.container = container;
    this.options = {
      showPercentage: true,
      animated: true,
      color: 'primary',
      size: 'md',
      ...options
    };
  }

  /**
   * Render the progress bar
   * @returns {HTMLElement} Rendered progress bar element
   */
  render() {
    const bar = document.createElement('div');
    bar.className = `progress-bar progress-bar--${this.options.size}`;
    bar.innerHTML = this.getTemplate();
    this.container.appendChild(bar);
    
    if (this.options.animated) {
      this.animate();
    }
    
    return bar;
  }

  /**
   * Get the HTML template for the progress bar
   * @returns {string} HTML template
   */
  getTemplate() {
    const percentage = Utils.formatPercentage(this.progress);
    
    return `
      <div class="progress-fill" style="width: ${this.progress}%"></div>
      ${this.options.showPercentage ? `<span class="progress-text">${percentage}</span>` : ''}
    `;
  }

  /**
   * Animate the progress bar
   */
  animate() {
    const fill = this.container.querySelector('.progress-fill');
    if (fill) {
      fill.style.width = '0%';
      setTimeout(() => {
        fill.style.width = `${this.progress}%`;
      }, 100);
    }
  }

  /**
   * Update progress value
   * @param {number} progress - New progress value
   */
  updateProgress(progress) {
    this.progress = Math.min(100, Math.max(0, progress || 0));
    const fill = this.container.querySelector('.progress-fill');
    const text = this.container.querySelector('.progress-text');
    
    if (fill) {
      fill.style.width = `${this.progress}%`;
    }
    
    if (text) {
      text.textContent = Utils.formatPercentage(this.progress);
    }
  }
}

/**
 * Filter Controls Component
 * Renders filter controls for data filtering
 */
export class FilterControls {
  constructor(container, onFilter) {
    this.container = container;
    this.onFilter = onFilter;
    this.filters = {};
    this.options = {
      search: true,
      category: true,
      status: true,
      health: true,
      activity: true
    };
  }

  /**
   * Render the filter controls
   * @returns {HTMLElement} Rendered filter controls element
   */
  render() {
    this.container.innerHTML = this.getTemplate();
    this.setupEventListeners();
    return this.container;
  }

  /**
   * Get the HTML template for filter controls
   * @returns {string} HTML template
   */
  getTemplate() {
    return `
      <div class="filters">
        ${this.options.search ? this.getSearchFilter() : ''}
        ${this.options.category ? this.getCategoryFilter() : ''}
        ${this.options.status ? this.getStatusFilter() : ''}
        ${this.options.health ? this.getHealthFilter() : ''}
        ${this.options.activity ? this.getActivityFilter() : ''}
      </div>
    `;
  }

  /**
   * Get search filter HTML
   * @returns {string} Search filter HTML
   */
  getSearchFilter() {
    return `
      <div class="filter-group">
        <input type="text" id="search-input" placeholder="Search..." value="${this.filters.search || ''}">
      </div>
    `;
  }

  /**
   * Get category filter HTML
   * @returns {string} Category filter HTML
   */
  getCategoryFilter() {
    return `
      <div class="filter-group">
        <label for="category-filter">Category:</label>
        <select id="category-filter">
          <option value="">All Categories</option>
          <option value="development" ${this.filters.category === 'development' ? 'selected' : ''}>Development</option>
          <option value="design" ${this.filters.category === 'design' ? 'selected' : ''}>Design</option>
          <option value="research" ${this.filters.category === 'research' ? 'selected' : ''}>Research</option>
          <option value="documentation" ${this.filters.category === 'documentation' ? 'selected' : ''}>Documentation</option>
        </select>
      </div>
    `;
  }

  /**
   * Get status filter HTML
   * @returns {string} Status filter HTML
   */
  getStatusFilter() {
    return `
      <div class="filter-group">
        <label for="status-filter">Status:</label>
        <select id="status-filter">
          <option value="">All Statuses</option>
          <option value="active" ${this.filters.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="planning" ${this.filters.status === 'planning' ? 'selected' : ''}>Planning</option>
          <option value="paused" ${this.filters.status === 'paused' ? 'selected' : ''}>Paused</option>
          <option value="completed" ${this.filters.status === 'completed' ? 'selected' : ''}>Completed</option>
        </select>
      </div>
    `;
  }

  /**
   * Get health filter HTML
   * @returns {string} Health filter HTML
   */
  getHealthFilter() {
    return `
      <div class="filter-group">
        <label for="health-filter">Health:</label>
        <select id="health-filter">
          <option value="">All Health</option>
          <option value="excellent" ${this.filters.health === 'excellent' ? 'selected' : ''}>Excellent</option>
          <option value="good" ${this.filters.health === 'good' ? 'selected' : ''}>Good</option>
          <option value="fair" ${this.filters.health === 'fair' ? 'selected' : ''}>Fair</option>
          <option value="poor" ${this.filters.health === 'poor' ? 'selected' : ''}>Poor</option>
          <option value="critical" ${this.filters.health === 'critical' ? 'selected' : ''}>Critical</option>
        </select>
      </div>
    `;
  }

  /**
   * Get activity filter HTML
   * @returns {string} Activity filter HTML
   */
  getActivityFilter() {
    return `
      <div class="filter-group">
        <label for="activity-filter">Activity:</label>
        <select id="activity-filter">
          <option value="">All Activity</option>
          <option value="recent" ${this.filters.activity === 'recent' ? 'selected' : ''}>Recent</option>
          <option value="moderate" ${this.filters.activity === 'moderate' ? 'selected' : ''}>Moderate</option>
          <option value="stale" ${this.filters.activity === 'stale' ? 'selected' : ''}>Stale</option>
          <option value="inactive" ${this.filters.activity === 'inactive' ? 'selected' : ''}>Inactive</option>
        </select>
      </div>
    `;
  }

  /**
   * Setup event listeners for filter controls
   */
  setupEventListeners() {
    const searchInput = this.container.querySelector('#search-input');
    if (searchInput) {
      searchInput.addEventListener('input', 
        Utils.debounce(() => this.handleFilter(), 300)
      );
    }

    const selects = this.container.querySelectorAll('select');
    selects.forEach(select => {
      select.addEventListener('change', () => this.handleFilter());
    });
  }

  /**
   * Handle filter changes
   */
  handleFilter() {
    this.filters = {
      search: this.container.querySelector('#search-input')?.value || '',
      category: this.container.querySelector('#category-filter')?.value || '',
      status: this.container.querySelector('#status-filter')?.value || '',
      health: this.container.querySelector('#health-filter')?.value || '',
      activity: this.container.querySelector('#activity-filter')?.value || ''
    };
    
    if (this.onFilter) {
      this.onFilter(this.filters);
    }
  }

  /**
   * Clear all filters
   */
  clearFilters() {
    this.filters = {};
    this.container.querySelectorAll('input, select').forEach(input => {
      input.value = '';
    });
    this.handleFilter();
  }

  /**
   * Set filter values
   * @param {Object} filters - Filter values to set
   */
  setFilters(filters) {
    this.filters = { ...this.filters, ...filters };
    
    Object.entries(filters).forEach(([key, value]) => {
      const input = this.container.querySelector(`#${key}-input, #${key}-filter`);
      if (input) {
        input.value = value;
      }
    });
  }
}

/**
 * Pagination Component
 * Renders pagination controls
 */
export class Pagination {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      currentPage: 1,
      totalPages: 1,
      pageSize: 10,
      showInfo: true,
      maxVisible: 5,
      ...options
    };
    this.onPageChange = null;
  }

  /**
   * Render the pagination controls
   * @returns {HTMLElement} Rendered pagination element
   */
  render() {
    this.container.innerHTML = this.getTemplate();
    this.setupEventListeners();
    return this.container;
  }

  /**
   * Get the HTML template for pagination
   * @returns {string} HTML template
   */
  getTemplate() {
    const { currentPage, totalPages, showInfo } = this.options;
    const startItem = (currentPage - 1) * this.options.pageSize + 1;
    const endItem = Math.min(currentPage * this.options.pageSize, this.options.totalItems || totalPages * this.options.pageSize);
    
    return `
      <div class="pagination">
        <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">
          ← Previous
        </button>
        
        ${this.getPageNumbers()}
        
        <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">
          Next →
        </button>
        
        ${showInfo ? `
          <div class="pagination-info">
            Showing ${startItem}-${endItem} of ${this.options.totalItems || totalPages * this.options.pageSize} items
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Get page number buttons HTML
   * @returns {string} Page numbers HTML
   */
  getPageNumbers() {
    const { currentPage, totalPages, maxVisible } = this.options;
    const pages = [];
    
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(`
        <button class="pagination-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">
          ${i}
        </button>
      `);
    }
    
    return pages.join('');
  }

  /**
   * Setup event listeners for pagination
   */
  setupEventListeners() {
    this.container.querySelectorAll('.pagination-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const page = parseInt(e.target.dataset.page);
        if (page && page !== this.options.currentPage) {
          this.goToPage(page);
        }
      });
    });
  }

  /**
   * Go to specific page
   * @param {number} page - Page number to go to
   */
  goToPage(page) {
    this.options.currentPage = page;
    this.render();
    
    if (this.onPageChange) {
      this.onPageChange(page);
    }
  }

  /**
   * Update pagination options
   * @param {Object} options - New options
   */
  updateOptions(options) {
    this.options = { ...this.options, ...options };
    this.render();
  }
}

// Export for both ES6 modules and CommonJS
export default {
  ProjectCard,
  ProgressBar,
  FilterControls,
  Pagination
};
