#!/usr/bin/env node

/**
 * Test script for Llama-hub integration
 * Tests all the Llama-hub API endpoints
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

const BASE_URL = process.env.SERVER_URL || 'http://localhost:3260';
const LLAMA_HUB_URL = process.env.LLAMA_HUB_URL || 'http://localhost:9000';

async function testEndpoint(method, endpoint, data = null, description = '') {
  console.log(`\n🧪 Testing: ${description || `${method} ${endpoint}`}`);
  
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ Success: ${response.status}`);
      console.log(`📄 Response:`, JSON.stringify(result, null, 2));
    } else {
      console.log(`❌ Error: ${response.status}`);
      console.log(`📄 Error Response:`, JSON.stringify(result, null, 2));
    }
    
    return { success: response.ok, status: response.status, data: result };
  } catch (error) {
    console.log(`💥 Exception: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting Llama-hub Integration Tests');
  console.log(`📡 Server URL: ${BASE_URL}`);
  console.log(`🦙 Llama-hub URL: ${LLAMA_HUB_URL}`);
  
  // Test 1: Health check
  await testEndpoint('GET', '/api/llama/health', null, 'Llama-hub Health Check');
  
  // Test 2: Get available models
  await testEndpoint('GET', '/api/llama/models', null, 'Get Available Models');
  
  // Test 3: Simple text generation
  await testEndpoint('POST', '/api/llama/generate', {
    prompt: 'Hello! What model are you?',
    model: 'llama3-7b',
    maxTokens: 100,
    temperature: 0.7
  }, 'Simple Text Generation');
  
  // Test 4: Chat completion
  await testEndpoint('POST', '/api/llama/chat', {
    model: 'llama3-7b',
    messages: [
      { role: 'user', content: 'What is the capital of France?' }
    ],
    maxTokens: 50,
    temperature: 0.3
  }, 'Chat Completion');
  
  // Test 5: Project analysis
  const sampleProjectData = {
    commits: [
      { message: 'feat: add user authentication', date: '2024-01-15', files: ['auth.js', 'user.js'] },
      { message: 'fix: resolve login bug', date: '2024-01-16', files: ['auth.js'] },
      { message: 'docs: update README', date: '2024-01-17', files: ['README.md'] }
    ],
    totalCommits: 3,
    timeRange: '3 days'
  };
  
  await testEndpoint('POST', '/api/llama/analyze-project', {
    projectData: JSON.stringify(sampleProjectData),
    analysisType: 'productivity'
  }, 'Project Analysis');
  
  // Test 6: Commit message suggestion
  const sampleChanges = [
    { status: 'modified', filename: 'server.js', additions: 15, deletions: 3 },
    { status: 'added', filename: 'auth.js', additions: 45, deletions: 0 },
    { status: 'deleted', filename: 'old-auth.js', additions: 0, deletions: 20 }
  ];
  
  await testEndpoint('POST', '/api/llama/suggest-commit', {
    changes: sampleChanges,
    context: 'Adding user authentication system'
  }, 'Commit Message Suggestion');
  
  console.log('\n🏁 Tests completed!');
  console.log('\n📋 Summary:');
  console.log('- If all tests show ✅ Success, the integration is working correctly');
  console.log('- If any tests show ❌ Error, check that:');
  console.log('  1. The Llama-hub server is running on port 9000');
  console.log('  2. The LLAMA_API_KEY environment variable is set');
  console.log('  3. The llama3-7b model is available in the hub');
  console.log('  4. The github-notion-logger server is running');
}

// Run the tests
runTests().catch(console.error);
