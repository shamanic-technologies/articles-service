import { z } from "zod";
import {
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// --- Shared schemas ---

export const ErrorResponseSchema = z
  .object({ error: z.string() })
  .openapi("ErrorResponse");

export const ValidationErrorResponseSchema = z
  .object({
    error: z.string(),
    details: z.object({
      formErrors: z.array(z.string()),
      fieldErrors: z.record(z.string(), z.array(z.string())),
    }).optional(),
  })
  .openapi("ValidationErrorResponse");

export const HealthResponseSchema = z
  .object({ status: z.string(), service: z.string() })
  .openapi("HealthResponse");

// --- Entity schemas ---

export const ArticleSchema = z
  .object({
    id: z.string().uuid().openapi({ description: "Unique article identifier", example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }),
    articleUrl: z.string().url().openapi({ description: "Canonical URL of the article", example: "https://techcrunch.com/2025/03/15/ai-funding-roundup" }),
    snippet: z.string().nullable().openapi({ description: "Short text excerpt from the article or search result" }),
    ogDescription: z.string().nullable().openapi({ description: "OpenGraph og:description meta tag value" }),
    twitterCreator: z.string().nullable().openapi({ description: "Twitter/X @handle of the article creator", example: "@johndoe" }),
    newsKeywords: z.string().nullable().openapi({ description: "Comma-separated news keywords meta tag" }),
    articlePublished: z.string().nullable().openapi({ description: "Published date from article metadata", example: "2025-03-15T10:00:00Z" }),
    articleChannel: z.string().nullable().openapi({ description: "Channel or vertical the article belongs to", example: "Technology" }),
    twitterTitle: z.string().nullable().openapi({ description: "Twitter/X card title meta tag" }),
    articleSection: z.string().nullable().openapi({ description: "Section of the publication", example: "Startups" }),
    author: z.string().nullable().openapi({ description: "Serialized author data extracted via scraping (JSON array of ExtractedAuthor objects)" }),
    ogTitle: z.string().nullable().openapi({ description: "OpenGraph og:title meta tag value", example: "AI Funding Hits Record High in Q1 2025" }),
    articleAuthor: z.string().nullable().openapi({ description: "Raw author string from article:author meta tag" }),
    twitterDescription: z.string().nullable().openapi({ description: "Twitter/X card description meta tag" }),
    articleModified: z.string().nullable().openapi({ description: "Last modified date from article metadata" }),
    markdownLength: z.number().int().nullable().openapi({ description: "Character count of the raw markdown fetched from the scraping service (before LLM truncation)", example: 12500 }),
    createdAt: z.string().datetime().openapi({ description: "When this article record was first created" }),
    updatedAt: z.string().datetime().openapi({ description: "When this article record was last updated" }),
  })
  .openapi("Article");

export const TopicSchema = z
  .object({
    id: z.string().uuid().openapi({ description: "Unique topic identifier" }),
    topicName: z.string().openapi({ description: "Human-readable topic name", example: "Artificial Intelligence" }),
    createdAt: z.string().datetime().openapi({ description: "When this topic was created" }),
    updatedAt: z.string().datetime().openapi({ description: "When this topic was last updated" }),
  })
  .openapi("Topic");

export const ArticleDiscoverySchema = z
  .object({
    id: z.string().uuid().openapi({ description: "Unique discovery record identifier" }),
    articleId: z.string().uuid().openapi({ description: "ID of the discovered article" }),
    orgId: z.string().uuid().openapi({ description: "Organization that owns this discovery" }),
    brandIds: z.array(z.string().uuid()).openapi({ description: "Brands this discovery is scoped to", example: ["e0000000-0000-4000-8000-000000000001"] }),
    featureSlug: z.string().openapi({ description: "Feature that triggered this discovery", example: "press-outreach-v3" }),
    workflowSlug: z.string().nullable().openapi({ description: "Workflow that triggered this discovery" }),
    campaignId: z.string().uuid().openapi({ description: "Campaign this discovery belongs to" }),
    outletId: z.string().uuid().nullable().openapi({ description: "Outlet linked to this discovery (if from outlet discovery)" }),
    journalistId: z.string().uuid().nullable().openapi({ description: "Journalist linked to this discovery (if from journalist discovery)" }),
    topicId: z.string().uuid().nullable().openapi({ description: "Topic linked to this discovery" }),
    createdAt: z.string().datetime().openapi({ description: "When this discovery was created" }),
  })
  .openapi("ArticleDiscovery");

export const ArticleAuthorViewSchema = z
  .object({
    articleId: z.string().uuid().openapi({ description: "Article identifier" }),
    articleUrl: z.string().openapi({ description: "Canonical URL of the article" }),
    computedTitle: z.string().nullable().openapi({ description: "Best-effort title derived from og:title, twitter:title, or snippet" }),
    computedLargestContent: z.string().nullable().openapi({ description: "Longest content field available (for display/preview)" }),
    computedAuthors: z.array(z.string()).openapi({ description: "Deduplicated list of author names extracted from all metadata sources" }),
    computedPublishedAt: z.string().nullable().openapi({ description: "Best-effort publication date from available metadata" }),
    lastActivityAt: z.string().datetime().openapi({ description: "Most recent update across all linked records" }),
    articleCreatedAt: z.string().datetime().openapi({ description: "When the article was first indexed" }),
  })
  .openapi("ArticleAuthorView");

// --- Request body schemas ---

export const CreateArticleBodySchema = z
  .object({
    articleUrl: z.string().url().openapi({ description: "Canonical URL of the article (used as upsert key)", example: "https://techcrunch.com/2025/03/15/ai-funding-roundup" }),
    snippet: z.string().optional().openapi({ description: "Short text excerpt from the article" }),
    ogDescription: z.string().optional().openapi({ description: "OpenGraph og:description meta tag" }),
    twitterCreator: z.string().optional().openapi({ description: "Twitter/X @handle of the creator" }),
    newsKeywords: z.string().optional().openapi({ description: "Comma-separated news keywords" }),
    articlePublished: z.string().optional().openapi({ description: "Published date string from metadata" }),
    articleChannel: z.string().optional().openapi({ description: "Channel or vertical" }),
    twitterTitle: z.string().optional().openapi({ description: "Twitter/X card title" }),
    articleSection: z.string().optional().openapi({ description: "Section of the publication" }),
    author: z.string().optional().openapi({ description: "Serialized author data" }),
    ogTitle: z.string().optional().openapi({ description: "OpenGraph og:title" }),
    articleAuthor: z.string().optional().openapi({ description: "Raw author string from article:author meta tag" }),
    twitterDescription: z.string().optional().openapi({ description: "Twitter/X card description" }),
    articleModified: z.string().optional().openapi({ description: "Last modified date from metadata" }),
  })
  .openapi("CreateArticleBody");

export const BulkCreateArticlesBodySchema = z
  .object({ articles: z.array(CreateArticleBodySchema).openapi({ description: "Array of articles to upsert" }) })
  .openapi("BulkCreateArticlesBody");

export const CreateTopicBodySchema = z
  .object({ topicName: z.string().min(1).openapi({ description: "Topic name (used as upsert key)", example: "Artificial Intelligence" }) })
  .openapi("CreateTopicBody");

export const BulkCreateTopicsBodySchema = z
  .object({ topics: z.array(CreateTopicBodySchema).openapi({ description: "Array of topics to upsert" }) })
  .openapi("BulkCreateTopicsBody");

export const CreateDiscoveryBodySchema = z
  .object({
    articleId: z.string().uuid().openapi({ description: "ID of the article to link" }),
    outletId: z.string().uuid().optional().openapi({ description: "Outlet to associate with this discovery" }),
    journalistId: z.string().uuid().optional().openapi({ description: "Journalist to associate with this discovery" }),
    topicId: z.string().uuid().optional().openapi({ description: "Topic to associate with this discovery" }),
  })
  .openapi("CreateDiscoveryBody");

export const BulkCreateDiscoveriesBodySchema = z
  .object({ discoveries: z.array(CreateDiscoveryBodySchema).openapi({ description: "Array of discovery records to create" }) })
  .openapi("BulkCreateDiscoveriesBody");

export const SearchArticlesBodySchema = z
  .object({
    query: z.string().min(1).openapi({ description: "Full-text search query", example: "AI funding startup" }),
    limit: z.number().int().min(1).max(100).optional().default(20).openapi({ description: "Max results to return (default 20, max 100)" }),
    offset: z.number().int().min(0).optional().default(0).openapi({ description: "Number of results to skip for pagination" }),
  })
  .openapi("SearchArticlesBody");

// --- Discovery schemas ---

export const DiscoverOutletArticlesBodySchema = z
  .object({
    outletDomain: z.string().min(1).openapi({ description: "Domain of the outlet (e.g. techcrunch.com)", example: "techcrunch.com" }),
    maxArticles: z.number().int().min(1).max(20).optional().default(10).openapi({ description: "Max articles to discover (default 10)" }),
  })
  .openapi("DiscoverOutletArticlesBody");

export const DiscoverJournalistPublicationsBodySchema = z
  .object({
    journalistFirstName: z.string().min(1).openapi({ description: "Journalist first name", example: "Sarah" }),
    journalistLastName: z.string().min(1).openapi({ description: "Journalist last name", example: "Perez" }),
    outletDomain: z.string().min(1).openapi({ description: "Outlet domain to scope the Google News search via site: filter (e.g. 'techcrunch.com')", example: "techcrunch.com" }),
    maxResults: z.number().int().min(1).max(20).optional().default(10).openapi({ description: "Max publications to find (default 10, max 20)" }),
  })
  .openapi("DiscoverJournalistPublicationsBody");

export const ExtractedAuthorSchema = z
  .object({
    type: z.enum(["person", "organization"]).openapi({ description: "Whether this author is a person or an organization (news agency, editorial team, etc.)", example: "person" }),
    firstName: z.string().openapi({ description: "First name (empty string for organizations or single-name authors)", example: "Sarah" }),
    lastName: z.string().openapi({ description: "Last name, or full name for organizations", example: "Perez" }),
  })
  .openapi("ExtractedAuthor");

export const DiscoveredArticleSchema = z
  .object({
    articleId: z.string().uuid().openapi({ description: "ID of the upserted article record" }),
    articleUrl: z.string().openapi({ description: "URL of the discovered article", example: "https://techcrunch.com/2025/03/15/ai-funding-roundup" }),
    title: z.string().nullable().openapi({ description: "Article title from OpenGraph or search result" }),
    snippet: z.string().nullable().openapi({ description: "Short excerpt from the article" }),
    authors: z.array(ExtractedAuthorSchema).openapi({ description: "Authors extracted via scraping + LLM analysis" }),
    publishedAt: z.string().nullable().openapi({ description: "Publication date extracted from article metadata", example: "2025-03-15T10:00:00Z" }),
  })
  .openapi("DiscoveredArticle");

// --- Discoveries query schema ---

export const DiscoveriesQuerySchema = z
  .object({
    brandId: z.string().uuid().optional().openapi({ description: "Filter by brand ID" }),
    campaignId: z.string().uuid().optional().openapi({ description: "Filter by campaign ID" }),
    outletId: z.string().uuid().optional().openapi({ description: "Filter by outlet ID" }),
    journalistId: z.string().uuid().optional().openapi({ description: "Filter by journalist ID" }),
    topicId: z.string().uuid().optional().openapi({ description: "Filter by topic ID" }),
    featureSlugs: z.union([z.string(), z.array(z.string())]).optional().transform((v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : v)).openapi({ description: "Filter by feature slugs (comma-separated or single value)" }),
    featureDynastySlug: z.string().optional().openapi({ description: "Filter by feature dynasty slug (resolves to all versioned slugs via features-service)" }),
    workflowSlugs: z.union([z.string(), z.array(z.string())]).optional().transform((v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : v)).openapi({ description: "Filter by workflow slugs (comma-separated or single value)" }),
    workflowDynastySlug: z.string().optional().openapi({ description: "Filter by workflow dynasty slug (resolves to all versioned slugs via workflow-service)" }),
    limit: z.coerce.number().int().min(1).max(100).optional().openapi({ description: "Max results to return (default 20, max 100)" }),
    offset: z.coerce.number().int().min(0).optional().openapi({ description: "Number of results to skip for pagination" }),
  })
  .openapi("DiscoveriesQuery");

// --- Stats schemas ---

export const StatsGroupByEnum = z
  .enum([
    "brandId",
    "campaignId",
    "workflowSlug",
    "featureSlug",
    "workflowDynastySlug",
    "featureDynastySlug",
  ])
  .openapi("StatsGroupBy");

export const StatsQuerySchema = z
  .object({
    orgId: z.string().uuid().optional().openapi({ description: "Filter by organization ID" }),
    brandId: z.string().uuid().optional().openapi({ description: "Filter by brand ID" }),
    campaignId: z.string().uuid().optional().openapi({ description: "Filter by campaign ID" }),
    workflowSlug: z.string().optional().openapi({ description: "Filter by exact workflow slug" }),
    featureSlug: z.string().optional().openapi({ description: "Filter by exact feature slug" }),
    workflowDynastySlug: z.string().optional().openapi({ description: "Filter by workflow dynasty slug (resolves to all versioned slugs via workflow-service)" }),
    featureDynastySlug: z.string().optional().openapi({ description: "Filter by feature dynasty slug (resolves to all versioned slugs via features-service)" }),
    groupBy: StatsGroupByEnum.optional().openapi({ description: "Group results by dimension" }),
  })
  .openapi("StatsQuery");

export const DiscoveryStatsSchema = z
  .object({
    totalDiscoveries: z.number().openapi({ description: "Total number of article discoveries" }),
    uniqueArticles: z.number().openapi({ description: "Number of unique articles" }),
    uniqueOutlets: z.number().openapi({ description: "Number of unique outlets" }),
    uniqueJournalists: z.number().openapi({ description: "Number of unique journalists" }),
  })
  .openapi("DiscoveryStats");

export const FlatStatsResponseSchema = z
  .object({ stats: DiscoveryStatsSchema })
  .openapi("FlatStatsResponse");

export const GroupedStatsResponseSchema = z
  .object({
    groups: z.array(
      z.object({
        key: z.string(),
        stats: DiscoveryStatsSchema,
      }),
    ),
  })
  .openapi("GroupedStatsResponse");

// --- Shared header parameters ---

export const IdentityHeadersSchema = z.object({
  "x-org-id": z.string().uuid().openapi({ description: "Internal org UUID" }),
  "x-user-id": z.string().uuid().openapi({ description: "Internal user UUID" }),
  "x-run-id": z.string().uuid().openapi({ description: "Run UUID from runs-service" }),
  "x-workflow-slug": z.string().optional().openapi({ description: "Workflow slug for tracking" }),
  "x-feature-slug": z.string().optional().openapi({ description: "Feature slug for tracking/filtering" }),
  "x-brand-id": z.string().optional().openapi({ description: "Comma-separated brand UUIDs for scoping", example: "e0000000-0000-4000-8000-000000000001,e0000000-0000-4000-8000-000000000002" }),
  "x-campaign-id": z.string().uuid().optional().openapi({ description: "Campaign UUID for inter-service propagation" }),
});

// --- Register paths ---

registry.registerPath({
  method: "get",
  path: "/health",
  operationId: "getHealth",
  summary: "Health check",
  responses: {
    200: {
      description: "Service is healthy",
      content: { "application/json": { schema: HealthResponseSchema } },
    },
  },
});

// Articles CRUD

registry.registerPath({
  method: "post",
  path: "/v1/articles",
  operationId: "createArticle",
  summary: "Create or upsert an article by URL",
  description: "Inserts a new article or updates an existing one based on the articleUrl (unique key). Returns the full article record.",
  request: { headers: IdentityHeadersSchema, body: { content: { "application/json": { schema: CreateArticleBodySchema } } } },
  responses: {
    200: { description: "Article upserted", content: { "application/json": { schema: ArticleSchema } } },
    400: { description: "Invalid request", content: { "application/json": { schema: ValidationErrorResponseSchema } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/articles",
  operationId: "listArticles",
  summary: "List articles with pagination",
  request: {
    headers: IdentityHeadersSchema,
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    }),
  },
  responses: {
    200: { description: "List of articles", content: { "application/json": { schema: z.object({ articles: z.array(ArticleSchema) }) } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/articles/{id}",
  operationId: "getArticle",
  summary: "Get a single article by ID",
  request: { headers: IdentityHeadersSchema, params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: "Article found", content: { "application/json": { schema: ArticleSchema } } },
    404: { description: "Article not found", content: { "application/json": { schema: ErrorResponseSchema } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/articles/bulk",
  operationId: "bulkCreateArticles",
  summary: "Bulk upsert articles",
  description: "Upserts multiple articles in a single transaction. Each article is matched by articleUrl.",
  request: { headers: IdentityHeadersSchema, body: { content: { "application/json": { schema: BulkCreateArticlesBodySchema } } } },
  responses: {
    200: { description: "Articles upserted", content: { "application/json": { schema: z.object({ articles: z.array(ArticleSchema) }) } } },
    400: { description: "Invalid request", content: { "application/json": { schema: ValidationErrorResponseSchema } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Topics

registry.registerPath({
  method: "post",
  path: "/v1/topics",
  operationId: "createTopic",
  summary: "Create or upsert a topic by name",
  request: { headers: IdentityHeadersSchema, body: { content: { "application/json": { schema: CreateTopicBodySchema } } } },
  responses: {
    200: { description: "Topic upserted", content: { "application/json": { schema: TopicSchema } } },
    400: { description: "Invalid request", content: { "application/json": { schema: ValidationErrorResponseSchema } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/topics",
  operationId: "listTopics",
  summary: "List all topics",
  request: { headers: IdentityHeadersSchema },
  responses: {
    200: { description: "List of topics", content: { "application/json": { schema: z.object({ topics: z.array(TopicSchema) }) } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/topics/bulk",
  operationId: "bulkCreateTopics",
  summary: "Bulk upsert topics",
  request: { headers: IdentityHeadersSchema, body: { content: { "application/json": { schema: BulkCreateTopicsBodySchema } } } },
  responses: {
    200: { description: "Topics upserted", content: { "application/json": { schema: z.object({ topics: z.array(TopicSchema) }) } } },
    400: { description: "Invalid request", content: { "application/json": { schema: ValidationErrorResponseSchema } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Discoveries

registry.registerPath({
  method: "post",
  path: "/v1/discoveries",
  operationId: "createDiscovery",
  summary: "Link an article to a campaign context (org/brand/feature/campaign)",
  description: "Creates a discovery record that links an article to a specific org/brand/campaign context. Requires x-brand-id and x-campaign-id headers. Optionally associates the discovery with an outlet, journalist, or topic.",
  request: { headers: IdentityHeadersSchema, body: { content: { "application/json": { schema: CreateDiscoveryBodySchema } } } },
  responses: {
    200: { description: "Discovery created", content: { "application/json": { schema: ArticleDiscoverySchema } } },
    400: { description: "Invalid request", content: { "application/json": { schema: ValidationErrorResponseSchema } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/discoveries/bulk",
  operationId: "bulkCreateDiscoveries",
  summary: "Bulk link articles to campaign contexts",
  request: { headers: IdentityHeadersSchema, body: { content: { "application/json": { schema: BulkCreateDiscoveriesBodySchema } } } },
  responses: {
    200: { description: "Discoveries created", content: { "application/json": { schema: z.object({ discoveries: z.array(ArticleDiscoverySchema) }) } } },
    400: { description: "Invalid request", content: { "application/json": { schema: ValidationErrorResponseSchema } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/discoveries",
  operationId: "listDiscoveries",
  summary: "List article discoveries with filters",
  description: "List discoveries with optional filters. Supports filtering by featureDynastySlug (resolves to all versioned slugs via features-service), featureSlugs (comma-separated or single value), and equivalent workflow filters. Dynasty slug takes priority over slugs list.",
  request: {
    headers: IdentityHeadersSchema,
    query: DiscoveriesQuerySchema,
  },
  responses: {
    200: {
      description: "List of discoveries with article data",
      content: {
        "application/json": {
          schema: z.object({
            discoveries: z.array(z.object({
              discovery: ArticleDiscoverySchema,
              article: ArticleSchema,
            })),
          }),
        },
      },
    },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Computed views

registry.registerPath({
  method: "get",
  path: "/v1/articles/authors",
  operationId: "getArticlesWithAuthors",
  summary: "Articles with computed authors (v_articles_authors)",
  request: {
    headers: IdentityHeadersSchema,
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    }),
  },
  responses: {
    200: { description: "Articles with computed author data", content: { "application/json": { schema: z.object({ articles: z.array(ArticleAuthorViewSchema) }) } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Search

registry.registerPath({
  method: "post",
  path: "/v1/articles/search",
  operationId: "searchArticles",
  summary: "Full-text search across article fields",
  request: { headers: IdentityHeadersSchema, body: { content: { "application/json": { schema: SearchArticlesBodySchema } } } },
  responses: {
    200: { description: "Search results", content: { "application/json": { schema: z.object({ articles: z.array(ArticleSchema) }) } } },
    400: { description: "Invalid request", content: { "application/json": { schema: ValidationErrorResponseSchema } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Discovery pipelines

registry.registerPath({
  method: "post",
  path: "/v1/discover/outlet-articles",
  operationId: "discoverOutletArticles",
  summary: "Discover recent articles from an outlet via Google News + scraping, and create scoped discoveries",
  description: "Pipeline endpoint: (1) searches Google News for recent articles from the given outlet domain, (2) scrapes each article URL to extract authors and publication dates via LLM, (3) upserts the articles in the database, and (4) creates discovery records scoped to the campaign (x-brand-id, x-campaign-id headers required). Returns the discovered articles with extracted author details.",
  request: { headers: IdentityHeadersSchema, body: { content: { "application/json": { schema: DiscoverOutletArticlesBodySchema } } } },
  responses: {
    200: { description: "Discovered articles with extracted authors", content: { "application/json": { schema: z.object({ articles: z.array(DiscoveredArticleSchema) }) } } },
    400: { description: "Invalid request", content: { "application/json": { schema: ValidationErrorResponseSchema } } },
    502: { description: "Upstream service error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/discover/journalist-publications",
  operationId: "discoverJournalistPublications",
  summary: "Discover recent publications by a journalist and create scoped discoveries",
  description: "Pipeline endpoint: (1) searches Google News for recent articles by the given journalist (by name), (2) scrapes each article URL to extract authors and publication dates via LLM, (3) upserts the articles in the database, and (4) creates discovery records scoped to the campaign and journalist (x-brand-id, x-campaign-id headers required). Ideal for enriching pitch generation with a journalist's recent work.",
  request: { headers: IdentityHeadersSchema, body: { content: { "application/json": { schema: DiscoverJournalistPublicationsBodySchema } } } },
  responses: {
    200: { description: "Journalist publications with extracted authors", content: { "application/json": { schema: z.object({ articles: z.array(DiscoveredArticleSchema) }) } } },
    400: { description: "Invalid request", content: { "application/json": { schema: ValidationErrorResponseSchema } } },
    502: { description: "Upstream service error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Internal endpoints

registry.registerPath({
  method: "get",
  path: "/internal/articles/by-urls",
  operationId: "getArticlesByUrls",
  summary: "Batch lookup articles by URLs",
  description: "Returns all articles matching the given URLs. Used by other services to check which articles are already indexed. Pass URLs as a comma-separated query parameter.",
  request: {
    headers: IdentityHeadersSchema,
    query: z.object({ urls: z.string().describe("Comma-separated list of URLs") }),
  },
  responses: {
    200: { description: "Articles found", content: { "application/json": { schema: z.object({ articles: z.array(ArticleSchema) }) } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Stats endpoints

registry.registerPath({
  method: "get",
  path: "/v1/stats",
  operationId: "getStats",
  summary: "Get aggregated article discovery stats",
  description: "Get aggregated discovery stats optionally filtered by orgId, brandId, campaignId, workflowSlug, featureSlug, workflowDynastySlug, and/or featureDynastySlug. Dynasty slug filters resolve to all versioned slugs via the respective service. When groupBy is provided, returns grouped results.",
  request: {
    headers: IdentityHeadersSchema,
    query: StatsQuerySchema,
  },
  responses: {
    200: {
      description: "Aggregated stats (flat or grouped depending on groupBy parameter)",
      content: { "application/json": { schema: z.union([FlatStatsResponseSchema, GroupedStatsResponseSchema]) } },
    },
    400: { description: "Invalid request", content: { "application/json": { schema: ErrorResponseSchema } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/stats/public",
  operationId: "getStatsPublic",
  summary: "Get aggregated stats (service auth only)",
  description: "Same as GET /v1/stats but only requires X-API-Key (no x-org-id, x-user-id, x-run-id headers). Used by other services for stats aggregation.",
  request: {
    query: StatsQuerySchema,
  },
  responses: {
    200: {
      description: "Aggregated stats (flat or grouped depending on groupBy parameter)",
      content: { "application/json": { schema: z.union([FlatStatsResponseSchema, GroupedStatsResponseSchema]) } },
    },
    400: { description: "Invalid request", content: { "application/json": { schema: ErrorResponseSchema } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Security scheme

registry.registerComponent("securitySchemes", "ApiKeyAuth", {
  type: "apiKey",
  in: "header",
  name: "X-API-Key",
});
