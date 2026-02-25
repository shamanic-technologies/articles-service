import { db, sql } from "../../src/db/index.js";
import { articles, pressTopics, outletTopicArticles, searchedJournalistArticles } from "../../src/db/schema.js";

export async function cleanTestData() {
  // Delete in order respecting foreign keys
  await db.delete(searchedJournalistArticles);
  await db.delete(outletTopicArticles);
  await db.delete(articles);
  await db.delete(pressTopics);
}

export async function insertTestArticle(data: {
  articleUrl: string;
  ogTitle?: string;
  snippet?: string;
  ogDescription?: string;
  twitterCreator?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  author?: string;
  articleAuthor?: string;
  newsKeywords?: string;
  articlePublished?: string;
}) {
  const [article] = await db
    .insert(articles)
    .values(data)
    .returning();
  return article;
}

export async function insertTestTopic(topicName: string) {
  const [topic] = await db
    .insert(pressTopics)
    .values({ topicName })
    .returning();
  return topic;
}

export async function closeDb() {
  await sql.end();
}
