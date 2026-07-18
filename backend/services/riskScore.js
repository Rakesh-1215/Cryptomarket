function calculateRiskScore(history = [], currentPrice = 0) {
  if (!history.length) {
    return {
      score: 50,
      label: "Medium",
      volatility: 0,
      sharpeProxy: 0,
      summary: "Not enough history to score risk confidently.",
    };
  }

  const prices = history.map((point) => Number(point.price) || 0).filter((price) => Number.isFinite(price));
  if (!prices.length) {
    return {
      score: 50,
      label: "Medium",
      volatility: 0,
      sharpeProxy: 0,
      summary: "Not enough history to score risk confidently.",
    };
  }

  const returns = [];
  for (let i = 1; i < prices.length; i += 1) {
    if (prices[i - 1] > 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }

  const avgReturn = returns.reduce((sum, value) => sum + value, 0) / Math.max(returns.length, 1);
  const variance = returns.reduce((sum, value) => sum + (value - avgReturn) ** 2, 0) / Math.max(returns.length, 1);
  const volatility = Math.sqrt(variance) * 100;
  const current = Number(currentPrice) || prices.at(-1) || 0;
  const drift = current > 0 ? ((prices.at(-1) || current) - current) / current * 100 : 0;
  const sharpeProxy = avgReturn * 100 / Math.max(volatility, 1);

  let score = 50 + volatility * 0.8 - Math.max(-20, Math.min(20, sharpeProxy)) * 0.5 + Math.max(-10, Math.min(10, drift));
  score = Math.max(5, Math.min(95, Math.round(score)));

  let label = "Medium";
  if (score >= 75) label = "High";
  else if (score <= 35) label = "Low";

  return {
    score,
    label,
    volatility: Number(volatility.toFixed(2)),
    sharpeProxy: Number(sharpeProxy.toFixed(2)),
    summary: label === "High"
      ? "Volatility is elevated and the recent history shows wider swings."
      : label === "Low"
        ? "Volatility is relatively contained, with steadier historical returns."
        : "Risk is moderate, with a balanced mix of upside and drawdown potential.",
  };
}

module.exports = {
  calculateRiskScore,
};
