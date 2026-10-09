// SPDX-License-Identifier: Apache-2.0
import { Hono } from "hono";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";
import { filesRoute } from "./routes/files.js";
import { searchRoute } from "./routes/search.js";
import { graphRoute } from "./routes/graph.js";
import { validateVault } from "./services/vault.js";
import { initialBuild, startWatching } from "./rebuild.js";

const app = new Hono()
  .use(logger())
  .use(async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:",
    );
  })
  .get("/health", (c) => c.json({ status: "ok" }))
  .route("/api/files", filesRoute)
  .route("/api/search", searchRoute)
  .route("/api/graph", graphRoute)
  // Serve built React frontend in production
  .use("/*", serveStatic({ root: "./build" }))
  // SPA fallback — serve index.html for client-side routes
  .get("/*", async (c) => {
    const html = await Bun.file("./build/index.html").text();
    return c.html(html);
  });

// Startup: validate vault and build indexes
if (import.meta.main) {
  await validateVault();
  await initialBuild();
  startWatching();
  console.log("Watching the vault for changes");
}

export default {
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
};
