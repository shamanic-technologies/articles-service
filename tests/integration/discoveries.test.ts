import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createTestApp, getAuthHeaders, getIdentityHeaders, TEST_ORG_ID, TEST_BRAND_ID, TEST_CAMPAIGN_ID, TEST_FEATURE_SLUG } from "../helpers/test-app.js";
import { cleanTestData, insertTestArticle, insertTestDiscovery, closeDb } from "../helpers/test-db.js";

const app = createTestApp();

beforeEach(async () => {
  await cleanTestData();
});

afterAll(async () => {
  await cleanTestData();
  await closeDb();
});

describe("POST /v1/discoveries", () => {
  it("creates a discovery record", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/1", ogTitle: "Test" });

    const res = await request(app)
      .post("/v1/discoveries")
      .set(getAuthHeaders())
      .send({ articleId: article.id });

    expect(res.status).toBe(200);
    expect(res.body.articleId).toBe(article.id);
    expect(res.body.orgId).toBe(TEST_ORG_ID);
    expect(res.body.brandIds).toEqual([TEST_BRAND_ID]);
    expect(res.body.featureSlug).toBe(TEST_FEATURE_SLUG);
    expect(res.body.campaignId).toBe(TEST_CAMPAIGN_ID);
    expect(res.body.id).toBeDefined();
  });

  it("creates a discovery with optional outlet and journalist", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/1" });
    const outletId = "d0000000-0000-4000-8000-000000000001";
    const journalistId = "d0000000-0000-4000-8000-000000000002";

    const res = await request(app)
      .post("/v1/discoveries")
      .set(getAuthHeaders())
      .send({ articleId: article.id, outletId, journalistId });

    expect(res.status).toBe(200);
    expect(res.body.outletId).toBe(outletId);
    expect(res.body.journalistId).toBe(journalistId);
  });

  it("returns 401 without API key", async () => {
    const res = await request(app)
      .post("/v1/discoveries")
      .set(getIdentityHeaders())
      .send({ articleId: "550e8400-e29b-41d4-a716-446655440000" });

    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    const res = await request(app)
      .post("/v1/discoveries")
      .set(getAuthHeaders())
      .send({});

    expect(res.status).toBe(400);
  });

  it("returns 400 when x-brand-id header is missing", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/1" });
    const headers = { ...getAuthHeaders() };
    delete (headers as Record<string, string>)["x-brand-id"];

    const res = await request(app)
      .post("/v1/discoveries")
      .set(headers)
      .send({ articleId: article.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("x-brand-id");
  });

  it("returns 400 when x-campaign-id header is missing", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/1" });
    const headers = { ...getAuthHeaders() };
    delete (headers as Record<string, string>)["x-campaign-id"];

    const res = await request(app)
      .post("/v1/discoveries")
      .set(headers)
      .send({ articleId: article.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("x-campaign-id");
  });
});

