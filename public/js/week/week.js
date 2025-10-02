// Week Planning - Main Application
class WeekPlanningApp {
    constructor() {
        this.projectData = [];
        this.projectColors = {};
        this.categories = [];
        this.userAnswers = {};
        this.currentProjectIndex = 0;
        this.weeklyFocus = {
            primary: '',
            tangent: ''
        };
        this.lockedProjectOrder = [];
        
        this.init();
    }
    
    init() {
        this.loadSavedData();
        this.loadWeeklyData();
        this.setupEventListeners();
    }
    
    // Load saved data from localStorage
    loadSavedData() {
        try {
            const saved = localStorage.getItem('weeklyPlanningData');
            if (saved) {
                const data = JSON.parse(saved);
                this.userAnswers = data.userAnswers || {};
                this.categories = data.categories || [];
                this.currentProjectIndex = data.currentProjectIndex || 0;
                this.weeklyFocus = data.weeklyFocus || { primary: '', tangent: '' };
                console.log('📥 Loaded saved data from localStorage');
                console.log('🔍 weeklyFocus loaded:', this.weeklyFocus);
            } else {
                console.log('📥 No saved data found in localStorage');
            }
        } catch (error) {
            console.error('❌ Error loading saved data:', error);
            console.log('📥 No saved data found in localStorage');
        }
        
        // Load checkbox state
        const ignoreDone = localStorage.getItem('ignoreDoneProjects');
        if (ignoreDone !== null) {
            const checkbox = document.getElementById('ignore-done-projects');
            if (checkbox) {
                checkbox.checked = ignoreDone === 'true';
            }
        }
        
        // Test sorting logic on page load
        this.testSortingLogic();
    }
    
    // Save data to localStorage
    saveData() {
        try {
            const dataToSave = {
                userAnswers: this.userAnswers,
                categories: this.categories,
                currentProjectIndex: this.currentProjectIndex,
                weeklyFocus: this.weeklyFocus,
                timestamp: Date.now()
            };
            localStorage.setItem('weeklyPlanningData', JSON.stringify(dataToSave));
            console.log('💾 Saved data to localStorage');
            console.log('📊 Data saved:', dataToSave);
        } catch (error) {
            console.warn('⚠️ Could not save data:', error);
        }
    }
    
    // Load weekly data from API
    async loadWeeklyData() {
        try {
            this.showLoading(true);
            this.hideError();
            
            const response = await fetch('/api/weekly-data');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.projectData = result.projects;
                this.projectColors = result.projectColors;
                
                // Merge saved categories with server categories
                const savedCategories = this.categories || [];
                const serverCategories = result.categories || [];
                this.categories = [...new Set([...savedCategories, ...serverCategories])];
                
                // Apply saved categories, status, and ratings to project data
                this.projectData.forEach(project => {
                    const savedProject = this.userAnswers[project.name];
                    if (savedProject) {
                        if (savedProject.category) {
                            project.category = savedProject.category;
                            console.log(`📝 Applied category "${savedProject.category}" to ${project.name}`);
                        }
                        if (savedProject.status) {
                            project.status = savedProject.status;
                            console.log(`📝 Applied status "${savedProject.status}" to ${project.name}`);
                        }
                        if (savedProject.head) {
                            project.head = savedProject.head;
                            console.log(`📝 Applied head rating "${savedProject.head}" to ${project.name}`);
                        }
                        if (savedProject.heart) {
                            project.heart = savedProject.heart;
                            console.log(`📝 Applied heart rating "${savedProject.heart}" to ${project.name}`);
                        }
                        if (savedProject.notes) {
                            project.notes = savedProject.notes;
                            console.log(`📝 Applied notes to ${project.name}`);
                        }
                    }
                });
                
                this.updateProjectDisplay();
                this.updateCategoryBreakdown();
                this.updateFocusAreas();
                this.updateWeeklyPlan();
                
                console.log('✅ Weekly data loaded successfully');
            } else {
                throw new Error(result.error || 'Failed to load weekly data');
            }
        } catch (error) {
            console.error('❌ Error loading weekly data:', error);
            this.showError('Failed to load weekly data: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Add event listeners for various UI interactions
        // This will be expanded with specific event handlers
    }
    
    // Show/hide loading state
    showLoading(show) {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = show ? 'block' : 'none';
        }
    }
    
    // Show error message
    showError(message) {
        const errorElement = document.getElementById('error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }
    
    // Hide error message
    hideError() {
        const errorElement = document.getElementById('error');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }
    
    // Update project display
    updateProjectDisplay() {
        // Implementation for updating the project display
        console.log('🔄 Updating project display');
    }
    
    // Update category breakdown
    updateCategoryBreakdown() {
        // Implementation for updating category breakdown
        console.log('🔄 Updating category breakdown');
    }
    
    // Update focus areas
    updateFocusAreas() {
        // Implementation for updating focus areas
        console.log('🔄 Updating focus areas');
    }
    
    // Update weekly plan
    updateWeeklyPlan() {
        // Implementation for updating weekly plan
        console.log('🔄 Updating weekly plan');
    }
    
    // Test sorting logic
    testSortingLogic() {
        // Implementation for testing sorting logic
        console.log('🧪 Testing sorting logic');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.weekApp = new WeekPlanningApp();
});
