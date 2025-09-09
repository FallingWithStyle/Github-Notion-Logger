#!/usr/bin/env node

// Test date parsing logic without requiring API keys
function testDateParsing() {
  console.log('🧪 Testing date parsing logic...\n');
  
  function parseDateInput(input) {
    if (input === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().split('T')[0];
    } else if (input === 'today') {
      return new Date().toISOString().split('T')[0];
    } else {
      // Validate date format
      const date = new Date(input);
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date format: ${input}`);
      }
      return input;
    }
  }
  
  function getDateRange(targetDate) {
    const date = new Date(targetDate);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return {
      start: startOfDay.toISOString(),
      end: endOfDay.toISOString()
    };
  }
  
  const testCases = [
    '2024-01-15',
    'yesterday',
    'today',
    '2024-12-01',
    '2023-06-30'
  ];
  
  console.log('📅 Testing date parsing:');
  testCases.forEach(testCase => {
    try {
      const parsedDate = parseDateInput(testCase);
      const range = getDateRange(parsedDate);
      console.log(`   ${testCase} → ${parsedDate}`);
      console.log(`     Start: ${range.start}`);
      console.log(`     End: ${range.end}`);
      console.log('');
    } catch (error) {
      console.log(`   ${testCase} → ❌ Error: ${error.message}`);
    }
  });
  
  // Test invalid dates
  console.log('❌ Testing invalid dates:');
  const invalidDates = ['invalid-date', '2024-13-01', 'not-a-date'];
  invalidDates.forEach(testCase => {
    try {
      const parsedDate = parseDateInput(testCase);
      console.log(`   ${testCase} → ❌ Should have failed but got: ${parsedDate}`);
    } catch (error) {
      console.log(`   ${testCase} → ✅ Correctly failed: ${error.message}`);
    }
  });
  
  console.log('🎉 Date parsing test completed!');
}

// Run test if this file is executed directly
if (require.main === module) {
  testDateParsing();
}

module.exports = { testDateParsing };
