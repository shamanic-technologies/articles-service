import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

const TEST_HEADERS = {
  orgId: "a0000000-0000-4000-8000-000000000001",
  userId: "b0000000-0000-4000-8000-000000000001",
  runId: "c0000000-0000-4000-8000-000000000001",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.KEY_SERVICE_URL = "http://key-service:3000";
  process.env.KEY_SERVICE_API_KEY = "test-key-service-key";

  // Mock fetch for key-service resolution
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ key: "test-anthropic-key", keySource: "platform" }),
  }));
});

describe("extractMetadataFromMarkdown", () => {
  it("resolves API key from key-service before calling Anthropic", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: '{"isArticle":true,"authors":[{"type":"person","firstName":"Sarah","lastName":"Perez"}],"publishedAt":"2025-03-20T00:00:00Z"}',
        },
      ],
    });

    const { extractMetadataFromMarkdown } = await import("../../src/services/llm.js");
    await extractMetadataFromMarkdown("# Article\nBy Sarah Perez", TEST_HEADERS);

    // Verify key-service was called with correct caller headers
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://key-service:3000/keys/anthropic/decrypt",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "X-API-Key": "test-key-service-key",
          "x-org-id": TEST_HEADERS.orgId,
          "x-user-id": TEST_HEADERS.userId,
          "x-run-id": TEST_HEADERS.runId,
          "X-Caller-Service": "articles-service",
          "X-Caller-Method": "GET",
          "X-Caller-Path": "/keys/anthropic/decrypt",
        }),
      }),
    );
  });

  it("sends X-Caller-Method and X-Caller-Path headers to key-service (regression)", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"isArticle":true,"authors":[],"publishedAt":null}' }],
    });

    const { extractMetadataFromMarkdown } = await import("../../src/services/llm.js");
    await extractMetadataFromMarkdown("# Test", TEST_HEADERS);

    const fetchMock = vi.mocked(fetch);
    const calledHeaders = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    // Must NOT send the old X-Caller-Endpoint header
    expect(calledHeaders).not.toHaveProperty("X-Caller-Endpoint");
    // Must send the required X-Caller-Method and X-Caller-Path
    expect(calledHeaders["X-Caller-Method"]).toBe("GET");
    expect(calledHeaders["X-Caller-Path"]).toBe("/keys/anthropic/decrypt");
  });

  it("extracts person authors and publishedAt", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: '{"isArticle":true,"authors":[{"type":"person","firstName":"Sarah","lastName":"Perez"}],"publishedAt":"2025-03-20T00:00:00Z"}',
        },
      ],
    });

    const { extractMetadataFromMarkdown } = await import("../../src/services/llm.js");
    const result = await extractMetadataFromMarkdown("# Article\nBy Sarah Perez\nPublished March 20, 2025", TEST_HEADERS);

    expect(result.isArticle).toBe(true);
    expect(result.authors).toEqual([{ type: "person", firstName: "Sarah", lastName: "Perez" }]);
    expect(result.publishedAt).toBe("2025-03-20T00:00:00Z");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-haiku-4-5", max_tokens: 512 }),
    );
  });

  it("handles organization authors", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: '{"isArticle":true,"authors":[{"type":"organization","firstName":"","lastName":"Reuters"}],"publishedAt":"2025-03-20T00:00:00Z"}',
        },
      ],
    });

    const { extractMetadataFromMarkdown } = await import("../../src/services/llm.js");
    const result = await extractMetadataFromMarkdown("# News\nBy Reuters", TEST_HEADERS);

    expect(result.authors).toEqual([{ type: "organization", firstName: "", lastName: "Reuters" }]);
  });

  it("returns isArticle=false for non-article pages", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: '{"isArticle":false,"authors":[],"publishedAt":null}',
        },
      ],
    });

    const { extractMetadataFromMarkdown } = await import("../../src/services/llm.js");
    const result = await extractMetadataFromMarkdown("Welcome to our homepage!", TEST_HEADERS);

    expect(result.isArticle).toBe(false);
    expect(result.authors).toEqual([]);
    expect(result.publishedAt).toBeNull();
  });

  it("returns empty result on invalid JSON response", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "I cannot extract this information" }],
    });

    const { extractMetadataFromMarkdown } = await import("../../src/services/llm.js");
    const result = await extractMetadataFromMarkdown("Some random text", TEST_HEADERS);

    expect(result.isArticle).toBe(false);
    expect(result.authors).toEqual([]);
    expect(result.publishedAt).toBeNull();
  });

  it("truncates long articles to 4000 chars", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"isArticle":true,"authors":[],"publishedAt":null}' }],
    });

    const { extractMetadataFromMarkdown } = await import("../../src/services/llm.js");
    const longArticle = "x".repeat(10000);
    await extractMetadataFromMarkdown(longArticle, TEST_HEADERS);

    const calledWith = mockCreate.mock.calls[0][0];
    const messageContent = calledWith.messages[0].content as string;
    // Prompt (~1600 chars) + truncated content (4000 chars) = ~5600
    expect(messageContent.length).toBeLessThan(6000);
  });

  it("handles mixed person and organization authors", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: '{"isArticle":true,"authors":[{"type":"person","firstName":"J.","lastName":"Smith"},{"type":"organization","firstName":"","lastName":"AP News"}],"publishedAt":"2025-01-15T14:30:00+01:00"}',
        },
      ],
    });

    const { extractMetadataFromMarkdown } = await import("../../src/services/llm.js");
    const result = await extractMetadataFromMarkdown("# Story\nBy J. Smith and AP News", TEST_HEADERS);

    expect(result.authors).toHaveLength(2);
    expect(result.authors[0]).toEqual({ type: "person", firstName: "J.", lastName: "Smith" });
    expect(result.authors[1]).toEqual({ type: "organization", firstName: "", lastName: "AP News" });
    expect(result.publishedAt).toBe("2025-01-15T14:30:00+01:00");
  });

  it("throws when key-service returns an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Key not configured"),
    }));

    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"isArticle":true,"authors":[],"publishedAt":null}' }],
    });

    const { extractMetadataFromMarkdown } = await import("../../src/services/llm.js");
    await expect(extractMetadataFromMarkdown("# Article", TEST_HEADERS))
      .rejects.toThrow("Key-service returned 404");
  });

  it("throws when KEY_SERVICE_URL is not set", async () => {
    delete process.env.KEY_SERVICE_URL;

    const { extractMetadataFromMarkdown } = await import("../../src/services/llm.js");
    await expect(extractMetadataFromMarkdown("# Article", TEST_HEADERS))
      .rejects.toThrow("KEY_SERVICE_URL and KEY_SERVICE_API_KEY must be set");
  });

  it("strips markdown code fences from LLM response (regression: parse failure)", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: '```json\n{"isArticle":true,"authors":[{"type":"person","firstName":"Perry","lastName":"Steward"}],"publishedAt":"2025-11-05T00:00:00Z"}\n```',
        },
      ],
    });

    const { extractMetadataFromMarkdown } = await import("../../src/services/llm.js");
    const result = await extractMetadataFromMarkdown("# Article\nBy Perry Steward", TEST_HEADERS);

    expect(result.isArticle).toBe(true);
    expect(result.authors).toEqual([{ type: "person", firstName: "Perry", lastName: "Steward" }]);
    expect(result.publishedAt).toBe("2025-11-05T00:00:00Z");
  });

  it("skips key-service call when anthropicKey is pre-resolved (regression: concurrent key-service race)", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"isArticle":true,"authors":[],"publishedAt":null}' }],
    });

    const { extractMetadataFromMarkdown } = await import("../../src/services/llm.js");
    await extractMetadataFromMarkdown("# Article", TEST_HEADERS, "pre-resolved-key");

    // fetch should NOT have been called — key was passed directly
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
