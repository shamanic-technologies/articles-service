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

export const OutletTopicArticleSchema = z
  .object({
    outletId: z.string().uuid(),
    topicId: z.string().uuid(),
    articleId: z.string().uuid(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("OutletTopicArticle");

export const JournalistArticleSchema = z
  .object({
    articleId: z.string().uuid(),
    journalistId: z.string().uuid(),
  })
  .openapi("JournalistArticle");

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

export const CreateOutletTopicArticleBodySchema = z
  .object({
    outletId: z.string().uuid(),
    topicId: z.string().uuid(),
    articleId: z.string().uuid(),
  })
  .openapi("CreateOutletTopicArticleBody");

export const BulkCreateOutletTopicArticlesBodySchema = z
  .object({ links: z.array(CreateOutletTopicArticleBodySchema) })
  .openapi("BulkCreateOutletTopicArticlesBody");

export const CreateJournalistArticleBodySchema = z
  .object({
    articleId: z.string().uuid(),
    journalistId: z.string().uuid(),
  })
  .openapi("CreateJournalistArticleBody");

export const SearchArticlesBodySchema = z
  .object({
    query: z.string().min(1),
    limit: z.number().int().min(1).max(100).optional().default(20),
    offset: z.number().int().min(0).optional().default(0),
  })
  .openapi("SearchArticlesBody");

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
  request: { body: { content: { "application/json": { schema: CreateArticleBodySchema } } } },
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
  summary: "List articles with optional filters",
  request: {
    query: z.object({
      outletId: z.string().uuid().optional(),
      topicId: z.string().uuid().optional(),
      journalistId: z.string().uuid().optional(),
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
  request: { params: z.object({ id: z.string().uuid() }) },
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
  request: { body: { content: { "application/json": { schema: BulkCreateArticlesBodySchema } } } },
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
  request: { body: { content: { "application/json": { schema: CreateTopicBodySchema } } } },
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
  request: { body: { content: { "application/json": { schema: BulkCreateTopicsBodySchema } } } },
  responses: {
    200: { description: "Topics upserted", content: { "application/json": { schema: z.object({ topics: z.array(TopicSchema) }) } } },
    400: { description: "Invalid request", content: { "application/json": { schema: ValidationErrorResponseSchema } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Outlet-Topic-Articles linking

registry.registerPath({
  method: "post",
  path: "/v1/outlet-topic-articles",
  operationId: "createOutletTopicArticle",
  summary: "Link an article to an outlet and topic",
  request: { body: { content: { "application/json": { schema: CreateOutletTopicArticleBodySchema } } } },
  responses: {
    200: { description: "Link created", content: { "application/json": { schema: OutletTopicArticleSchema } } },
    400: { description: "Invalid request", content: { "application/json": { schema: ValidationErrorResponseSchema } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/outlet-topic-articles/bulk",
  operationId: "bulkCreateOutletTopicArticles",
  summary: "Bulk link articles to outlets and topics",
  request: { body: { content: { "application/json": { schema: BulkCreateOutletTopicArticlesBodySchema } } } },
  responses: {
    200: { description: "Links created", content: { "application/json": { schema: z.object({ links: z.array(OutletTopicArticleSchema) }) } } },
    400: { description: "Invalid request", content: { "application/json": { schema: ValidationErrorResponseSchema } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/outlet-topic-articles",
  operationId: "listOutletTopicArticles",
  summary: "List outlet-topic-article links",
  request: {
    query: z.object({
      outletId: z.string().uuid().optional(),
      topicId: z.string().uuid().optional(),
    }),
  },
  responses: {
    200: { description: "List of links", content: { "application/json": { schema: z.object({ links: z.array(OutletTopicArticleSchema) }) } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Journalist-Articles linking

registry.registerPath({
  method: "post",
  path: "/v1/journalist-articles",
  operationId: "createJournalistArticle",
  summary: "Link an article to a journalist",
  request: { body: { content: { "application/json": { schema: CreateJournalistArticleBodySchema } } } },
  responses: {
    200: { description: "Link created", content: { "application/json": { schema: JournalistArticleSchema } } },
    400: { description: "Invalid request", content: { "application/json": { schema: ValidationErrorResponseSchema } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/journalist-articles/{journalistId}",
  operationId: "getJournalistArticles",
  summary: "Get articles linked to a journalist",
  request: { params: z.object({ journalistId: z.string().uuid() }) },
  responses: {
    200: { description: "List of articles", content: { "application/json": { schema: z.object({ articles: z.array(ArticleSchema) }) } } },
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

registry.registerPath({
  method: "get",
  path: "/v1/articles/by-journalist/{journalistId}",
  operationId: "getArticlesByJournalist",
  summary: "Articles for a journalist (for AI relevance analysis)",
  request: { params: z.object({ journalistId: z.string().uuid() }) },
  responses: {
    200: { description: "Articles for journalist", content: { "application/json": { schema: z.object({ articles: z.array(ArticleAuthorViewSchema) }) } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/articles/by-journalist-outlet/{journalistId}/{outletId}",
  operationId: "getArticlesByJournalistOutlet",
  summary: "Articles by a journalist at a specific outlet",
  request: { params: z.object({ journalistId: z.string().uuid(), outletId: z.string().uuid() }) },
  responses: {
    200: { description: "Articles for journalist at outlet", content: { "application/json": { schema: z.object({ articles: z.array(ArticleAuthorViewSchema) }) } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Search

registry.registerPath({
  method: "post",
  path: "/v1/articles/search",
  operationId: "searchArticles",
  summary: "Full-text search across article fields",
  request: { body: { content: { "application/json": { schema: SearchArticlesBodySchema } } } },
  responses: {
    200: { description: "Search results", content: { "application/json": { schema: z.object({ articles: z.array(ArticleSchema) }) } } },
    400: { description: "Invalid request", content: { "application/json": { schema: ValidationErrorResponseSchema } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// Internal endpoints

registry.registerPath({
  method: "get",
  path: "/internal/articles/by-urls",
  operationId: "getArticlesByUrls",
  summary: "Batch lookup articles by URLs",
  request: {
    query: z.object({ urls: z.string().describe("Comma-separated list of URLs") }),
  },
  responses: {
    200: { description: "Articles found", content: { "application/json": { schema: z.object({ articles: z.array(ArticleSchema) }) } } },
    500: { description: "Internal server error", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/internal/articles/by-outlet-topic/{outletId}/{topicId}",
  operationId: "getArticlesByOutletTopic",
  summary: "Articles for an outlet+topic combo",
  request: { params: z.object({ outletId: z.string().uuid(), topicId: z.string().uuid() }) },
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
