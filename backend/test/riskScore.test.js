const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateRiskScore } = require("../services/riskScore");

test("calculateRiskScore returns a risk label and numeric metrics", () => {
  const result = calculateRiskScore([
    { price: 100 },
    { price: 95 },
    { price: 110 },
    { price: 105 },
  ], 105);

  assert.ok(result.score >= 1 && result.score <= 100);
  assert.ok(["Low", "Medium", "High"].includes(result.label));
  assert.ok(typeof result.volatility === "number");
  assert.ok(typeof result.sharpeProxy === "number");
  assert.ok(result.summary.length > 0);
});
