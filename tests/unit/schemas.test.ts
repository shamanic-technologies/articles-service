import { describe, it, expect } from "vitest";
import {
  CreateArticleBodySchema,
  BulkCreateArticlesBodySchema,
  CreateTopicBodySchema,
  BulkCreateTopicsBodySchema,
  CreateOutletTopicArticleBodySchema,
  CreateJournalistArticleBodySchema,
  SearchArticlesBodySchema,
} from "../../src/schemas.js";

describe("CreateArticleBodySchema", () => {
  it("validates a minimal article", () => {
    const result = CreateArticleBodySchema.safeParse({
      articleUrl: "https://example.com/article-1",
    });
    expect(result.success).toBe(true);
  });

  it("validates a full article", () => {
    const result = CreateArticleBodySchema.safeParse({
      articleUrl: "https://example.com/article-1",
      snippet: "A short snippet",
      ogDescription: "OG description",
      twitterCreator: "@author",
      newsKeywords: "tech, news",
      articlePublished: "2024-01-01",
      articleChannel: "tech",
      twitterTitle: "Twitter Title",
      articleSection: "Technology",
      author: "John Doe",
      ogTitle: "OG Title",
      articleAuthor: "John Doe",
      twitterDescription: "Twitter desc",
      articleModified: "2024-01-02",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid URL", () => {
    const result = CreateArticleBodySchema.safeParse({
      articleUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing articleUrl", () => {
    const result = CreateArticleBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("BulkCreateArticlesBodySchema", () => {
  it("validates an array of articles", () => {
    const result = BulkCreateArticlesBodySchema.safeParse({
      articles: [
        { articleUrl: "https://example.com/1" },
        { articleUrl: "https://example.com/2" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing articles key", () => {
    const result = BulkCreateArticlesBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("CreateTopicBodySchema", () => {
  it("validates a topic", () => {
    const result = CreateTopicBodySchema.safeParse({ topicName: "Technology" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty topic name", () => {
    const result = CreateTopicBodySchema.safeParse({ topicName: "" });
    expect(result.success).toBe(false);
  });
});

describe("BulkCreateTopicsBodySchema", () => {
  it("validates an array of topics", () => {
    const result = BulkCreateTopicsBodySchema.safeParse({
      topics: [{ topicName: "Tech" }, { topicName: "Science" }],
    });
    expect(result.success).toBe(true);
  });
});

describe("CreateOutletTopicArticleBodySchema", () => {
  it("validates a link", () => {
    const result = CreateOutletTopicArticleBodySchema.safeParse({
      outletId: "550e8400-e29b-41d4-a716-446655440000",
      topicId: "550e8400-e29b-41d4-a716-446655440001",
      articleId: "550e8400-e29b-41d4-a716-446655440002",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUIDs", () => {
    const result = CreateOutletTopicArticleBodySchema.safeParse({
      outletId: "not-a-uuid",
      topicId: "not-a-uuid",
      articleId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

describe("CreateJournalistArticleBodySchema", () => {
  it("validates a link", () => {
    const result = CreateJournalistArticleBodySchema.safeParse({
      articleId: "550e8400-e29b-41d4-a716-446655440000",
      journalistId: "550e8400-e29b-41d4-a716-446655440001",
    });
    expect(result.success).toBe(true);
  });
});

describe("SearchArticlesBodySchema", () => {
  it("validates a search query", () => {
    const result = SearchArticlesBodySchema.safeParse({ query: "tech news" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
    }
  });

  it("validates with custom limit and offset", () => {
    const result = SearchArticlesBodySchema.safeParse({
      query: "tech",
      limit: 50,
      offset: 10,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty query", () => {
    const result = SearchArticlesBodySchema.safeParse({ query: "" });
    expect(result.success).toBe(false);
  });
});
