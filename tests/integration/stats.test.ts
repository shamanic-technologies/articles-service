import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import {
  createTestApp,
  getAuthHeaders,
  getIdentityHeaders,
  TEST_ORG_ID,
  TEST_BRAND_ID,
  TEST_CAMPAIGN_ID,
  TEST_FEATURE_SLUG,
  TEST_WORKFLOW_SLUG,
} from "../helpers/test-app.js";
import { cleanTestData, insertTestArticle, insertTestDiscovery, closeDb } from "../helpers/test-db.js";

// Mock dynasty service to avoid real HTTP calls
vi.mock("../../src/services/dynasty.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/services/dynasty.js")>();
  return {
    ...actual,
    resolveWorkflowDynastySlugs: vi.fn().mockResolvedValue([]),
    resolveFeatureDynastySlugs: vi.fn().mockResolvedValue([]),
    fetchAllWorkflowDynasties: vi.fn().mockResolvedValue([]),
    fetchAllFeatureDynasties: vi.fn().mockResolvedValue([]),
  };
});

import {
  resolveWorkflowDynastySlugs,
  resolveFeatureDynastySlugs,
  fetchAllWorkflowDynasties,
  fetchAllFeatureDynasties,
} from "../../src/services/dynasty.js";

const mockResolveWorkflow = vi.mocked(resolveWorkflowDynastySlugs);
const mockResolveFeature = vi.mocked(resolveFeatureDynastySlugs);
const mockFetchWorkflowDynasties = vi.mocked(fetchAllWorkflowDynasties);
const mockFetchFeatureDynasties = vi.mocked(fetchAllFeatureDynasties);

const app = createTestApp();

const OTHER_BRAND_ID = "e0000000-0000-4000-8000-000000000099";
const OTHER_CAMPAIGN_ID = "f0000000-0000-4000-8000-000000000099";
const OUTLET_1 = "d0000000-0000-4000-8000-000000000001";
const OUTLET_2 = "d0000000-0000-4000-8000-000000000002";
const JOURNALIST_1 = "d0000000-0000-4000-8000-000000000011";

beforeEach(async () => {
  await cleanTestData();
  vi.clearAllMocks();
});

afterAll(async () => {
  await cleanTestData();
  await closeDb();
});

async function seedDiscoveries() {
  const a1 = await insertTestArticle({ articleUrl: "https://example.com/1" });
  const a2 = await insertTestArticle({ articleUrl: "https://example.com/2" });
  const a3 = await insertTestArticle({ articleUrl: "https://example.com/3" });

  await insertTestDiscovery({
    articleId: a1.id,
    orgId: TEST_ORG_ID,
    brandIds: [TEST_BRAND_ID],
    featureSlug: TEST_FEATURE_SLUG,
    workflowSlug: TEST_WORKFLOW_SLUG,
    campaignId: TEST_CAMPAIGN_ID,
    outletId: OUTLET_1,
    journalistId: JOURNALIST_1,
  });

  await insertTestDiscovery({
    articleId: a2.id,
    orgId: TEST_ORG_ID,
    brandIds: [TEST_BRAND_ID],
    featureSlug: "other-feature",
    workflowSlug: "other-workflow",
    campaignId: TEST_CAMPAIGN_ID,
    outletId: OUTLET_2,
  });

  await insertTestDiscovery({
    articleId: a3.id,
    orgId: TEST_ORG_ID,
    brandIds: [OTHER_BRAND_ID],
    featureSlug: TEST_FEATURE_SLUG,
    workflowSlug: TEST_WORKFLOW_SLUG,
    campaignId: OTHER_CAMPAIGN_ID,
  });

  return { a1, a2, a3 };
}

