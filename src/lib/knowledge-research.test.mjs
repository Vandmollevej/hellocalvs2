// Kør: npm test — kun officielle/peer-reviewede kilder i Viden om mad.
import { test } from "node:test";
import assert from "node:assert/strict";
import { RESEARCH_ARTICLES } from "./knowledge-research.ts";

const ALLOWED_HOSTS = ["www.who.int", "www.borger.dk", "norden.org", "pubmed.ncbi.nlm.nih.gov"];

test("research articles only cite allowed official sources", () => {
  const slugs = RESEARCH_ARTICLES.map((a) => a.slug);
  assert.equal(new Set(slugs).size, slugs.length, "dublerede slugs");
  for (const article of RESEARCH_ARTICLES) {
    for (const source of [article.source, ...(article.moreSources ?? [])]) {
      const url = new URL(source.href);
      assert.equal(url.protocol, "https:", article.slug);
      assert.ok(ALLOWED_HOSTS.includes(url.hostname), `${article.slug}: ${url.hostname} er ikke på listen over officielle kilder`);
    }
  }
});
