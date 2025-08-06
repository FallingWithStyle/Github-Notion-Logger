const { logCommitsToNotion } = require('./notion');
require('dotenv').config();

async function testNotionFunction() {
  console.log('Testing logCommitsToNotion function...');
  
  const testCommits = [
    {
      id: 'test123',
      message: 'Test commit message',
      url: 'https://github.com/test/repo/commit/test123',
      author: {
        name: 'Test Author',
        email: 'test@example.com'
      },
      timestamp: new Date().toISOString(),
      added: [],
      removed: [],
      modified: []
    }
  ];
  
  try {
    await logCommitsToNotion(testCommits, 'test/repo');
    console.log('✅ Successfully logged test commit to Notion!');
  } catch (error) {
    console.error('❌ Failed to log commit:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
  }
}

testNotionFunction(); 