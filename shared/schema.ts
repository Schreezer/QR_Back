import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Automation history schema
export const automationHistory = pgTable("automation_history", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  status: text("status").notNull(), // "success", "failed", "cancelled"
  date: timestamp("date").defaultNow().notNull(),
  duration: integer("duration").notNull(), // in milliseconds
  errorMessage: text("error_message"),
  value1: text("value1").notNull(),
  value2: text("value2").notNull(),
});

export const insertAutomationHistorySchema = createInsertSchema(automationHistory).omit({
  id: true,
  date: true,
});

export type InsertAutomationHistory = z.infer<typeof insertAutomationHistorySchema>;
export type AutomationHistory = typeof automationHistory.$inferSelect;

// Settings schema
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  value1: text("value1").notNull().default("14"),
  value2: text("value2").notNull().default("15"),
  headless: boolean("headless").notNull().default(true),
  showNotifications: boolean("show_notifications").notNull().default(true),
  browserType: text("browser_type").notNull().default("chrome"),
  timeout: integer("timeout").notNull().default(30),
  formFieldSelector: text("form_field_selector").notNull().default("input[type='text']"),
  submitButtonSelector: text("submit_button_selector").notNull().default("button[type='submit'], input[type='submit']"),
  autoRetry: boolean("auto_retry").notNull().default(true),
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
});

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

// Automation status step type
export const automationStepStatus = z.enum(["pending", "in-progress", "success", "error"]);
export type AutomationStepStatus = z.infer<typeof automationStepStatus>;

export const automationStep = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: automationStepStatus,
  time: z.string().optional(),
  errorMessage: z.string().optional(),
});
export type AutomationStep = z.infer<typeof automationStep>;
