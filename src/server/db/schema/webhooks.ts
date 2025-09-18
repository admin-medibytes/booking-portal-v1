import { v4 as uuidv4 } from "uuid";
import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const webhookEvents = pgTable('webhook_events', {
  id: text('id').primaryKey().$defaultFn(() => uuidv4()),
  source: text('source').notNull().default('acuity'),
  eventType: text('event_type').notNull(),
  resourceId: text('resource_id').notNull(), // Acuity appointment ID
  payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
  processedAt: timestamp('processed_at'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  sourceIdx: index('webhook_events_source_idx').on(table.source),
  eventTypeIdx: index('webhook_events_event_type_idx').on(table.eventType),
  resourceIdIdx: index('webhook_events_resource_id_idx').on(table.resourceId),
  processedAtIdx: index('webhook_events_processed_at_idx').on(table.processedAt),
  createdAtIdx: index('webhook_events_created_at_idx').on(table.createdAt),
}));