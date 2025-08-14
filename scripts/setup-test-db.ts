#!/usr/bin/env tsx
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'path';

// Use test container port (5433) instead of local port (5432)
const MAIN_DB_URL = 'postgresql://postgres:postgres@localhost:5433/postgres';
const TEST_DB_NAME = 'booking_portal_test';
const TEST_DB_URL = `postgresql://postgres:postgres@localhost:5433/${TEST_DB_NAME}`;

async function setupTestDatabase() {
  console.log('🔧 Setting up test database...');
  
  // Connect to main postgres database to create test database
  const adminClient = postgres(MAIN_DB_URL, { max: 1 });
  
  try {
    // Drop existing test database if it exists
    await adminClient`DROP DATABASE IF EXISTS ${adminClient(TEST_DB_NAME)}`;
    console.log('✅ Dropped existing test database');
    
    // Create new test database
    await adminClient`CREATE DATABASE ${adminClient(TEST_DB_NAME)}`;
    console.log('✅ Created test database');
    
  } catch (error) {
    console.error('❌ Failed to setup test database:', error);
    throw error;
  } finally {
    await adminClient.end();
  }
  
  // Connect to test database and run migrations
  const testClient = postgres(TEST_DB_URL, { max: 1 });
  const db = drizzle(testClient);
  
  try {
    console.log('🔄 Running migrations...');
    await migrate(db, {
      migrationsFolder: path.join(process.cwd(), 'src/server/db/migrations'),
    });
    console.log('✅ Migrations completed');
    
  } catch (error) {
    console.error('❌ Failed to run migrations:', error);
    throw error;
  } finally {
    await testClient.end();
  }
  
  console.log('🎉 Test database setup complete!');
}

// Run if called directly
if (require.main === module) {
  setupTestDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { setupTestDatabase };