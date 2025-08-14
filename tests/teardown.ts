import { closeTestDb } from './integration/db/test-utils';

export async function teardown() {
  console.log('\n🧹 Cleaning up test environment...');
  
  // Close database connections
  await closeTestDb();
  
  console.log('✅ Test cleanup complete');
}