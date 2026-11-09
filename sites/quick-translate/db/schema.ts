import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const channels = sqliteTable(
  "channels",
  {
    codeHash: text("code_hash").primaryKey(),
    createdAt: integer("created_at").notNull(),
    lastActivityAt: integer("last_activity_at").notNull(),
  },
  (table) => [index("channels_last_activity_idx").on(table.lastActivityAt)]
);

export const channelText = sqliteTable(
  "channel_text",
  {
    codeHash: text("code_hash")
      .primaryKey()
      .references(() => channels.codeHash, { onDelete: "cascade" }),
    content: text("content").notNull(),
    language: text("language"),
    updatedAt: integer("updated_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("channel_text_expiry_idx").on(table.expiresAt)]
);

export const rateLimits = sqliteTable("rate_limits", {
  keyHash: text("key_hash").primaryKey(),
  windowStartedAt: integer("window_started_at").notNull(),
  requestCount: integer("request_count").notNull(),
});