describe("GET /v1/stats", () => {
  it("returns flat stats with no filters", async () => {
    await seedDiscoveries();

    const res = await request(app).get("/v1/stats").set(getIdentityHeaders());
    expect(res.status).toBe(200);
    expect(res.body.stats.totalDiscoveries).toBe(3);
    expect(res.body.stats.uniqueArticles).toBe(3);
    expect(res.body.stats.uniqueOutlets).toBe(2);
    expect(res.body.stats.uniqueJournalists).toBe(1);
  });

  it("returns zero stats when no data exists", async () => {
    const res = await request(app).get("/v1/stats").set(getIdentityHeaders());
    expect(res.status).toBe(200);
    expect(res.body.stats.totalDiscoveries).toBe(0);
    expect(res.body.stats.uniqueArticles).toBe(0);
  });

  it("requires identity headers", async () => {
    const res = await request(app).get("/v1/stats");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Missing required headers");
  });

  it("filters by featureSlug", async () => {
    await seedDiscoveries();

    const res = await request(app)
      .get(`/v1/stats?featureSlug=${TEST_FEATURE_SLUG}`)
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.stats.totalDiscoveries).toBe(2);
  });

  it("filters by workflowSlug", async () => {
    await seedDiscoveries();

    const res = await request(app)
      .get(`/v1/stats?workflowSlug=${TEST_WORKFLOW_SLUG}`)
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.stats.totalDiscoveries).toBe(2);
  });

  it("filters by brandId", async () => {
    await seedDiscoveries();

    const res = await request(app)
      .get(`/v1/stats?brandId=${TEST_BRAND_ID}`)
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.stats.totalDiscoveries).toBe(2);
  });

  it("filters by campaignId", async () => {
    await seedDiscoveries();

    const res = await request(app)
      .get(`/v1/stats?campaignId=${TEST_CAMPAIGN_ID}`)
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.stats.totalDiscoveries).toBe(2);
  });

  it("combines multiple filters", async () => {
    await seedDiscoveries();

    const res = await request(app)
      .get(`/v1/stats?brandId=${TEST_BRAND_ID}&featureSlug=${TEST_FEATURE_SLUG}`)
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.stats.totalDiscoveries).toBe(1);
  });

  it("filters by featureDynastySlug", async () => {
    await seedDiscoveries();
    mockResolveFeature.mockResolvedValue([TEST_FEATURE_SLUG, "other-feature"]);

    const res = await request(app)
      .get("/v1/stats?featureDynastySlug=test-dynasty")
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.stats.totalDiscoveries).toBe(3);
    expect(mockResolveFeature).toHaveBeenCalledWith("test-dynasty", expect.any(Object));
  });

  it("filters by workflowDynastySlug", async () => {
    await seedDiscoveries();
    mockResolveWorkflow.mockResolvedValue([TEST_WORKFLOW_SLUG]);

    const res = await request(app)
      .get("/v1/stats?workflowDynastySlug=test-wf-dynasty")
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.stats.totalDiscoveries).toBe(2);
  });

  it("returns zero stats when dynasty resolves to empty list", async () => {
    await seedDiscoveries();
    mockResolveFeature.mockResolvedValue([]);

    const res = await request(app)
      .get("/v1/stats?featureDynastySlug=nonexistent")
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.stats.totalDiscoveries).toBe(0);
  });

  it("dynasty slug filter takes priority over exact slug", async () => {
    await seedDiscoveries();
    mockResolveFeature.mockResolvedValue(["other-feature"]);

    const res = await request(app)
      .get(`/v1/stats?featureSlug=${TEST_FEATURE_SLUG}&featureDynastySlug=other-dynasty`)
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    // Dynasty resolves to "other-feature" which should override the featureSlug filter
    expect(res.body.stats.totalDiscoveries).toBe(1);
  });
});

