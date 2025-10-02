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
