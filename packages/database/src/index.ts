import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { drizzle } from 'drizzle-orm/d1';
import type { D1Database } from '@cloudflare/workers-types';

import * as schema from './schema';

export { schema };

export type Database = DrizzleD1Database<typeof schema>;

export function createDatabase(d1: D1Database): Database {
  return drizzle(d1, { schema });
}

// Re-export all schemas for type inference
export * from './schema';

// Re-export repositories
export * from './repositories';