describe("GET /v1/stats groupBy", () => {
  it("groups by featureSlug", async () => {
    await seedDiscoveries();

    const res = await request(app)
      .get("/v1/stats?groupBy=featureSlug")
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.groups).toBeDefined();
    expect(res.body.groups.length).toBe(2);

    const testGroup = res.body.groups.find((g: { key: string }) => g.key === TEST_FEATURE_SLUG);
    expect(testGroup).toBeDefined();
    expect(testGroup.stats.totalDiscoveries).toBe(2);
  });

  it("groups by workflowSlug", async () => {
    await seedDiscoveries();

    const res = await request(app)
      .get("/v1/stats?groupBy=workflowSlug")
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.groups).toBeDefined();
    expect(res.body.groups.length).toBeGreaterThanOrEqual(2);
  });

  it("groups by brandId", async () => {
    await seedDiscoveries();

    const res = await request(app)
      .get("/v1/stats?groupBy=brandId")
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.groups).toBeDefined();
    expect(res.body.groups.length).toBe(2);
  });

  it("groups by campaignId", async () => {
    await seedDiscoveries();

    const res = await request(app)
      .get("/v1/stats?groupBy=campaignId")
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.groups).toBeDefined();
    expect(res.body.groups.length).toBe(2);
  });

  it("groups by workflowDynastySlug with reverse map", async () => {
    await seedDiscoveries();
    mockFetchWorkflowDynasties.mockResolvedValue([
      { dynastySlug: "wf-dynasty", slugs: [TEST_WORKFLOW_SLUG, "other-workflow"] },
    ]);

    const res = await request(app)
      .get("/v1/stats?groupBy=workflowDynastySlug")
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.groups).toBeDefined();
    // Both workflows map to same dynasty → single group
    expect(res.body.groups.length).toBe(1);
    expect(res.body.groups[0].key).toBe("wf-dynasty");
    expect(res.body.groups[0].stats.totalDiscoveries).toBe(3);
  });

  it("groups by featureDynastySlug with reverse map", async () => {
    await seedDiscoveries();
    mockFetchFeatureDynasties.mockResolvedValue([
      { dynastySlug: "feat-dynasty", slugs: [TEST_FEATURE_SLUG] },
    ]);

    const res = await request(app)
      .get("/v1/stats?groupBy=featureDynastySlug")
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.groups).toBeDefined();
    // test-feature maps to feat-dynasty, "other-feature" has no dynasty → falls back to raw slug
    const dynastyGroup = res.body.groups.find((g: { key: string }) => g.key === "feat-dynasty");
    const orphanGroup = res.body.groups.find((g: { key: string }) => g.key === "other-feature");
    expect(dynastyGroup).toBeDefined();
    expect(dynastyGroup.stats.totalDiscoveries).toBe(2);
    expect(orphanGroup).toBeDefined();
    expect(orphanGroup.stats.totalDiscoveries).toBe(1);
  });

  it("orphan slugs fall back to raw slug in dynasty groupBy", async () => {
    await seedDiscoveries();
    // Return empty dynasties so all slugs are orphans
    mockFetchWorkflowDynasties.mockResolvedValue([]);

    const res = await request(app)
      .get("/v1/stats?groupBy=workflowDynastySlug")
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    // Each unique workflowSlug becomes its own group
    expect(res.body.groups.length).toBeGreaterThanOrEqual(2);
    const slugKeys = res.body.groups.map((g: { key: string }) => g.key);
    expect(slugKeys).toContain(TEST_WORKFLOW_SLUG);
    expect(slugKeys).toContain("other-workflow");
  });
});

describe("GET /v1/stats/public", () => {
  it("returns stats with API key only (no identity headers)", async () => {
    await seedDiscoveries();

    const res = await request(app)
      .get("/v1/stats/public")
      .set({ "X-API-Key": "test-api-key" });

    expect(res.status).toBe(200);
    expect(res.body.stats.totalDiscoveries).toBe(3);
  });

  it("returns 401 without API key", async () => {
    const res = await request(app).get("/v1/stats/public");
    expect(res.status).toBe(401);
  });

  it("supports filters", async () => {
    await seedDiscoveries();

    const res = await request(app)
      .get(`/v1/stats/public?brandId=${TEST_BRAND_ID}`)
      .set({ "X-API-Key": "test-api-key" });

    expect(res.status).toBe(200);
    expect(res.body.stats.totalDiscoveries).toBe(2);
  });

  it("supports groupBy", async () => {
    await seedDiscoveries();

    const res = await request(app)
      .get("/v1/stats/public?groupBy=featureSlug")
      .set({ "X-API-Key": "test-api-key" });

    expect(res.status).toBe(200);
    expect(res.body.groups).toBeDefined();
    expect(res.body.groups.length).toBe(2);
  });

  it("supports dynasty slug filters", async () => {
    await seedDiscoveries();
    mockResolveWorkflow.mockResolvedValue([TEST_WORKFLOW_SLUG]);

    const res = await request(app)
      .get("/v1/stats/public?workflowDynastySlug=test-dynasty")
      .set({ "X-API-Key": "test-api-key" });

    expect(res.status).toBe(200);
    expect(res.body.stats.totalDiscoveries).toBe(2);
  });

  it("returns empty groups when dynasty resolves to empty", async () => {
    await seedDiscoveries();
    mockResolveFeature.mockResolvedValue([]);

    const res = await request(app)
      .get("/v1/stats/public?featureDynastySlug=nonexistent&groupBy=featureSlug")
      .set({ "X-API-Key": "test-api-key" });

    expect(res.status).toBe(200);
    expect(res.body.groups).toEqual([]);
  });
});
