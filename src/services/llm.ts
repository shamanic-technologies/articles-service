import Anthropic from "@anthropic-ai/sdk";
import type { IdentityHeaders } from "./google.js";

export interface ExtractedAuthor {
  type: "person" | "organization";
  firstName: string;
  lastName: string;
}

export interface LlmExtractResult {
  isArticle: boolean;
  authors: ExtractedAuthor[];
  publishedAt: string | null;
}

async function resolveAnthropicKey(headers: IdentityHeaders): Promise<string> {
  const baseUrl = process.env.KEY_SERVICE_URL;
  const apiKey = process.env.KEY_SERVICE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("KEY_SERVICE_URL and KEY_SERVICE_API_KEY must be set");
  }

  const res = await fetch(`${baseUrl}/keys/anthropic/decrypt`, {
    method: "GET",
    headers: {
      "X-API-Key": apiKey,
      "x-org-id": headers.orgId,
      "x-user-id": headers.userId,
      "x-run-id": headers.runId,
      "X-Caller-Service": "articles-service",
      "X-Caller-Endpoint": "extractMetadataFromMarkdown",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Key-service returned ${res.status} for anthropic key: ${body}`);
  }

  const data = (await res.json()) as { key: string; keySource: string };
  return data.key;
}

const EXTRACTION_PROMPT = `Extract author names and publication date from this article. Return ONLY valid JSON.

Response schema:
{
  "isArticle": boolean,       // false if the page is not a press/news article (e.g. homepage, product page, 404, empty)
  "authors": [
    {
      "type": "person" | "organization",  // "organization" for newsrooms, agencies, brands (e.g. "Reuters", "AP", "TechCrunch Staff")
      "firstName": "string",
      "lastName": "string"
    }
  ],
  "publishedAt": "ISO 8601 string with timezone" | null
}

Author rules:
- Multiple authors are common — return all of them.
- If an author is clearly an organization (news agency, brand, editorial team), set type to "organization", put the full name in lastName, leave firstName empty.
- If an author is a person: split into firstName and lastName normally.
- If only one name is given for a person (e.g. "Madonna", "Staff"), put it in lastName, leave firstName empty.
- If the first name is a single initial (e.g. "J. Smith"), keep it as-is — do NOT expand it.
- If no author is identifiable at all, return an empty array.
- Do NOT invent or guess author names that are not in the text.

Date rules:
- Always return an ISO 8601 string WITH timezone offset or Z suffix (e.g. "2025-03-20T14:30:00Z" or "2025-03-20T14:30:00+01:00").
- If the article shows a date but no timezone, default to UTC (append "Z").
- If the article shows only a date without time, use T00:00:00Z.
- If no date is found at all, return null.

Non-article pages:
- If the content is clearly not a press article (homepage, product page, 404, login wall, paywall, empty page), set isArticle to false and return empty authors and null publishedAt.

Article content:
`;

export async function extractMetadataFromMarkdown(
  markdown: string,
  headers: IdentityHeaders,
): Promise<LlmExtractResult> {
  const anthropicKey = await resolveAnthropicKey(headers);
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  // Truncate very long articles to save tokens — metadata is always near the top
  const truncated = markdown.length > 4000 ? markdown.slice(0, 4000) : markdown;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: EXTRACTION_PROMPT + truncated,
      },
    ],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";

  try {
    const parsed = JSON.parse(text.trim());
    return {
      isArticle: parsed.isArticle !== false,
      authors: Array.isArray(parsed.authors)
        ? parsed.authors.map((a: { type?: string; firstName?: string; lastName?: string }) => ({
            type: a.type === "organization" ? "organization" as const : "person" as const,
            firstName: String(a.firstName ?? ""),
            lastName: String(a.lastName ?? ""),
          }))
        : [],
      publishedAt: typeof parsed.publishedAt === "string" ? parsed.publishedAt : null,
    };
  } catch {
    console.error("[Articles Service] Failed to parse LLM extraction response:", text);
    return { isArticle: false, authors: [], publishedAt: null };
  }
}
