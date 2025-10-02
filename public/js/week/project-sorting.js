// Project Sorting Logic
class ProjectSorter {
    constructor() {
        // Define status priority order (higher index = higher priority)
        this.statusPriority = {
            'active': 6,
            'planning': 5,
            'idea': 4,
            'paused': 3,
            'unknown': 2,
            'done': 1,
            'released': 1,
            'parking-lot': 0,
            'abandoned': 0
        };
    }
    
    /**
     * Comprehensive project sorting function
     * Sorts by: 1) Total score (highest first), 2) Status priority, 3) Alphabetical
     * 
     * Status priority order (highest to lowest):
     * - active (6): Currently being worked on
     * - planning (5): Actively shaping into something concrete  
     * - idea (4): Just a spark or rough concept
     * - paused (3): Work stopped, likely to resume later
     * - unknown (2): Status not yet determined
     * - done/released (1): Completed or publicly launched
     * - parking-lot/abandoned (0): Not in current cycle or abandoned
     */
    sortProjectsByPriority(projects) {
        // Handle edge cases
        if (!Array.isArray(projects) || projects.length === 0) {
            return projects;
        }
        
        // Filter out projects without required properties
        const validProjects = projects.filter(project => 
            project && 
            typeof project.name === 'string' && 
            typeof project.priorityScore === 'number'
        );
        
        if (validProjects.length === 0) {
            console.warn('⚠️ No valid projects to sort');
            return projects;
        }
        
        const sorted = validProjects.sort((a, b) => {
            // First: sort by total score (highest first)
            if (a.priorityScore !== b.priorityScore) {
                return b.priorityScore - a.priorityScore;
            }
            
            // Second: if scores are tied, sort by status priority
            const aStatusPriority = this.statusPriority[a.status] || 0;
            const bStatusPriority = this.statusPriority[b.status] || 0;
            if (aStatusPriority !== bStatusPriority) {
                console.log(`🔄 Score tie resolved by status: ${a.name} (${a.status} [${aStatusPriority}]) vs ${b.name} (${b.status} [${bStatusPriority}])`);
                return bStatusPriority - aStatusPriority;
            }
            
            // Third: if status is also tied, sort alphabetically
            console.log(`🔄 Score and status tie resolved alphabetically: ${a.name} vs ${b.name}`);
            return a.name.localeCompare(b.name);
        });
        
        // Debug logging for sorting results
        this.logSortingResults(sorted);
        
        return sorted;
    }
    
    /**
     * Log detailed sorting results for debugging
     */
    logSortingResults(sorted) {
        if (sorted.length > 1) {
            console.log('🔄 Project sorting applied:');
            sorted.forEach((project, index) => {
                const statusPriorityValue = this.statusPriority[project.status] || 0;
                console.log(`  ${index + 1}. ${project.name} (Score: ${project.priorityScore}, Status: ${project.status} [${statusPriorityValue}])`);
            });
            
            // Log any tie-breaking decisions
            for (let i = 0; i < sorted.length - 1; i++) {
                const current = sorted[i];
                const next = sorted[i + 1];
                
                if (current.priorityScore === next.priorityScore) {
                    const currentStatusPriority = this.statusPriority[current.status] || 0;
                    const nextStatusPriority = this.statusPriority[next.status] || 0;
                    
                    if (currentStatusPriority === nextStatusPriority) {
                        console.log(`📝 Alphabetical tie-break: ${current.name} comes before ${next.name}`);
                    } else {
                        console.log(`📝 Status tie-break: ${current.name} (${current.status} [${currentStatusPriority}]) comes before ${next.name} (${next.status} [${nextStatusPriority}])`);
                    }
                }
            }
        }
    }
    
    /**
     * Find the next best project based on various criteria
     */
    findNextBestProject(projects, sortBy = 'priorityScore') {
        if (!Array.isArray(projects) || projects.length === 0) {
            return null;
        }
        
        let sortedProjects;
        
        switch (sortBy) {
            case 'priorityScore':
                sortedProjects = this.sortProjectsByPriority(projects);
                break;
            case 'alphabetical':
                sortedProjects = [...projects].sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'status':
                sortedProjects = [...projects].sort((a, b) => {
                    const aPriority = this.statusPriority[a.status] || 0;
                    const bPriority = this.statusPriority[b.status] || 0;
                    return bPriority - aPriority;
                });
                break;
            default:
                sortedProjects = this.sortProjectsByPriority(projects);
        }
        
        return sortedProjects[0] || null;
    }
    
    /**
     * Filter projects by category
     */
    filterProjectsByCategory(projects, category) {
        if (!category) return projects;
        return projects.filter(project => project.category === category);
    }
    
    /**
     * Filter projects by status
     */
    filterProjectsByStatus(projects, status) {
        if (!status) return projects;
        return projects.filter(project => project.status === status);
    }
    
    /**
     * Get projects with highest priority scores
     */
    getTopPriorityProjects(projects, count = 5) {
        const sorted = this.sortProjectsByPriority(projects);
        return sorted.slice(0, count);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectSorter;
} else {
    window.ProjectSorter = ProjectSorter;
}
