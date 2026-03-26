import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestApp, TEST_ORG_ID, TEST_USER_ID, TEST_RUN_ID, TEST_FEATURE_SLUG, TEST_CAMPAIGN_ID } from "../helpers/test-app.js";

const app = createTestApp();

describe("Identity middleware", () => {
  it("returns 400 when all identity headers are missing", async () => {
    const res = await request(app).get("/v1/articles");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("x-org-id");
    expect(res.body.error).toContain("x-run-id");
  });

  it("returns 400 when x-org-id is missing", async () => {
    const res = await request(app)
      .get("/v1/articles")
      .set({ "x-user-id": TEST_USER_ID, "x-run-id": TEST_RUN_ID });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Missing required headers");
  });

  it("returns 400 when x-user-id is missing", async () => {
    const res = await request(app)
      .get("/v1/articles")
      .set({ "x-org-id": TEST_ORG_ID, "x-run-id": TEST_RUN_ID });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Missing required headers");
  });

  it("returns 400 when x-run-id is missing", async () => {
    const res = await request(app)
      .get("/v1/articles")
      .set({ "x-org-id": TEST_ORG_ID, "x-user-id": TEST_USER_ID });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Missing required headers");
  });

  it("returns 400 when x-org-id is not a valid UUID", async () => {
    const res = await request(app)
      .get("/v1/articles")
      .set({ "x-org-id": "not-a-uuid", "x-user-id": TEST_USER_ID, "x-run-id": TEST_RUN_ID });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("valid UUIDs");
  });

  it("returns 400 when x-user-id is not a valid UUID", async () => {
    const res = await request(app)
      .get("/v1/articles")
      .set({ "x-org-id": TEST_ORG_ID, "x-user-id": "not-a-uuid", "x-run-id": TEST_RUN_ID });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("valid UUIDs");
  });

  it("returns 400 when x-run-id is not a valid UUID", async () => {
    const res = await request(app)
      .get("/v1/articles")
      .set({ "x-org-id": TEST_ORG_ID, "x-user-id": TEST_USER_ID, "x-run-id": "not-a-uuid" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("valid UUIDs");
  });

  it("does not require identity headers for /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });

  it("does not require identity headers for /openapi.json", async () => {
    const res = await request(app).get("/openapi.json");
    // 200 or 404 (if spec file doesn't exist) — either way, not 400
    expect(res.status).not.toBe(400);
  });

  it("passes through with valid identity headers (not rejected by middleware)", async () => {
    const res = await request(app)
      .get("/v1/articles")
      .set({ "x-org-id": TEST_ORG_ID, "x-user-id": TEST_USER_ID, "x-run-id": TEST_RUN_ID });
    // Should not be 400 — the identity middleware accepted the headers.
    // May be 200 (with DB) or 500 (without DB) depending on test environment.
    expect(res.status).not.toBe(400);
  });

  it("passes through with valid identity headers including x-feature-slug", async () => {
    const res = await request(app)
      .get("/v1/articles")
      .set({ "x-org-id": TEST_ORG_ID, "x-user-id": TEST_USER_ID, "x-run-id": TEST_RUN_ID, "x-feature-slug": TEST_FEATURE_SLUG });
    expect(res.status).not.toBe(400);
  });

  it("passes through without x-feature-slug (it is optional)", async () => {
    const res = await request(app)
      .get("/v1/articles")
      .set({ "x-org-id": TEST_ORG_ID, "x-user-id": TEST_USER_ID, "x-run-id": TEST_RUN_ID });
    expect(res.status).not.toBe(400);
  });

  it("returns 400 when x-feature-slug is empty string", async () => {
    const res = await request(app)
      .get("/v1/articles")
      .set({ "x-org-id": TEST_ORG_ID, "x-user-id": TEST_USER_ID, "x-run-id": TEST_RUN_ID, "x-feature-slug": "" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("x-feature-slug");
  });

  it("passes through with valid x-campaign-id", async () => {
    const res = await request(app)
      .get("/v1/articles")
      .set({ "x-org-id": TEST_ORG_ID, "x-user-id": TEST_USER_ID, "x-run-id": TEST_RUN_ID, "x-campaign-id": TEST_CAMPAIGN_ID });
    expect(res.status).not.toBe(400);
  });

  it("passes through without x-campaign-id (it is optional)", async () => {
    const res = await request(app)
      .get("/v1/articles")
      .set({ "x-org-id": TEST_ORG_ID, "x-user-id": TEST_USER_ID, "x-run-id": TEST_RUN_ID });
    expect(res.status).not.toBe(400);
  });

  it("returns 400 when x-campaign-id is not a valid UUID", async () => {
    const res = await request(app)
      .get("/v1/articles")
      .set({ "x-org-id": TEST_ORG_ID, "x-user-id": TEST_USER_ID, "x-run-id": TEST_RUN_ID, "x-campaign-id": "not-a-uuid" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("x-campaign-id");
  });
});
