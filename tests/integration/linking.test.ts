import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createTestApp, getAuthHeaders, getIdentityHeaders } from "../helpers/test-app.js";
import { cleanTestData, insertTestArticle, insertTestTopic, closeDb } from "../helpers/test-db.js";
import { db } from "../../src/db/index.js";
import { searchedJournalistArticles } from "../../src/db/schema.js";

const app = createTestApp();

beforeEach(async () => {
  await cleanTestData();
});

afterAll(async () => {
  await cleanTestData();
  await closeDb();
});

describe("Outlet-Topic-Articles", () => {
  it("POST /v1/outlet-topic-articles — creates a link", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/1" });
    const topic = await insertTestTopic("Tech");
    const outletId = "550e8400-e29b-41d4-a716-446655440000";

    const res = await request(app)
      .post("/v1/outlet-topic-articles")
      .set(getAuthHeaders())
      .send({ outletId, topicId: topic.id, articleId: article.id });

    expect(res.status).toBe(200);
    expect(res.body.outletId).toBe(outletId);
    expect(res.body.topicId).toBe(topic.id);
    expect(res.body.articleId).toBe(article.id);
  });

  it("POST /v1/outlet-topic-articles — idempotent on duplicate", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/1" });
    const topic = await insertTestTopic("Tech");
    const outletId = "550e8400-e29b-41d4-a716-446655440000";

    await request(app)
      .post("/v1/outlet-topic-articles")
      .set(getAuthHeaders())
      .send({ outletId, topicId: topic.id, articleId: article.id });

    const res = await request(app)
      .post("/v1/outlet-topic-articles")
      .set(getAuthHeaders())
      .send({ outletId, topicId: topic.id, articleId: article.id });

    expect(res.status).toBe(200);
  });

  it("POST /v1/outlet-topic-articles/bulk — bulk creates links", async () => {
    const a1 = await insertTestArticle({ articleUrl: "https://example.com/1" });
    const a2 = await insertTestArticle({ articleUrl: "https://example.com/2" });
    const topic = await insertTestTopic("Tech");
    const outletId = "550e8400-e29b-41d4-a716-446655440000";

    const res = await request(app)
      .post("/v1/outlet-topic-articles/bulk")
      .set(getAuthHeaders())
      .send({
        links: [
          { outletId, topicId: topic.id, articleId: a1.id },
          { outletId, topicId: topic.id, articleId: a2.id },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.links).toHaveLength(2);
  });

  it("GET /v1/outlet-topic-articles — filters by outletId", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/1" });
    const topic = await insertTestTopic("Tech");
    const outletId = "550e8400-e29b-41d4-a716-446655440000";

    await request(app)
      .post("/v1/outlet-topic-articles")
      .set(getAuthHeaders())
      .send({ outletId, topicId: topic.id, articleId: article.id });

    const res = await request(app)
      .get(`/v1/outlet-topic-articles?outletId=${outletId}`)
      .set(getIdentityHeaders());
    expect(res.status).toBe(200);
    expect(res.body.links).toHaveLength(1);
  });

  it("GET /v1/articles — filters by outletId", async () => {
    const a1 = await insertTestArticle({ articleUrl: "https://example.com/1", ogTitle: "Linked" });
    await insertTestArticle({ articleUrl: "https://example.com/2", ogTitle: "Unlinked" });
    const topic = await insertTestTopic("Tech");
    const outletId = "550e8400-e29b-41d4-a716-446655440000";

    await request(app)
      .post("/v1/outlet-topic-articles")
      .set(getAuthHeaders())
      .send({ outletId, topicId: topic.id, articleId: a1.id });

    const res = await request(app)
      .get(`/v1/articles?outletId=${outletId}`)
      .set(getIdentityHeaders());
    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(1);
    expect(res.body.articles[0].ogTitle).toBe("Linked");
  });
});

describe("Journalist-Articles", () => {
  it("POST /v1/journalist-articles — creates a link", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/1" });
    const journalistId = "550e8400-e29b-41d4-a716-446655440001";

    const res = await request(app)
      .post("/v1/journalist-articles")
      .set(getAuthHeaders())
      .send({ articleId: article.id, journalistId });

    expect(res.status).toBe(200);
    expect(res.body.articleId).toBe(article.id);
    expect(res.body.journalistId).toBe(journalistId);
  });

  it("GET /v1/journalist-articles/:journalistId — lists articles", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/1", ogTitle: "Test" });
    const journalistId = "550e8400-e29b-41d4-a716-446655440001";

    await db.insert(searchedJournalistArticles).values({
      articleId: article.id,
      journalistId,
    });

    const res = await request(app)
      .get(`/v1/journalist-articles/${journalistId}`)
      .set(getIdentityHeaders());
    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(1);
    expect(res.body.articles[0].ogTitle).toBe("Test");
  });

  it("GET /v1/articles/by-journalist/:journalistId — returns computed view", async () => {
    const article = await insertTestArticle({
      articleUrl: "https://example.com/1",
      ogTitle: "Journalist Article",
      author: "Jane",
    });
    const journalistId = "550e8400-e29b-41d4-a716-446655440001";

    await db.insert(searchedJournalistArticles).values({
      articleId: article.id,
      journalistId,
    });

    const res = await request(app)
      .get(`/v1/articles/by-journalist/${journalistId}`)
      .set(getIdentityHeaders());
    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(1);
    expect(res.body.articles[0].computedTitle).toBe("Journalist Article");
    expect(res.body.articles[0].computedAuthors).toContain("Jane");
  });
});
