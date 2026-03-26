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
      .send({
        articleId: article.id,
        brandId: TEST_BRAND_ID,
        campaignId: TEST_CAMPAIGN_ID,
      });

    expect(res.status).toBe(200);
    expect(res.body.articleId).toBe(article.id);
    expect(res.body.orgId).toBe(TEST_ORG_ID);
    expect(res.body.brandId).toBe(TEST_BRAND_ID);
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
      .send({
        articleId: article.id,
        brandId: TEST_BRAND_ID,
        campaignId: TEST_CAMPAIGN_ID,
        outletId,
        journalistId,
      });

    expect(res.status).toBe(200);
    expect(res.body.outletId).toBe(outletId);
    expect(res.body.journalistId).toBe(journalistId);
  });

  it("returns 401 without API key", async () => {
    const res = await request(app)
      .post("/v1/discoveries")
      .set(getIdentityHeaders())
      .send({
        articleId: "550e8400-e29b-41d4-a716-446655440000",
        brandId: TEST_BRAND_ID,
        campaignId: TEST_CAMPAIGN_ID,
      });

    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    const res = await request(app)
      .post("/v1/discoveries")
      .set(getAuthHeaders())
      .send({});

    expect(res.status).toBe(400);
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
          { articleId: article1.id, brandId: TEST_BRAND_ID, campaignId: TEST_CAMPAIGN_ID },
          { articleId: article2.id, brandId: TEST_BRAND_ID, campaignId: TEST_CAMPAIGN_ID },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.discoveries).toHaveLength(2);
  });

  it("handles empty array", async () => {
    const res = await request(app)
      .post("/v1/discoveries/bulk")
      .set(getAuthHeaders())
      .send({ discoveries: [] });

    expect(res.status).toBe(200);
    expect(res.body.discoveries).toHaveLength(0);
  });
});

describe("GET /v1/discoveries", () => {
  it("lists discoveries for the org with article data", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/1", ogTitle: "Test" });
    await insertTestDiscovery({
      articleId: article.id,
      orgId: TEST_ORG_ID,
      brandId: TEST_BRAND_ID,
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
      brandId: TEST_BRAND_ID,
      featureSlug: TEST_FEATURE_SLUG,
      campaignId: TEST_CAMPAIGN_ID,
    });

    const article2 = await insertTestArticle({ articleUrl: "https://example.com/2" });
    await insertTestDiscovery({
      articleId: article2.id,
      orgId: TEST_ORG_ID,
      brandId: otherBrandId,
      featureSlug: TEST_FEATURE_SLUG,
      campaignId: TEST_CAMPAIGN_ID,
    });

    const res = await request(app)
      .get(`/v1/discoveries?brandId=${TEST_BRAND_ID}`)
      .set(getIdentityHeaders());

    expect(res.status).toBe(200);
    expect(res.body.discoveries).toHaveLength(1);
    expect(res.body.discoveries[0].discovery.brandId).toBe(TEST_BRAND_ID);
  });

  it("filters by campaignId", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/1" });
    await insertTestDiscovery({
      articleId: article.id,
      orgId: TEST_ORG_ID,
      brandId: TEST_BRAND_ID,
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
      brandId: TEST_BRAND_ID,
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
      brandId: TEST_BRAND_ID,
      featureSlug: TEST_FEATURE_SLUG,
      campaignId: TEST_CAMPAIGN_ID,
    });

    const res = await request(app).get("/v1/discoveries").set(getIdentityHeaders());
    expect(res.status).toBe(200);
    expect(res.body.discoveries).toHaveLength(0);
  });
});
