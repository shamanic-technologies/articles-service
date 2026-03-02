import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createTestApp, getAuthHeaders, getIdentityHeaders } from "../helpers/test-app.js";
import { cleanTestData, insertTestArticle, closeDb } from "../helpers/test-db.js";

const app = createTestApp();

beforeEach(async () => {
  await cleanTestData();
});

afterAll(async () => {
  await cleanTestData();
  await closeDb();
});

describe("POST /v1/articles", () => {
  it("creates a new article", async () => {
    const res = await request(app)
      .post("/v1/articles")
      .set(getAuthHeaders())
      .send({ articleUrl: "https://example.com/article-1", ogTitle: "Test Article" });

    expect(res.status).toBe(200);
    expect(res.body.articleUrl).toBe("https://example.com/article-1");
    expect(res.body.ogTitle).toBe("Test Article");
    expect(res.body.id).toBeDefined();
  });

  it("upserts an existing article by URL", async () => {
    await request(app)
      .post("/v1/articles")
      .set(getAuthHeaders())
      .send({ articleUrl: "https://example.com/article-1", ogTitle: "Original" });

    const res = await request(app)
      .post("/v1/articles")
      .set(getAuthHeaders())
      .send({ articleUrl: "https://example.com/article-1", ogTitle: "Updated" });

    expect(res.status).toBe(200);
    expect(res.body.ogTitle).toBe("Updated");
  });

  it("returns 401 without API key", async () => {
    const res = await request(app)
      .post("/v1/articles")
      .set(getIdentityHeaders())
      .send({ articleUrl: "https://example.com/article-1" });

    expect(res.status).toBe(401);
  });

  it("returns 400 without identity headers", async () => {
    const res = await request(app)
      .post("/v1/articles")
      .set({ "X-API-Key": "test-api-key", "Content-Type": "application/json" })
      .send({ articleUrl: "https://example.com/article-1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("identity headers");
  });

  it("returns 400 for invalid body", async () => {
    const res = await request(app)
      .post("/v1/articles")
      .set(getAuthHeaders())
      .send({ articleUrl: "not-a-url" });

    expect(res.status).toBe(400);
  });
});

describe("GET /v1/articles", () => {
  it("lists all articles", async () => {
    await insertTestArticle({ articleUrl: "https://example.com/1", ogTitle: "Article 1" });
    await insertTestArticle({ articleUrl: "https://example.com/2", ogTitle: "Article 2" });

    const res = await request(app).get("/v1/articles").set(getIdentityHeaders());
    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(2);
  });

  it("supports limit and offset", async () => {
    await insertTestArticle({ articleUrl: "https://example.com/1" });
    await insertTestArticle({ articleUrl: "https://example.com/2" });
    await insertTestArticle({ articleUrl: "https://example.com/3" });

    const res = await request(app).get("/v1/articles?limit=2&offset=1").set(getIdentityHeaders());
    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(2);
  });

  it("returns 400 without identity headers", async () => {
    const res = await request(app).get("/v1/articles");
    expect(res.status).toBe(400);
  });
});

describe("GET /v1/articles/:id", () => {
  it("returns a single article", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/1", ogTitle: "Test" });

    const res = await request(app).get(`/v1/articles/${article.id}`).set(getIdentityHeaders());
    expect(res.status).toBe(200);
    expect(res.body.ogTitle).toBe("Test");
  });

  it("returns 404 for unknown ID", async () => {
    const res = await request(app)
      .get("/v1/articles/550e8400-e29b-41d4-a716-446655440000")
      .set(getIdentityHeaders());
    expect(res.status).toBe(404);
  });
});

describe("POST /v1/articles/bulk", () => {
  it("bulk upserts articles", async () => {
    const res = await request(app)
      .post("/v1/articles/bulk")
      .set(getAuthHeaders())
      .send({
        articles: [
          { articleUrl: "https://example.com/bulk-1", ogTitle: "Bulk 1" },
          { articleUrl: "https://example.com/bulk-2", ogTitle: "Bulk 2" },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(2);
  });

  it("handles empty array", async () => {
    const res = await request(app)
      .post("/v1/articles/bulk")
      .set(getAuthHeaders())
      .send({ articles: [] });

    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(0);
  });
});

describe("GET /v1/articles/authors", () => {
  it("returns articles with computed author fields", async () => {
    await insertTestArticle({
      articleUrl: "https://example.com/1",
      ogTitle: "OG Title",
      twitterTitle: "Twitter Title",
      author: "Author 1",
      articleAuthor: "Author 2",
      twitterCreator: "@creator",
      snippet: "Short",
      ogDescription: "A longer description text for testing",
      articlePublished: "2024-01-15T10:00:00Z",
    });

    const res = await request(app).get("/v1/articles/authors").set(getIdentityHeaders());
    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(1);

    const a = res.body.articles[0];
    expect(a.computedTitle).toBe("OG Title");
    expect(a.computedAuthors).toEqual(["Author 1", "Author 2", "@creator"]);
    expect(a.computedLargestContent).toBe("A longer description text for testing");
    expect(a.computedPublishedAt).toBeTruthy();
  });
});

describe("POST /v1/articles/search", () => {
  it("searches articles by keyword", async () => {
    await insertTestArticle({
      articleUrl: "https://example.com/tech",
      ogTitle: "Technology Innovation in 2024",
      snippet: "The latest technology trends",
    });
    await insertTestArticle({
      articleUrl: "https://example.com/sports",
      ogTitle: "Sports Update",
      snippet: "Football season recap",
    });

    const res = await request(app)
      .post("/v1/articles/search")
      .set({ "Content-Type": "application/json", ...getIdentityHeaders() })
      .send({ query: "technology" });

    expect(res.status).toBe(200);
    expect(res.body.articles.length).toBeGreaterThanOrEqual(1);
    expect(res.body.articles[0].ogTitle).toContain("Technology");
  });

  it("returns 400 without query", async () => {
    const res = await request(app)
      .post("/v1/articles/search")
      .set({ "Content-Type": "application/json", ...getIdentityHeaders() })
      .send({});

    expect(res.status).toBe(400);
  });
});
