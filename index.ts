import express, { type Request, Response, NextFunction, type Express } from "express";
import { type Server } from "http";
import { registerRoutes } from "./routes";

// Initialize with no-op functions that will be replaced
let setupVite: (app: Express, server: Server) => Promise<void> = async () => {};
let serveStatic: (app: Express) => void = () => {};
let log: (message: string, source?: string) => void = () => {};

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Dynamic imports based on environment
async function loadViteModule() {
  if (process.env.NODE_ENV === "production") {
    const prod = await import("./vite.prod");
    setupVite = prod.setupVite;
    serveStatic = prod.serveStatic;
    log = prod.log;
  } else {
    const dev = await import("./vite");
    setupVite = dev.setupVite;
    serveStatic = dev.serveStatic;
    log = dev.log;
  }
}

(async () => {
  await loadViteModule();
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5001;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
