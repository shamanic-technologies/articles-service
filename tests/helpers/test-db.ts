import { db, sql } from "../../src/db/index.js";
import { articles, topics, articleDiscoveries } from "../../src/db/schema.js";

export async function cleanTestData() {
  // Delete in order respecting foreign keys
  await db.delete(articleDiscoveries);
  await db.delete(articles);
  await db.delete(topics);
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
    .insert(topics)
    .values({ topicName })
    .returning();
  return topic;
}

export async function insertTestDiscovery(data: {
  articleId: string;
  orgId: string;
  brandId: string;
  featureSlug: string;
  campaignId: string;
  outletId?: string | null;
  journalistId?: string | null;
  topicId?: string | null;
}) {
  const [discovery] = await db
    .insert(articleDiscoveries)
    .values({
      articleId: data.articleId,
      orgId: data.orgId,
      brandId: data.brandId,
      featureSlug: data.featureSlug,
      campaignId: data.campaignId,
      outletId: data.outletId ?? null,
      journalistId: data.journalistId ?? null,
      topicId: data.topicId ?? null,
    })
    .returning();
  return discovery;
}

export async function closeDb() {
  await sql.end();
}
