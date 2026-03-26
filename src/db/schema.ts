import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleUrl: text("article_url").notNull(),
    snippet: text("snippet"),
    ogDescription: text("og_description"),
    twitterCreator: text("twitter_creator"),
    newsKeywords: text("news_keywords"),
    articlePublished: text("article_published"),
    articleChannel: text("article_channel"),
    twitterTitle: text("twitter_title"),
    articleSection: text("article_section"),
    author: text("author"),
    ogTitle: text("og_title"),
    articleAuthor: text("article_author"),
    twitterDescription: text("twitter_description"),
    articleModified: text("article_modified"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_articles_url").on(table.articleUrl),
    index("idx_articles_created_at").on(table.createdAt),
  ]
);

export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicName: text("topic_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_topics_name").on(table.topicName),
  ]
);

export const articleDiscoveries = pgTable(
  "article_discoveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id").notNull().references(() => articles.id),
    orgId: uuid("org_id").notNull(),
    brandId: uuid("brand_id").notNull(),
    featureSlug: text("feature_slug").notNull(),
    campaignId: uuid("campaign_id").notNull(),
    outletId: uuid("outlet_id"),
    journalistId: uuid("journalist_id"),
    topicId: uuid("topic_id").references(() => topics.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_ad_article").on(table.articleId),
    index("idx_ad_org").on(table.orgId),
    index("idx_ad_brand").on(table.brandId),
    index("idx_ad_campaign").on(table.campaignId),
    index("idx_ad_outlet").on(table.outletId),
    index("idx_ad_journalist").on(table.journalistId),
    index("idx_ad_topic").on(table.topicId),
    index("idx_ad_article_campaign").on(table.articleId, table.campaignId),
  ]
);

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
export type ArticleDiscovery = typeof articleDiscoveries.$inferSelect;
export type NewArticleDiscovery = typeof articleDiscoveries.$inferInsert;
