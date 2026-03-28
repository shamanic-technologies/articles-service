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
    id: z.string().uuid(),
    articleUrl: z.string().url(),
    snippet: z.string().nullable(),
    ogDescription: z.string().nullable(),
    twitterCreator: z.string().nullable(),
    newsKeywords: z.string().nullable(),
    articlePublished: z.string().nullable(),
    articleChannel: z.string().nullable(),
    twitterTitle: z.string().nullable(),
    articleSection: z.string().nullable(),
    author: z.string().nullable(),
    ogTitle: z.string().nullable(),
    articleAuthor: z.string().nullable(),
    twitterDescription: z.string().nullable(),
    articleModified: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Article");

export const TopicSchema = z
  .object({
    id: z.string().uuid(),
    topicName: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Topic");

export const ArticleDiscoverySchema = z
  .object({
    id: z.string().uuid(),
    articleId: z.string().uuid(),
    orgId: z.string().uuid(),
    brandId: z.string().uuid(),
    featureSlug: z.string(),
    campaignId: z.string().uuid(),
    outletId: z.string().uuid().nullable(),
    journalistId: z.string().uuid().nullable(),
    topicId: z.string().uuid().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi("ArticleDiscovery");

export const ArticleAuthorViewSchema = z
  .object({
    articleId: z.string().uuid(),
    articleUrl: z.string(),
    computedTitle: z.string().nullable(),
    computedLargestContent: z.string().nullable(),
    computedAuthors: z.array(z.string()),
    computedPublishedAt: z.string().nullable(),
    lastActivityAt: z.string().datetime(),
    articleCreatedAt: z.string().datetime(),
  })
  .openapi("ArticleAuthorView");

// --- Request body schemas ---

export const CreateArticleBodySchema = z
  .object({
    articleUrl: z.string().url(),
    snippet: z.string().optional(),
    ogDescription: z.string().optional(),
    twitterCreator: z.string().optional(),
    newsKeywords: z.string().optional(),
    articlePublished: z.string().optional(),
    articleChannel: z.string().optional(),
    twitterTitle: z.string().optional(),
    articleSection: z.string().optional(),
    author: z.string().optional(),
    ogTitle: z.string().optional(),
    articleAuthor: z.string().optional(),
    twitterDescription: z.string().optional(),
    articleModified: z.string().optional(),
  })
  .openapi("CreateArticleBody");

export const BulkCreateArticlesBodySchema = z
  .object({ articles: z.array(CreateArticleBodySchema) })
  .openapi("BulkCreateArticlesBody");

export const CreateTopicBodySchema = z
  .object({ topicName: z.string().min(1) })
  .openapi("CreateTopicBody");

export const BulkCreateTopicsBodySchema = z
  .object({ topics: z.array(CreateTopicBodySchema) })
  .openapi("BulkCreateTopicsBody");

export const CreateDiscoveryBodySchema = z
  .object({
    articleId: z.string().uuid(),
    outletId: z.string().uuid().optional(),
    journalistId: z.string().uuid().optional(),
    topicId: z.string().uuid().optional(),
  })
  .openapi("CreateDiscoveryBody");

export const BulkCreateDiscoveriesBodySchema = z
  .object({ discoveries: z.array(CreateDiscoveryBodySchema) })
  .openapi("BulkCreateDiscoveriesBody");

export const SearchArticlesBodySchema = z
  .object({
    query: z.string().min(1),
    limit: z.number().int().min(1).max(100).optional().default(20),
    offset: z.number().int().min(0).optional().default(0),
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
    journalistFirstName: z.string().min(1).openapi({ description: "Journalist first name" }),
    journalistLastName: z.string().min(1).openapi({ description: "Journalist last name" }),
    journalistId: z.string().uuid().openapi({ description: "Journalist UUID for linking" }),
    maxResults: z.number().int().min(1).max(20).optional().default(10).openapi({ description: "Max publications to find (default 10)" }),
  })
  .openapi("DiscoverJournalistPublicationsBody");

export const ExtractedAuthorSchema = z
  .object({
    type: z.enum(["person", "organization"]).openapi({ description: "Whether this author is a person or an organization (news agency, editorial team, etc.)" }),
    firstName: z.string().openapi({ description: "First name (empty for organizations or single-name authors)" }),
    lastName: z.string().openapi({ description: "Last name, or full name for organizations" }),
  })
  .openapi("ExtractedAuthor");

export const DiscoveredArticleSchema = z
  .object({
    articleId: z.string().uuid(),
    articleUrl: z.string(),
    title: z.string().nullable(),
    snippet: z.string().nullable(),
    authors: z.array(ExtractedAuthorSchema),
    publishedAt: z.string().nullable(),
  })
  .openapi("DiscoveredArticle");

// --- Shared header parameters ---

export const IdentityHeadersSchema = z.object({
  "x-org-id": z.string().uuid().openapi({ description: "Internal org UUID" }),
  "x-user-id": z.string().uuid().openapi({ description: "Internal user UUID" }),
  "x-run-id": z.string().uuid().openapi({ description: "Run UUID from runs-service" }),
  "x-workflow-slug": z.string().optional().openapi({ description: "Workflow slug for tracking" }),
  "x-feature-slug": z.string().optional().openapi({ description: "Feature slug for tracking/filtering" }),
  "x-brand-id": z.string().uuid().optional().openapi({ description: "Brand UUID for scoping" }),
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
  request: {
    headers: IdentityHeadersSchema,
    query: z.object({
      brandId: z.string().uuid().optional(),
      campaignId: z.string().uuid().optional(),
      outletId: z.string().uuid().optional(),
      journalistId: z.string().uuid().optional(),
      topicId: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    }),
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
  request: {
    headers: IdentityHeadersSchema,
    query: z.object({ urls: z.string().describe("Comma-separated list of URLs") }),
  },
  responses: {
    200: { description: "Articles found", content: { "application/json": { schema: z.object({ articles: z.array(ArticleSchema) }) } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Security scheme

registry.registerComponent("securitySchemes", "ApiKeyAuth", {
  type: "apiKey",
  in: "header",
  name: "X-API-Key",
});
