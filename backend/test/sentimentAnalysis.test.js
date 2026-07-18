const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeSentiment } = require("../services/sentimentAnalysis");

test("analyzeSentiment returns social sentiment with source breakdowns", () => {
  const result = analyzeSentiment([
    {
      id: 1,
      name: "Bitcoin",
      symbol: "BTC",
      price_usd: "30000",
      percent_change_24h: "2.4",
      rank: "1",
    },
  ]);

  assert.equal(result[0].symbol, "BTC");
  assert.ok(result[0].score >= -100 && result[0].score <= 100);
  assert.ok(["Positive", "Neutral", "Negative"].includes(result[0].label));
  assert.ok(result[0].sources.news.score !== undefined);
  assert.ok(result[0].sources.reddit.score !== undefined);
  assert.ok(result[0].sources.twitter.score !== undefined);
  assert.ok(result[0].summary.length > 0);
});
