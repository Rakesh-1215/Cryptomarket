const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPersonalizedRecommendations } = require("../services/recommendationEngine");

test("buildPersonalizedRecommendations favors low-risk growth picks for conservative users", () => {
  const transactions = [
    {
      cryptoType: "BTC",
      amount: 1,
      totalValue: 12000,
    },
  ];

  const cryptos = [
    {
      id: 1,
      name: "Bitcoin",
      symbol: "BTC",
      price_usd: "30000",
      percent_change_24h: "2.3",
      rank: "1",
      ai: { trendPrediction: { label: "Up", confidence: 88 }, risk: { label: "Low", score: 20 } },
    },
    {
      id: 2,
      name: "Solana",
      symbol: "SOL",
      price_usd: "160",
      percent_change_24h: "4.8",
      rank: "20",
      ai: { trendPrediction: { label: "Up", confidence: 82 }, risk: { label: "Medium", score: 45 } },
    },
    {
      id: 3,
      name: "Rogue Coin",
      symbol: "RGC",
      price_usd: "0.4",
      percent_change_24h: "6.1",
      rank: "150",
      ai: { trendPrediction: { label: "Up", confidence: 79 }, risk: { label: "High", score: 80 } },
    },
  ];

  const result = buildPersonalizedRecommendations({ transactions, cryptos });

  assert.equal(result.profile.label, "Conservative");
  assert.equal(result.recommendations[0].symbol, "SOL");
  assert.equal(result.recommendations[0].reason.includes("conservative"), true);
  assert.equal(result.recommendations[0].riskLabel, "Medium");
});
