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

const SYSTEM_PROMPT = `You extract author names and publication dates from article HTML/markdown.

Response schema:
{
  "isArticle": boolean,
  "authors": [
    {
      "type": "person" | "organization",
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
- If the content is clearly not a press article (homepage, product page, 404, login wall, paywall, empty page), set isArticle to false and return empty authors and null publishedAt.`;

interface ChatCompleteResponse {
  content: string;
  json?: Record<string, unknown>;
  tokensInput: number;
  tokensOutput: number;
  model: string;
}

function parseJsonFromContent(content: string): Record<string, unknown> | null {
  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const fenceMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const raw = fenceMatch ? fenceMatch[1].trim() : content.trim();
  try {
    const result = JSON.parse(raw);
    if (typeof result === "object" && result !== null && !Array.isArray(result)) {
      return result as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export async function extractMetadataFromMarkdown(
  markdown: string,
  headers: IdentityHeaders,
): Promise<LlmExtractResult> {
  const baseUrl = process.env.CHAT_SERVICE_URL;
  const apiKey = process.env.CHAT_SERVICE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("CHAT_SERVICE_URL and CHAT_SERVICE_API_KEY must be set");
  }

  // Truncate very long articles to save tokens — metadata is always near the top
  const truncated = markdown.length > 4000 ? markdown.slice(0, 4000) : markdown;

  const res = await fetch(`${baseUrl}/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      "x-org-id": headers.orgId,
      "x-user-id": headers.userId,
      "x-run-id": headers.runId,
      ...(headers.workflowSlug ? { "x-workflow-slug": headers.workflowSlug } : {}),
      ...(headers.featureSlug ? { "x-feature-slug": headers.featureSlug } : {}),
      ...(headers.brandId ? { "x-brand-id": headers.brandId } : {}),
      ...(headers.campaignId ? { "x-campaign-id": headers.campaignId } : {}),
    },
    body: JSON.stringify({
      message: `Extract author names and publication date from this article:\n\n${truncated}`,
      systemPrompt: SYSTEM_PROMPT,
      responseFormat: "json",
      model: "claude-haiku-4-5",
      maxTokens: 512,
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Chat-service returned ${res.status}: ${body}`);
  }

  const data = (await res.json()) as ChatCompleteResponse;

  // Use the pre-parsed `json` field from chat-service (already fence-stripped and parsed)
  // Fall back to parsing raw content if json field is missing (chat-service sometimes omits it)
  const parsed = data.json ?? parseJsonFromContent(data.content);
  if (!parsed) {
    console.error("[Articles Service] Chat-service returned no parsed JSON, raw content:", data.content);
    return { isArticle: false, authors: [], publishedAt: null };
  }

  return {
    isArticle: parsed.isArticle !== false,
    authors: Array.isArray(parsed.authors)
      ? (parsed.authors as { type?: string; firstName?: string; lastName?: string }[]).map((a) => ({
          type: a.type === "organization" ? "organization" as const : "person" as const,
          firstName: String(a.firstName ?? ""),
          lastName: String(a.lastName ?? ""),
        }))
      : [],
    publishedAt: typeof parsed.publishedAt === "string" ? parsed.publishedAt : null,
  };
}
