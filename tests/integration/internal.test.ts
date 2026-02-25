import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createTestApp } from "../helpers/test-app.js";
import { cleanTestData, insertTestArticle, insertTestTopic, closeDb } from "../helpers/test-db.js";
import { db } from "../../src/db/index.js";
import { outletTopicArticles } from "../../src/db/schema.js";

const app = createTestApp();

beforeEach(async () => {
  await cleanTestData();
});

afterAll(async () => {
  await cleanTestData();
  await closeDb();
});

describe("GET /internal/articles/by-urls", () => {
  it("returns articles matching URLs", async () => {
    await insertTestArticle({ articleUrl: "https://example.com/1", ogTitle: "Article 1" });
    await insertTestArticle({ articleUrl: "https://example.com/2", ogTitle: "Article 2" });
    await insertTestArticle({ articleUrl: "https://example.com/3", ogTitle: "Article 3" });

    const res = await request(app).get(
      "/internal/articles/by-urls?urls=https://example.com/1,https://example.com/3"
    );

    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(2);
    const titles = res.body.articles.map((a: { ogTitle: string }) => a.ogTitle).sort();
    expect(titles).toEqual(["Article 1", "Article 3"]);
  });

  it("returns 400 without urls param", async () => {
    const res = await request(app).get("/internal/articles/by-urls");
    expect(res.status).toBe(400);
  });

  it("returns empty array for no matches", async () => {
    const res = await request(app).get(
      "/internal/articles/by-urls?urls=https://example.com/nonexistent"
    );
    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(0);
  });
});

describe("GET /internal/articles/by-outlet-topic/:outletId/:topicId", () => {
  it("returns articles for outlet+topic combo", async () => {
    const article = await insertTestArticle({ articleUrl: "https://example.com/1", ogTitle: "Linked" });
    const topic = await insertTestTopic("Tech");
    const outletId = "550e8400-e29b-41d4-a716-446655440000";

    await db.insert(outletTopicArticles).values({
      outletId,
      topicId: topic.id,
      articleId: article.id,
    });

    const res = await request(app).get(`/internal/articles/by-outlet-topic/${outletId}/${topic.id}`);
    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(1);
    expect(res.body.articles[0].ogTitle).toBe("Linked");
  });

  it("returns empty for no matches", async () => {
    const outletId = "550e8400-e29b-41d4-a716-446655440000";
    const topicId = "550e8400-e29b-41d4-a716-446655440001";

    const res = await request(app).get(`/internal/articles/by-outlet-topic/${outletId}/${topicId}`);
    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(0);
  });
});
