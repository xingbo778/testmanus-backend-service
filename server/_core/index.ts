import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";

import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function autoSeedOnStartup() {
  // Seed system prompts
  try {
    const { seedSystemPrompts, listSystemPrompts } = await import("../db");
    const { DEFAULT_SYSTEM_PROMPTS } = await import("../seed-prompts");
    const existing = await listSystemPrompts();
    if (!existing || existing.length === 0) {
      console.log("[AutoSeed] No system prompts found, seeding defaults...");
      await seedSystemPrompts(DEFAULT_SYSTEM_PROMPTS);
      console.log(`[AutoSeed] Seeded ${DEFAULT_SYSTEM_PROMPTS.length} system prompts`);
    }
  } catch (e) {
    console.warn("[AutoSeed] Failed to auto-seed system prompts:", e);
  }

  // Seed categories (upsert - safe to run every startup)
  try {
    const { seedCategories } = await import("../db");
    const { CATEGORY_SEED } = await import("../seed-categories");
    console.log("[AutoSeed] Seeding categories (upsert)...");
    await seedCategories(CATEGORY_SEED);
    console.log(`[AutoSeed] Seeded ${CATEGORY_SEED.l1.length} L1, ${CATEGORY_SEED.l2.length} L2, ${CATEGORY_SEED.l3.length} L3 categories`);
  } catch (e) {
    console.warn("[AutoSeed] Failed to auto-seed categories:", e);
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Image proxy for CORS-restricted external images (e.g., ToAPIs)
  app.get("/api/image-proxy", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url || (!url.startsWith("https://") && !url.startsWith("http://"))) {
        return res.status(400).json({ error: "Invalid URL" });
      }
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).json({ error: "Upstream fetch failed" });
      }
      const contentType = response.headers.get("content-type") || "image/png";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      const buffer = Buffer.from(await response.arrayBuffer());
      res.send(buffer);
    } catch (e) {
      res.status(500).json({ error: "Proxy error" });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Auto-seed system prompts on startup (non-blocking)
    autoSeedOnStartup();
  });
}

startServer().catch(console.error);
