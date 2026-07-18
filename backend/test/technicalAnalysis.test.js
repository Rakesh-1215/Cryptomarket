const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeTechnicalIndicators } = require("../services/technicalAnalysis");

test("analyzeTechnicalIndicators returns RSI, MACD, EMA, SMA and Bollinger data", () => {
  const result = analyzeTechnicalIndicators([
    {
      id: 1,
      name: "Bitcoin",
      symbol: "BTC",
      price_usd: "100",
      percent_change_1h: "0.8",
      percent_change_24h: "2.4",
      percent_change_7d: "5.1",
    },
  ]);

  assert.equal(result[0].symbol, "BTC");
  assert.ok(result[0].rsi >= 0 && result[0].rsi <= 100);
  assert.ok(typeof result[0].macd === "number");
  assert.ok(typeof result[0].ema === "number");
  assert.ok(typeof result[0].sma === "number");
  assert.ok(result[0].bollinger.upper > result[0].bollinger.lower);
  assert.ok(result[0].signal.length > 0);
});
