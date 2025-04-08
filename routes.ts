import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { automationManager } from "./automation";
import { insertAutomationHistorySchema, insertSettingsSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get current settings
  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error getting settings:", error);
      res.status(500).json({ message: "Failed to get settings" });
    }
  });

  // Save settings
  app.post("/api/settings", async (req, res) => {
    try {
      const settings = insertSettingsSchema.parse(req.body);
      const savedSettings = await storage.saveSettings(settings);
      res.json(savedSettings);
    } catch (error) {
      console.error("Error saving settings:", error);
      res.status(400).json({ message: "Invalid settings data" });
    }
  });

  // Reset settings to defaults
  app.post("/api/settings/reset", async (_req, res) => {
    try {
      const defaultSettings = await storage.resetSettings();
      res.json(defaultSettings);
    } catch (error) {
      console.error("Error resetting settings:", error);
      res.status(500).json({ message: "Failed to reset settings" });
    }
  });

  // Get automation history
  app.get("/api/automation/history", async (_req, res) => {
    try {
      const history = await storage.getAutomationHistory();
      res.json(history);
    } catch (error) {
      console.error("Error getting automation history:", error);
      res.status(500).json({ message: "Failed to get automation history" });
    }
  });

  // Clear automation history
  app.delete("/api/automation/history", async (_req, res) => {
    try {
      await storage.clearAutomationHistory();
      res.json({ message: "Automation history cleared" });
    } catch (error) {
      console.error("Error clearing automation history:", error);
      res.status(500).json({ message: "Failed to clear automation history" });
    }
  });

  // Start automation
  app.post("/api/automation/start", async (req, res) => {
    try {
      const schema = z.object({
        url: z.string().url(),
        value1: z.string(),
        value2: z.string(),
      });

      const { url, value1, value2 } = schema.parse(req.body);
      
      const settings = await storage.getSettings();
      
      await automationManager.startAutomation(url, {
        value1,
        value2,
        formFieldSelector: settings.formFieldSelector,
        submitButtonSelector: settings.submitButtonSelector,
        headless: settings.headless,
        timeout: settings.timeout * 1000, // Convert to milliseconds
        autoRetry: settings.autoRetry,
      });
      
      res.json({ message: "Automation started" });
    } catch (error: any) {
      console.error("Error starting automation:", error);
      
      const errorMessage = error.message || "Failed to start automation";
      
      // Record failed automation in history
      try {
        await storage.addAutomationHistory({
          url: req.body?.url || "unknown",
          status: "failed",
          duration: 0,
          errorMessage,
          value1: req.body?.value1 || "",
          value2: req.body?.value2 || "",
        });
      } catch (historyError) {
        console.error("Error recording failed automation:", historyError);
      }
      
      res.status(400).json({ message: errorMessage });
    }
  });

  // Get automation status
  app.get("/api/automation/status", (_req, res) => {
    try {
      const status = automationManager.getStatus();
      res.json(status);
    } catch (error) {
      console.error("Error getting automation status:", error);
      res.status(500).json({ message: "Failed to get automation status" });
    }
  });

  // Cancel automation
  app.post("/api/automation/cancel", async (_req, res) => {
    try {
      await automationManager.cancelAutomation();
      res.json({ message: "Automation cancelled" });
    } catch (error) {
      console.error("Error cancelling automation:", error);
      res.status(500).json({ message: "Failed to cancel automation" });
    }
  });

  const httpServer = createServer(app);
  
  return httpServer;
}
