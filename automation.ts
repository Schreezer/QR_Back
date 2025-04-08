import puppeteer, { Browser, Page } from "puppeteer";
import { storage } from "./storage";
import { AutomationStep, automationStep } from "@shared/schema";
import { z } from "zod";

interface BrowserInstance {
  browser: Browser;
  page: Page;
  value: string;
  screenshot?: string;
}

interface AutomationOptions {
  value1: string;
  value2: string;
  formFieldSelector: string;
  submitButtonSelector: string;
  headless: boolean;
  timeout: number;
  autoRetry: boolean;
}

interface AutomationStatus {
  status: "idle" | "running" | "completed" | "error";
  steps: AutomationStep[];
  startTime?: number;
  endTime?: number;
  instances?: Array<{
    id: number;
    value: string;
    status: "loading" | "ready" | "error";
    screenshot?: string;
  }>;
}

class AutomationManager {
  private browserInstances: BrowserInstance[] = [];
  private status: AutomationStatus = {
    status: "idle",
    steps: [],
  };
  private isRunning = false;

  constructor() {
    // Initialize with empty status
    this.resetStatus();
  }

  private resetStatus() {
    this.status = {
      status: "idle",
      steps: [],
    };
    this.browserInstances = [];
    this.isRunning = false;
  }

  getStatus(): AutomationStatus {
    return this.status;
  }

  private updateStep(id: string, update: Partial<AutomationStep>) {
    const stepIndex = this.status.steps.findIndex((step) => step.id === id);
    if (stepIndex !== -1) {
      this.status.steps[stepIndex] = {
        ...this.status.steps[stepIndex],
        ...update,
        time: update.time || new Date().toLocaleTimeString(),
      };
    }
  }

  private async captureScreenshots() {
    const instances = [];
    
    for (let i = 0; i < this.browserInstances.length; i++) {
      const instance = this.browserInstances[i];
      try {
        const screenshot = await instance.page.screenshot({ encoding: "base64" });
        instances.push({
          id: i + 1,
          value: instance.value,
          status: "ready" as const,
          screenshot: screenshot.toString(),
        });
      } catch (error) {
        instances.push({
          id: i + 1,
          value: instance.value,
          status: "error" as const,
        });
      }
    }
    
    this.status.instances = instances;
  }

  async startAutomation(url: string, options: AutomationOptions) {
    if (this.isRunning) {
      throw new Error("Automation is already running");
    }
    
    console.log("Starting automation...");
    this.isRunning = true;
    const startTime = Date.now();
    
    this.status = {
      status: "running",
      steps: [
        {
          id: "scan",
          title: "Scan QR Code",
          description: "Successfully scanned QR code and extracted URL",
          status: "success",
          time: new Date().toLocaleTimeString(),
        },
        {
          id: "browsers",
          title: "Opening browsers",
          description: "Launching two browser instances with the extracted URL",
          status: "in-progress",
          time: new Date().toLocaleTimeString(),
        },
        {
          id: "fill",
          title: "Filling forms",
          description: `Finding text fields and entering values (${options.value1} and ${options.value2})`,
          status: "pending",
        },
        {
          id: "submit",
          title: "Submitting forms",
          description: "Clicking submit buttons on both forms",
          status: "pending",
        },
      ],
      startTime,
      instances: [
        { id: 1, value: options.value1, status: "loading" },
        { id: 2, value: options.value2, status: "loading" },
      ],
    };

    try {
      // Step 1: Launch browsers
      await this.launchBrowsers(url, options);
      console.log("Browsers launched successfully.");

      // Step 2: Fill forms
      await this.fillForms(options);
      console.log("Forms filled successfully.");

      // Step 3: Submit forms
      await this.submitForms(options);
      console.log("Forms submitted successfully.");

      // Complete automation
      this.updateStep("submit", { status: "success" });
      this.status.status = "completed";
      this.status.endTime = Date.now();
      
      console.log("Automation completed successfully.");
      // Final screenshot
      await this.captureScreenshots();
      
      // Record successful automation in history
      await storage.addAutomationHistory({
        url,
        status: "success",
        duration: this.status.endTime - startTime,
        value1: options.value1,
        value2: options.value2,
      });
    } catch (error: any) {
      console.error("Automation error:", error);
      
      // Update status with error
      const failedStepId = this.status.steps.find(step => step.status === "in-progress")?.id || "submit";
      
      this.updateStep(failedStepId, { 
        status: "error",
        errorMessage: error.message,
      });
      
      this.status.status = "error";
      this.status.endTime = Date.now();
      
      // Try to capture screenshots of current state
      try {
        await this.captureScreenshots();
      } catch (screenshotError) {
        console.error("Error capturing error screenshots:", screenshotError);
      }
      
      // Record failed automation in history
      await storage.addAutomationHistory({
        url,
        status: "failed",
        duration: this.status.endTime - startTime,
        errorMessage: error.message,
        value1: options.value1,
        value2: options.value2,
      });
    } finally {
      // Cleanup
      await this.cleanup();
      this.isRunning = false;
    }
  }

