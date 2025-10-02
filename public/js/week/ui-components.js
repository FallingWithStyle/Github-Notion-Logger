// UI Components for Week Planning
class WeekUIComponents {
    constructor() {
        this.projectSorter = new ProjectSorter();
    }
    
    /**
     * Create a project card element
     */
    createProjectCard(project, index) {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.dataset.projectName = project.name;
        card.dataset.index = index;
        
        const color = this.getProjectColor(project.name);
        card.style.borderLeftColor = color;
        
        card.innerHTML = `
            <div class="project-header">
                <div class="project-name">${project.name}</div>
                <div class="project-status">${project.status || 'unknown'}</div>
            </div>
            <div class="project-details">
                <div class="project-category">${project.category || 'Uncategorized'}</div>
                <div class="project-scores">
                    <span class="head-score">Head: ${project.head || '?'}</span>
                    <span class="heart-score">Heart: ${project.heart || '?'}</span>
                </div>
            </div>
            <div class="project-actions">
                <button class="btn-rate" onclick="weekApp.rateProject('${project.name}')">Rate</button>
                <button class="btn-categorize" onclick="weekApp.categorizeProject('${project.name}')">Categorize</button>
            </div>
        `;
        
        return card;
    }
    
    /**
     * Create a category breakdown item
     */
    createCategoryItem(category, projects) {
        const item = document.createElement('div');
        item.className = 'category-item';
        item.dataset.category = category;
        
        const sortedProjects = this.projectSorter.sortProjectsByPriority(projects);
        const topProject = sortedProjects[0];
        
        item.innerHTML = `
            <div class="category-header">
                <span class="category-name">${category}</span>
                <span class="project-count">${projects.length}</span>
            </div>
            <div class="category-projects">
                ${sortedProjects.slice(0, 3).map(project => 
                    `<div class="mini-project" style="border-left-color: ${this.getProjectColor(project.name)}">
                        ${project.name} (${project.priorityScore || 0})
                    </div>`
                ).join('')}
            </div>
        `;
        
        return item;
    }
    
    /**
     * Create a focus area selector
     */
    createFocusAreaSelector(type, currentValue) {
        const container = document.createElement('div');
        container.className = 'focus-area-selector';
        container.dataset.type = type;
        
        container.innerHTML = `
            <label for="focus-${type}">${type.charAt(0).toUpperCase() + type.slice(1)} Focus:</label>
            <select id="focus-${type}" onchange="weekApp.updateFocusArea('${type}', this.value)">
                <option value="">Select ${type} focus...</option>
                ${this.getCategoryOptions()}
            </select>
        `;
        
        if (currentValue) {
            const select = container.querySelector('select');
            select.value = currentValue;
        }
        
        return container;
    }
    
    /**
     * Get category options for select elements
     */
    getCategoryOptions() {
        const categories = window.weekApp?.categories || [];
        return categories.map(category => 
            `<option value="${category}">${category}</option>`
        ).join('');
    }
    
    /**
     * Create a modal dialog
     */
    createModal(title, content, actions = []) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'dynamic-modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-footer">
                    ${actions.map(action => 
                        `<button class="btn ${action.class || 'btn-primary'}" onclick="${action.onclick}">${action.text}</button>`
                    ).join('')}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        return modal;
    }
    
    /**
     * Show loading spinner
     */
    showLoading(show = true) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = show ? 'block' : 'none';
        }
    }
    
    /**
     * Show error message
     */
    showError(message) {
        const error = document.getElementById('error');
        if (error) {
            error.textContent = message;
            error.style.display = 'block';
        }
    }
    
    /**
     * Hide error message
     */
    hideError() {
        const error = document.getElementById('error');
        if (error) {
            error.style.display = 'none';
        }
    }
    
    /**
     * Get project color
     */
    getProjectColor(projectName) {
        return window.weekApp?.projectColors?.[projectName] || '#cccccc';
    }
    
    /**
     * Update project display
     */
    updateProjectDisplay(projects) {
        const container = document.getElementById('project-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        projects.forEach((project, index) => {
            const card = this.createProjectCard(project, index);
            container.appendChild(card);
        });
    }
    
    /**
     * Update category breakdown
     */
    updateCategoryBreakdown(projects) {
        const container = document.getElementById('category-breakdown');
        if (!container) return;
        
        // Group projects by category
        const categories = {};
        projects.forEach(project => {
            const category = project.category || 'Uncategorized';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(project);
        });
        
        container.innerHTML = '';
        
        Object.entries(categories).forEach(([category, categoryProjects]) => {
            const item = this.createCategoryItem(category, categoryProjects);
            container.appendChild(item);
        });
    }
    
    /**
     * Update focus areas
     */
    updateFocusAreas(weeklyFocus) {
        const primaryContainer = document.getElementById('primary-focus');
        const tangentContainer = document.getElementById('tangent-focus');
        
        if (primaryContainer) {
            primaryContainer.innerHTML = '';
            const selector = this.createFocusAreaSelector('primary', weeklyFocus.primary);
            primaryContainer.appendChild(selector);
        }
        
        if (tangentContainer) {
            tangentContainer.innerHTML = '';
            const selector = this.createFocusAreaSelector('tangent', weeklyFocus.tangent);
            tangentContainer.appendChild(selector);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WeekUIComponents;
} else {
    window.WeekUIComponents = WeekUIComponents;
}