describe("POST /v1/discoveries/bulk", () => {
  it("bulk creates discoveries", async () => {
    const article1 = await insertTestArticle({ articleUrl: "https://example.com/1" });
    const article2 = await insertTestArticle({ articleUrl: "https://example.com/2" });

    const res = await request(app)
      .post("/v1/discoveries/bulk")
      .set(getAuthHeaders())
      .send({
        discoveries: [
          { articleId: article1.id },
          { articleId: article2.id },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.discoveries).toHaveLength(2);
    expect(res.body.discoveries[0].brandIds).toEqual([TEST_BRAND_ID]);
    expect(res.body.discoveries[0].campaignId).toBe(TEST_CAMPAIGN_ID);
  });

  it("handles empty array", async () => {
    const res = await request(app)
      .post("/v1/discoveries/bulk")
      .set(getAuthHeaders())
      .send({ discoveries: [] });

    expect(res.status).toBe(200);
    expect(res.body.discoveries).toHaveLength(0);
  });

  it("returns 400 when x-brand-id header is missing", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/1" });
    const headers = { ...getAuthHeaders() };
    delete (headers as Record<string, string>)["x-brand-id"];

    const res = await request(app)
      .post("/v1/discoveries/bulk")
      .set(headers)
      .send({ discoveries: [{ articleId: article.id }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("x-brand-id");
  });
});

describe("GET /v1/discoveries", () => {
  it("lists discoveries for the org with article data", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/1", ogTitle: "Test" });
    await insertTestDiscovery({
      articleId: article.id,
      orgId: TEST_ORG_ID,
      brandIds: [TEST_BRAND_ID],
      featureSlug: TEST_FEATURE_SLUG,
      campaignId: TEST_CAMPAIGN_ID,
    });

    const res = await request(app).get("/v1/discoveries").set(getIdentityHeaders());
    expect(res.status).toBe(200);
    expect(res.body.discoveries).toHaveLength(1);
    expect(res.body.discoveries[0].discovery.articleId).toBe(article.id);
    expect(res.body.discoveries[0].article.ogTitle).toBe("Test");
  });

  it("filters by brandId", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/1" });
    const otherBrandId = "e0000000-0000-4000-8000-000000000099";

    await insertTestDiscovery({
      articleId: article.id,
      orgId: TEST_ORG_ID,
      brandIds: [TEST_BRAND_ID],
      featureSlug: TEST_FEATURE_SLUG,
      campaignId: TEST_CAMPAIGN_ID,
    });

    const article2 = await insertTestArticle({ articleUrl: "https://example.com/2" });
    await insertTestDiscovery({
      articleId: article2.id,
      orgId: TEST_ORG_ID,
      brandIds: [otherBrandId],
      featureSlug: TEST_FEATURE_SLUG,
      campaignId: TEST_CAMPAIGN_ID,
    });

    const res = await request(app)
      .get(`/v1/discoveries?brandId=${TEST_BRAND_ID}`)
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.discoveries).toHaveLength(1);
    expect(res.body.discoveries[0].discovery.brandIds).toEqual([TEST_BRAND_ID]);
  });

  it("filters by campaignId", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/1" });
    await insertTestDiscovery({
      articleId: article.id,
      orgId: TEST_ORG_ID,
      brandIds: [TEST_BRAND_ID],
      featureSlug: TEST_FEATURE_SLUG,
      campaignId: TEST_CAMPAIGN_ID,
    });

    const res = await request(app)
      .get(`/v1/discoveries?campaignId=${TEST_CAMPAIGN_ID}`)
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.discoveries).toHaveLength(1);
  });

  it("filters by journalistId", async () => {
    const journalistId = "d0000000-0000-4000-8000-000000000001";
    const article = await insertTestArticle({ articleUrl: "https://example.com/1" });
    await insertTestDiscovery({
      articleId: article.id,
      orgId: TEST_ORG_ID,
      brandIds: [TEST_BRAND_ID],
      featureSlug: TEST_FEATURE_SLUG,
      campaignId: TEST_CAMPAIGN_ID,
      journalistId,
    });

    const res = await request(app)
      .get(`/v1/discoveries?journalistId=${journalistId}`)
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.discoveries).toHaveLength(1);
    expect(res.body.discoveries[0].discovery.journalistId).toBe(journalistId);
  });

  it("scopes to org from headers (other org sees nothing)", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/1" });
    await insertTestDiscovery({
      articleId: article.id,
      orgId: "a0000000-0000-0000-0000-000000000099",
      brandIds: [TEST_BRAND_ID],
      featureSlug: TEST_FEATURE_SLUG,
      campaignId: TEST_CAMPAIGN_ID,
    });

    const res = await request(app).get("/v1/discoveries").set(getIdentityHeaders());
    expect(res.status).toBe(200);
    expect(res.body.discoveries).toHaveLength(0);
  });

  it("filters by featureSlug", async () => {
    const article1 = await insertTestArticle({ articleUrl: "https://example.com/feat1" });
    const article2 = await insertTestArticle({ articleUrl: "https://example.com/feat2" });

    await insertTestDiscovery({
      articleId: article1.id,
      orgId: TEST_ORG_ID,
      brandIds: [TEST_BRAND_ID],
      featureSlug: "press-outreach-v3",
      campaignId: TEST_CAMPAIGN_ID,
    });
    await insertTestDiscovery({
      articleId: article2.id,
      orgId: TEST_ORG_ID,
      brandIds: [TEST_BRAND_ID],
      featureSlug: "media-monitor-v1",
      campaignId: TEST_CAMPAIGN_ID,
    });

    const res = await request(app)
      .get("/v1/discoveries?featureSlug=press-outreach-v3")
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.discoveries).toHaveLength(1);
    expect(res.body.discoveries[0].discovery.featureSlug).toBe("press-outreach-v3");
  });

  it("filters by featureSlugs (comma-separated)", async () => {
    const article1 = await insertTestArticle({ articleUrl: "https://example.com/fs1" });
    const article2 = await insertTestArticle({ articleUrl: "https://example.com/fs2" });
    const article3 = await insertTestArticle({ articleUrl: "https://example.com/fs3" });

    await insertTestDiscovery({
      articleId: article1.id,
      orgId: TEST_ORG_ID,
      brandIds: [TEST_BRAND_ID],
      featureSlug: "press-outreach-v3",
      campaignId: TEST_CAMPAIGN_ID,
    });
    await insertTestDiscovery({
      articleId: article2.id,
      orgId: TEST_ORG_ID,
      brandIds: [TEST_BRAND_ID],
      featureSlug: "press-outreach-v4",
      campaignId: TEST_CAMPAIGN_ID,
    });
    await insertTestDiscovery({
      articleId: article3.id,
      orgId: TEST_ORG_ID,
      brandIds: [TEST_BRAND_ID],
      featureSlug: "media-monitor-v1",
      campaignId: TEST_CAMPAIGN_ID,
    });

    const res = await request(app)
      .get("/v1/discoveries?featureSlugs=press-outreach-v3,press-outreach-v4")
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.discoveries).toHaveLength(2);
    const slugs = res.body.discoveries.map((d: { discovery: { featureSlug: string } }) => d.discovery.featureSlug);
    expect(slugs).toContain("press-outreach-v3");
    expect(slugs).toContain("press-outreach-v4");
  });

  it("filters by workflowSlug", async () => {
    const article1 = await insertTestArticle({ articleUrl: "https://example.com/wf1" });
    const article2 = await insertTestArticle({ articleUrl: "https://example.com/wf2" });

    await insertTestDiscovery({
      articleId: article1.id,
      orgId: TEST_ORG_ID,
      brandIds: [TEST_BRAND_ID],
      featureSlug: TEST_FEATURE_SLUG,
      workflowSlug: "outreach-pipeline-v2",
      campaignId: TEST_CAMPAIGN_ID,
    });
    await insertTestDiscovery({
      articleId: article2.id,
      orgId: TEST_ORG_ID,
      brandIds: [TEST_BRAND_ID],
      featureSlug: TEST_FEATURE_SLUG,
      workflowSlug: "other-pipeline-v1",
      campaignId: TEST_CAMPAIGN_ID,
    });

    const res = await request(app)
      .get("/v1/discoveries?workflowSlug=outreach-pipeline-v2")
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.discoveries).toHaveLength(1);
    expect(res.body.discoveries[0].discovery.workflowSlug).toBe("outreach-pipeline-v2");
  });
});