  private async launchBrowsers(url: string, options: AutomationOptions) {
    try {
      // Launch first browser
      const browser1 = await puppeteer.launch({
        headless: options.headless,
        timeout: options.timeout,
      });
      const page1 = await browser1.newPage();
      
      // Launch second browser
      const browser2 = await puppeteer.launch({
        headless: options.headless,
        timeout: options.timeout,
      });
      const page2 = await browser2.newPage();
      
      // Navigate to the URL in both browsers
      await Promise.all([
        page1.goto(url, { timeout: options.timeout, waitUntil: "domcontentloaded" }),
        page2.goto(url, { timeout: options.timeout, waitUntil: "domcontentloaded" }),
      ]);
      
      this.browserInstances = [
        { browser: browser1, page: page1, value: options.value1 },
        { browser: browser2, page: page2, value: options.value2 },
      ];
      
      // Update status
      this.updateStep("browsers", { status: "success" });
      this.updateStep("fill", { status: "in-progress", time: new Date().toLocaleTimeString() });
      
      // Capture initial screenshots
      await this.captureScreenshots();
    } catch (error: any) {
      this.updateStep("browsers", { 
        status: "error",
        errorMessage: `Failed to open browsers: ${error.message}`,
      });
      throw new Error(`Failed to open browsers: ${error.message}`);
    }
  }

  private async fillForms(options: AutomationOptions) {
    try {
      // Find form field in both pages and enter values
      await Promise.all(
        this.browserInstances.map(async (instance, index) => {
          try {
            // Wait for loader to disappear
            await instance.page.waitForSelector('.screen-loading', { hidden: true, timeout: options.timeout });

            // Wait for form field to be available
            await instance.page.waitForSelector(options.formFieldSelector, { timeout: options.timeout });
            
            // Fill the form field
            await instance.page.type(options.formFieldSelector, instance.value);
          } catch (error: any) {
            throw new Error(`Failed to fill form in instance ${index + 1}: ${error.message}`);
          }
        })
      );
      
      // Update status
      this.updateStep("fill", { status: "success" });
      this.updateStep("submit", { status: "in-progress", time: new Date().toLocaleTimeString() });
      
      // Capture screenshots after filling
      await this.captureScreenshots();
    } catch (error: any) {
      this.updateStep("fill", { 
        status: "error",
        errorMessage: error.message,
      });
      throw error;
    }
  }

  private async submitForms(options: AutomationOptions) {
    try {
      // Find submit button in both pages and click
      await Promise.all(
        this.browserInstances.map(async (instance, index) => {
          try {
            if (options.submitButtonSelector.startsWith("//")) {
              // XPath selector
              await (instance.page as any).waitForXPath(options.submitButtonSelector, { timeout: options.timeout });
              const elements = await (instance.page as any).$x(options.submitButtonSelector);
              if (elements.length === 0) {
                throw new Error(`No element found for XPath: ${options.submitButtonSelector}`);
              }
              await elements[0].click();
            } else {
              // CSS selector
              await instance.page.waitForSelector(options.submitButtonSelector, { timeout: options.timeout });
              await instance.page.click(options.submitButtonSelector);
            }
            
            // Wait for navigation or a short delay to let the form submit
            try {
              await instance.page.waitForNavigation({ timeout: options.timeout });
            } catch (navError) {
              // If navigation doesn't happen, that's ok, just wait a bit
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (error: any) {
            throw new Error(`Failed to submit form in instance ${index + 1}: ${error.message}`);
          }
        })
      );
      
      // Capture final screenshots
      await this.captureScreenshots();
    } catch (error: any) {
      this.updateStep("submit", { 
        status: "error",
        errorMessage: error.message,
      });
      throw error;
    }
  }

  async cancelAutomation() {
    if (!this.isRunning) {
      return;
    }
    
    const endTime = Date.now();
    const duration = endTime - (this.status.startTime || endTime);
    
    // Update status
    const inProgressStep = this.status.steps.find(step => step.status === "in-progress");
    if (inProgressStep) {
      this.updateStep(inProgressStep.id, { 
        status: "error",
        errorMessage: "Automation cancelled by user",
      });
    }
    
    this.status.status = "error";
    this.status.endTime = endTime;
    
    // Record cancelled automation in history
    try {
      if (this.status.steps.length > 0) {
        const url = this.status.steps[0].description.includes("URL") 
          ? this.status.steps[0].description.split("URL").pop()?.trim() || "unknown"
          : "unknown";
          
        await storage.addAutomationHistory({
          url,
          status: "cancelled",
          duration,
          errorMessage: "Cancelled by user",
          value1: this.browserInstances[0]?.value || "",
          value2: this.browserInstances[1]?.value || "",
        });
      }
    } catch (error) {
      console.error("Error recording cancelled automation:", error);
    }
    
    // Cleanup
    await this.cleanup();
    this.isRunning = false;
  }

  private async cleanup() {
    // Close all browser instances
    for (const instance of this.browserInstances) {
      try {
        await instance.browser.close();
      } catch (error) {
        console.error("Error closing browser:", error);
      }
    }
  }
}

export const automationManager = new AutomationManager();
