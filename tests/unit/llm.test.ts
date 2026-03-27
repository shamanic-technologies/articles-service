import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test-key";
});

describe("extractMetadataFromMarkdown", () => {
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
    const result = await extractMetadataFromMarkdown("# Article\nBy Sarah Perez\nPublished March 20, 2025");

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
    const result = await extractMetadataFromMarkdown("# News\nBy Reuters");

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
    const result = await extractMetadataFromMarkdown("Welcome to our homepage!");

    expect(result.isArticle).toBe(false);
    expect(result.authors).toEqual([]);
    expect(result.publishedAt).toBeNull();
  });

  it("returns empty result on invalid JSON response", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "I cannot extract this information" }],
    });

    const { extractMetadataFromMarkdown } = await import("../../src/services/llm.js");
    const result = await extractMetadataFromMarkdown("Some random text");

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
    await extractMetadataFromMarkdown(longArticle);

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
    const result = await extractMetadataFromMarkdown("# Story\nBy J. Smith and AP News");

    expect(result.authors).toHaveLength(2);
    expect(result.authors[0]).toEqual({ type: "person", firstName: "J.", lastName: "Smith" });
    expect(result.authors[1]).toEqual({ type: "organization", firstName: "", lastName: "AP News" });
    expect(result.publishedAt).toBe("2025-01-15T14:30:00+01:00");
  });
});
