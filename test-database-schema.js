const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function getDatabaseSchema() {
  console.log('Getting database schema...');
  
  try {
    const response = await notion.databases.retrieve({
      database_id: process.env.NOTION_COMMIT_FROM_GITHUB_LOG_ID
    });
    
    console.log('✅ Database schema retrieved!');
    console.log('Database title:', response.title?.[0]?.plain_text || 'Untitled');
    console.log('\nProperties:');
    
    for (const [propertyName, propertyConfig] of Object.entries(response.properties)) {
      console.log(`\n"${propertyName}":`);
      console.log(`  Type: ${propertyConfig.type}`);
      console.log(`  ID: ${propertyConfig.id}`);
      
      if (propertyConfig.type === 'title') {
        console.log(`  Title config:`, propertyConfig.title);
      } else if (propertyConfig.type === 'rich_text') {
        console.log(`  Rich text config:`, propertyConfig.rich_text);
      } else if (propertyConfig.type === 'date') {
        console.log(`  Date config:`, propertyConfig.date);
      } else if (propertyConfig.type === 'number') {
        console.log(`  Number config:`, propertyConfig.number);
      } else if (propertyConfig.type === 'select') {
        console.log(`  Select config:`, propertyConfig.select);
      } else if (propertyConfig.type === 'multi_select') {
        console.log(`  Multi-select config:`, propertyConfig.multi_select);
      } else if (propertyConfig.type === 'checkbox') {
        console.log(`  Checkbox config:`, propertyConfig.checkbox);
      } else if (propertyConfig.type === 'url') {
        console.log(`  URL config:`, propertyConfig.url);
      } else if (propertyConfig.type === 'email') {
        console.log(`  Email config:`, propertyConfig.email);
      } else if (propertyConfig.type === 'phone_number') {
        console.log(`  Phone config:`, propertyConfig.phone_number);
      } else if (propertyConfig.type === 'people') {
        console.log(`  People config:`, propertyConfig.people);
      } else if (propertyConfig.type === 'files') {
        console.log(`  Files config:`, propertyConfig.files);
      } else if (propertyConfig.type === 'relation') {
        console.log(`  Relation config:`, propertyConfig.relation);
      } else if (propertyConfig.type === 'formula') {
        console.log(`  Formula config:`, propertyConfig.formula);
      } else if (propertyConfig.type === 'rollup') {
        console.log(`  Rollup config:`, propertyConfig.rollup);
      } else if (propertyConfig.type === 'created_time') {
        console.log(`  Created time config:`, propertyConfig.created_time);
      } else if (propertyConfig.type === 'created_by') {
        console.log(`  Created by config:`, propertyConfig.created_by);
      } else if (propertyConfig.type === 'last_edited_time') {
        console.log(`  Last edited time config:`, propertyConfig.last_edited_time);
      } else if (propertyConfig.type === 'last_edited_by') {
        console.log(`  Last edited by config:`, propertyConfig.last_edited_by);
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to get database schema:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
  }
}

getDatabaseSchema(); 