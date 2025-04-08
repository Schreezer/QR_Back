import { users, type User, type InsertUser, type AutomationHistory, type InsertAutomationHistory, type Settings, type InsertSettings } from "@shared/schema";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Settings methods
  getSettings(): Promise<Settings>;
  saveSettings(settings: InsertSettings): Promise<Settings>;
  resetSettings(): Promise<Settings>;
  
  // Automation history methods
  getAutomationHistory(): Promise<AutomationHistory[]>;
  addAutomationHistory(history: InsertAutomationHistory): Promise<AutomationHistory>;
  clearAutomationHistory(): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private histories: AutomationHistory[];
  private appSettings: Settings;
  currentId: number;
  private historyId: number;

  constructor() {
    this.users = new Map();
    this.currentId = 1;
    this.historyId = 1;
    this.histories = [];
    this.appSettings = {
      id: 1,
      value1: "14",
      value2: "15",
      headless: true,
      showNotifications: true,
      browserType: "chrome",
      timeout: 30,
      formFieldSelector: '[data-cy="enter-name-field"]',
      submitButtonSelector: '[data-cy="start-game-button"]',
      autoRetry: true,
    };
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  async getSettings(): Promise<Settings> {
    return this.appSettings;
  }
  
  async saveSettings(settings: InsertSettings): Promise<Settings> {
    this.appSettings = { ...this.appSettings, ...settings };
    return this.appSettings;
  }
  
  async resetSettings(): Promise<Settings> {
    this.appSettings = {
      id: 1,
      value1: "14",
      value2: "15",
      headless: true,
      showNotifications: true,
      browserType: "chrome",
      timeout: 30,
      formFieldSelector: '[data-cy="enter-name-field"]',
      submitButtonSelector: '[data-cy="start-game-button"]',
      autoRetry: true,
    };
    return this.appSettings;
  }
  
  async getAutomationHistory(): Promise<AutomationHistory[]> {
    // Return history sorted by date (newest first)
    return [...this.histories].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }
  
  async addAutomationHistory(history: InsertAutomationHistory): Promise<AutomationHistory> {
    const id = this.historyId++;
    const newHistory: AutomationHistory = {
      ...history,
      id,
      date: new Date(),
      errorMessage: history.errorMessage ?? null,
    };
    this.histories.push(newHistory);
    return newHistory;
  }
  
  async clearAutomationHistory(): Promise<void> {
    this.histories = [];
  }
}

export const storage = new MemStorage();
