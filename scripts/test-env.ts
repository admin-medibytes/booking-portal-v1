#!/usr/bin/env tsx
import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from 'dotenv';
import path from 'path';

const execAsync = promisify(exec);

// Load test environment variables
config({ path: path.resolve(process.cwd(), '.env.test') });

const command = process.argv[2];

async function startTestEnvironment() {
  console.log('🚀 Starting test environment...');
  
  try {
    // Start containers
    await execAsync('docker-compose -f docker-compose.test.yml up -d');
    
    // Wait for PostgreSQL to be ready
    console.log('⏳ Waiting for PostgreSQL to be ready...');
    let retries = 30;
    while (retries > 0) {
      try {
        await execAsync('docker exec booking-portal-postgres-test pg_isready -U postgres');
        console.log('✅ PostgreSQL is ready');
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw new Error('PostgreSQL failed to start');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Wait for Redis to be ready
    console.log('⏳ Waiting for Redis to be ready...');
    retries = 30;
    while (retries > 0) {
      try {
        await execAsync('docker exec booking-portal-redis-test redis-cli ping');
        console.log('✅ Redis is ready');
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw new Error('Redis failed to start');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('🎉 Test environment is ready!');
  } catch (error) {
    console.error('❌ Failed to start test environment:', error);
    process.exit(1);
  }
}

async function stopTestEnvironment() {
  console.log('🛑 Stopping test environment...');
  
  try {
    await execAsync('docker-compose -f docker-compose.test.yml down');
    console.log('✅ Test environment stopped');
  } catch (error) {
    console.error('❌ Failed to stop test environment:', error);
    process.exit(1);
  }
}

async function cleanTestEnvironment() {
  console.log('🧹 Cleaning test environment...');
  
  try {
    await execAsync('docker-compose -f docker-compose.test.yml down -v');
    console.log('✅ Test environment cleaned');
  } catch (error) {
    console.error('❌ Failed to clean test environment:', error);
    process.exit(1);
  }
}

async function main() {
  switch (command) {
    case 'start':
      await startTestEnvironment();
      break;
    case 'stop':
      await stopTestEnvironment();
      break;
    case 'clean':
      await cleanTestEnvironment();
      break;
    default:
      console.log(`
Usage: pnpm test:env <command>

Commands:
  start  - Start the test environment containers
  stop   - Stop the test environment containers
  clean  - Stop and remove all test environment data
      `);
      process.exit(1);
  }
}

main().catch(console.error);