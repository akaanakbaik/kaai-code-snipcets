import { pgTable, text, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const snippetStatusEnum = pgEnum("snippet_status", [
  "pending",
  "approved",
  "rejected",
]);

export const snippetsTable = pgTable("snippets", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  language: text("language").notNull(),
  tags: text("tags").array().notNull().default([]),
  code: text("code").notNull(),
  authorName: text("author_name").notNull(),
  authorEmail: text("author_email").notNull(),
  status: snippetStatusEnum("status").notNull().default("pending"),
  rejectReason: text("reject_reason"),
  viewCount: integer("view_count").notNull().default(0),
  copyCount: integer("copy_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSnippetSchema = createInsertSchema(snippetsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertSnippet = z.infer<typeof insertSnippetSchema>;
export type Snippet = typeof snippetsTable.$inferSelect;
