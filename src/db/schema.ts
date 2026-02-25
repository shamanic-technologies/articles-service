import { pgTable, uuid, text, timestamp, uniqueIndex, index, primaryKey } from "drizzle-orm/pg-core";

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

export const pressTopics = pgTable(
  "press_topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicName: text("topic_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_press_topics_name").on(table.topicName),
  ]
);

export const outletTopicArticles = pgTable(
  "outlet_topic_articles",
  {
    outletId: uuid("outlet_id").notNull(),
    topicId: uuid("topic_id").notNull().references(() => pressTopics.id),
    articleId: uuid("article_id").notNull().references(() => articles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.outletId, table.topicId, table.articleId] }),
    index("idx_ota_outlet").on(table.outletId),
    index("idx_ota_topic").on(table.topicId),
    index("idx_ota_article").on(table.articleId),
  ]
);

export const searchedJournalistArticles = pgTable(
  "searched_journalist_articles",
  {
    articleId: uuid("article_id").notNull().references(() => articles.id),
    journalistId: uuid("journalist_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.articleId, table.journalistId] }),
    index("idx_sja_journalist").on(table.journalistId),
  ]
);

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type PressTopic = typeof pressTopics.$inferSelect;
export type NewPressTopic = typeof pressTopics.$inferInsert;
export type OutletTopicArticle = typeof outletTopicArticles.$inferSelect;
export type SearchedJournalistArticle = typeof searchedJournalistArticles.$inferSelect;
