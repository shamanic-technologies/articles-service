import express from "express";
import cors from "cors";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import healthRoutes from "./routes/health.js";
import articlesRoutes from "./routes/articles.js";
import topicsRoutes from "./routes/topics.js";
import discoveriesRoutes from "./routes/discoveries.js";
import discoverRoutes from "./routes/discover.js";
import internalRoutes from "./routes/internal.js";
import statsRoutes from "./routes/stats.js";
import { requireIdentity } from "./middleware/identity.js";
import { db } from "./db/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3012;

app.use(cors());
app.use(express.json());

app.get("/openapi.json", async (_req, res) => {
  try {
    const specPath = path.resolve(__dirname, "../openapi.json");
    const spec = await readFile(specPath, "utf-8");
    res.json(JSON.parse(spec));
  } catch {
    res.status(404).json({ error: "OpenAPI spec not found. Run: npm run generate:openapi" });
  }
});

// Routes exempt from identity headers
app.use(healthRoutes);
// Stats routes handle their own auth (public = API key only, private = identity headers)
app.use(statsRoutes);

// All routes below require x-org-id, x-user-id, and x-run-id headers
app.use(requireIdentity);
app.use(articlesRoutes);
app.use(topicsRoutes);
app.use(discoveriesRoutes);
app.use(discoverRoutes);
app.use(internalRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Only start server if not in test environment
if (process.env.NODE_ENV !== "test") {
  migrate(db, { migrationsFolder: "./drizzle" })
    .then(() => {
      console.log("[Articles Service] Migrations complete");
      app.listen(Number(PORT), "::", () => {
        console.log(`[Articles Service] Service running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error("[Articles Service] Migration failed:", err);
      process.exit(1);
    });
}

export default app;
