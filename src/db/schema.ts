import { pgTable, uuid, text, timestamp, integer, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";

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
    markdownLength: integer("markdown_length"),
    wordCount: integer("word_count"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    extractedAt: timestamp("extracted_at", { withTimezone: true }),
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
    brandIds: uuid("brand_ids").array().notNull(),
    featureSlug: text("feature_slug").notNull(),
    workflowSlug: text("workflow_slug"),
    campaignId: uuid("campaign_id").notNull(),
    outletId: uuid("outlet_id"),
    journalistId: uuid("journalist_id"),
    topicId: uuid("topic_id").references(() => topics.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_ad_article").on(table.articleId),
    index("idx_ad_org").on(table.orgId),
    index("idx_ad_brand_ids").using("gin", table.brandIds),
    index("idx_ad_campaign").on(table.campaignId),
    index("idx_ad_outlet").on(table.outletId),
    index("idx_ad_journalist").on(table.journalistId),
    index("idx_ad_topic").on(table.topicId),
    index("idx_ad_article_campaign").on(table.articleId, table.campaignId),
    index("idx_ad_workflow_slug").on(table.workflowSlug),
    index("idx_ad_feature_slug").on(table.featureSlug),
  ]
);

// A journalist published an article mentioning a brand after we did outreach.
// The "win" / earned-media placement. Distinct from article_discoveries (research input).
export const articleMentions = pgTable(
  "article_mentions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id").notNull().references(() => articles.id),
    orgId: uuid("org_id").notNull(),
    brandIds: uuid("brand_ids").array().notNull(),
    outletId: uuid("outlet_id").notNull(),
    journalistId: uuid("journalist_id").notNull(),
    campaignId: uuid("campaign_id").notNull(),
    pitchId: uuid("pitch_id"),
    // Characteristics of the placement
    hasMention: boolean("has_mention").notNull(),
    hasQuote: boolean("has_quote").notNull(),
    hasLink: boolean("has_link").notNull(),
    linkDofollow: boolean("link_dofollow"),
    placementType: text("placement_type").notNull(), // 'organic' | 'sponsored'
    isPaid: boolean("is_paid").notNull(),
    costUsdCents: integer("cost_usd_cents"),
    source: text("source").notNull().default("manual"), // 'manual' | 'auto'
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_am_article").on(table.articleId),
    index("idx_am_org").on(table.orgId),
    index("idx_am_brand_ids").using("gin", table.brandIds),
    index("idx_am_outlet").on(table.outletId),
    index("idx_am_journalist").on(table.journalistId),
    index("idx_am_campaign").on(table.campaignId),
  ]
);

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
export type ArticleDiscovery = typeof articleDiscoveries.$inferSelect;
export type NewArticleDiscovery = typeof articleDiscoveries.$inferInsert;
export type ArticleMention = typeof articleMentions.$inferSelect;
export type NewArticleMention = typeof articleMentions.$inferInsert;
