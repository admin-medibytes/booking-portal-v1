import { pgTable, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './auth';

export const specialists = pgTable('specialists', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  acuityCalendarId: text('acuity_calendar_id').notNull().unique(),
  name: text('name').notNull(),
  specialty: text('specialty').notNull(),
  location: text('location'), // NULL for telehealth-only
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('specialists_user_id_idx').on(table.userId),
  acuityCalendarIdIdx: index('specialists_acuity_calendar_id_idx').on(table.acuityCalendarId),
  isActiveIdx: index('specialists_is_active_idx').on(table.isActive),
}));

export const specialistsRelations = relations(specialists, ({ one }) => ({
  user: one(users, {
    fields: [specialists.userId],
    references: [users.id],
  }),
}));