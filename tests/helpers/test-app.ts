import express from "express";
import cors from "cors";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import healthRoutes from "../../src/routes/health.js";
import articlesRoutes from "../../src/routes/articles.js";
import topicsRoutes from "../../src/routes/topics.js";
import discoveriesRoutes from "../../src/routes/discoveries.js";
import discoverRoutes from "../../src/routes/discover.js";
import internalRoutes from "../../src/routes/internal.js";
import { requireIdentity } from "../../src/middleware/identity.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const openapiPath = path.resolve(__dirname, "../../openapi.json");

export const TEST_ORG_ID = "a0000000-0000-0000-0000-000000000001";
export const TEST_USER_ID = "b0000000-0000-0000-0000-000000000001";
export const TEST_RUN_ID = "c0000000-0000-0000-0000-000000000001";
export const TEST_FEATURE_SLUG = "test-feature";
export const TEST_BRAND_ID = "e0000000-0000-4000-8000-000000000001";
export const TEST_CAMPAIGN_ID = "f0000000-0000-4000-8000-000000000001";
export const TEST_WORKFLOW_SLUG = "test-workflow";

export function createTestApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get("/openapi.json", (_req, res) => {
    if (existsSync(openapiPath)) {
      res.json(JSON.parse(readFileSync(openapiPath, "utf-8")));
    } else {
      res.status(404).json({ error: "OpenAPI spec not found. Run: npm run generate:openapi" });
    }
  });
  app.use(healthRoutes);
  app.use(requireIdentity);
  app.use(articlesRoutes);
  app.use(topicsRoutes);
  app.use(discoveriesRoutes);
  app.use(discoverRoutes);
  app.use(internalRoutes);
  app.use((_req: express.Request, res: express.Response) => {
    res.status(404).json({ error: "Not found" });
  });
  return app;
}

export function getIdentityHeaders() {
  return {
    "x-org-id": TEST_ORG_ID,
    "x-user-id": TEST_USER_ID,
    "x-run-id": TEST_RUN_ID,
    "x-workflow-slug": TEST_WORKFLOW_SLUG,
    "x-feature-slug": TEST_FEATURE_SLUG,
    "x-brand-id": TEST_BRAND_ID,
    "x-campaign-id": TEST_CAMPAIGN_ID,
  };
}

export function getAuthHeaders() {
  return {
    "X-API-Key": "test-api-key",
    "Content-Type": "application/json",
    "x-org-id": TEST_ORG_ID,
    "x-user-id": TEST_USER_ID,
    "x-run-id": TEST_RUN_ID,
    "x-workflow-slug": TEST_WORKFLOW_SLUG,
    "x-feature-slug": TEST_FEATURE_SLUG,
    "x-brand-id": TEST_BRAND_ID,
    "x-campaign-id": TEST_CAMPAIGN_ID,
  };
}
