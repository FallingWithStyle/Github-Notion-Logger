const assert = require('assert');
const ProjectManagementService = require('./services/project-management-service');

async function testSearchEnhancement() {
  console.log('🧪 Testing enhanced search functionality...');
  
  const projectService = new ProjectManagementService();
  
  // Test enhanced search with different search types
  const testCases = [
    {
      name: 'Basic string search',
      search: 'Kitch',
      expectedMinResults: 1,
      description: 'Should find projects containing "Kitch"'
    },
    {
      name: 'Case insensitive search',
      search: 'kitch',
      expectedMinResults: 1,
      description: 'Should find projects regardless of case'
    },
    {
      name: 'Partial word search',
      search: 'magic',
      expectedMinResults: 1,
      description: 'Should find projects with partial matches'
    },
    {
      name: 'Multi-word search',
      search: 'github notion',
      expectedMinResults: 1,
      description: 'Should find projects matching multiple words'
    },
    {
      name: 'Category search',
      search: 'category:Miscellaneous',
      expectedMinResults: 5,
      description: 'Should find projects by category'
    },
    {
      name: 'Status search',
      search: 'status:cached',
      expectedMinResults: 5,
      description: 'Should find projects by status'
    },
    {
      name: 'Health status search',
      search: 'health:excellent',
      expectedMinResults: 3,
      description: 'Should find projects by health status'
    },
    {
      name: 'Progress range search',
      search: 'progress:>50',
      expectedMinResults: 3,
      description: 'Should find projects with progress > 50%'
    },
    {
      name: 'Complex search',
      search: 'magic health:excellent progress:>10',
      expectedMinResults: 1,
      description: 'Should handle complex multi-criteria searches'
    },
    {
      name: 'No results search',
      search: 'nonexistentproject123',
      expectedMinResults: 0,
      description: 'Should return empty results for non-matching search'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🔍 Testing: ${testCase.name}`);
    console.log(`   Search: "${testCase.search}"`);
    console.log(`   Expected: ${testCase.expectedMinResults}+ results`);
    
    try {
      const result = await projectService.getProjectOverview({
        search: testCase.search,
        limit: 50
      });
      
      console.log('Search result:', JSON.stringify(result, null, 2));
      
      // Test that search was successful
      assert(result.success, 'Search should return success');
      assert(result.data, 'Search should have data');
      assert(Array.isArray(result.data), 'Search data should be an array');
      
      // Test that we got the expected number of results
      const actualResults = result.data.length;
      assert(actualResults >= testCase.expectedMinResults, 
        `Expected at least ${testCase.expectedMinResults} results, got ${actualResults} for search "${testCase.search}"`);
      
      // Test that results are relevant (contain search terms or match criteria)
      if (actualResults > 0) {
        const firstResult = result.data[0];
        assert(firstResult.name, 'Search result should have a name');
        assert(firstResult.repository, 'Search result should have a repository');
        
        // For basic string searches, verify the search term appears in relevant fields
        if (!testCase.search.includes(':')) {
          const searchLower = testCase.search.toLowerCase();
          
          // For multi-word searches, check if all words appear anywhere in the combined text
          if (searchLower.includes(' ')) {
            const words = searchLower.split(/\s+/).filter(word => word.length > 0);
            const combinedText = `${firstResult.name} ${firstResult.repository} ${firstResult.category || ''}`.toLowerCase();
            const allWordsMatch = words.every(word => combinedText.includes(word));
            
            assert(allWordsMatch, 
              `Search result should contain all words "${testCase.search}" in name, repository, or category`);
          } else {
            // For single word searches, check if the word appears in any field
            const nameMatch = firstResult.name.toLowerCase().includes(searchLower);
            const repoMatch = firstResult.repository.toLowerCase().includes(searchLower);
            const categoryMatch = firstResult.category && firstResult.category.toLowerCase().includes(searchLower);
            
            assert(nameMatch || repoMatch || categoryMatch, 
              `Search result should contain "${testCase.search}" in name, repository, or category`);
          }
        }
      }
      
      console.log(`✅ Search test passed: ${actualResults} results found`);
      console.log(`   Description: ${testCase.description}`);
      
    } catch (error) {
      console.log(`❌ Search test failed for "${testCase.search}":`, error.message);
      return;
    }
  }
  
  console.log('\n✅ All enhanced search tests passed');
}

testSearchEnhancement().catch(console.error);
