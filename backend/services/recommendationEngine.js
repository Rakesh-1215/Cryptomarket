function normalizeHoldingKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function inferProfile(transactions = []) {
  const totalValue = transactions.reduce((sum, tx) => sum + Number(tx.totalValue || 0), 0);
  const uniqueCoins = new Set(transactions.map((tx) => normalizeHoldingKey(tx.cryptoType)));
  const holdCount = uniqueCoins.size;

  if (totalValue >= 50000 || holdCount >= 4) {
    return {
      label: "Balanced",
      riskTolerance: "medium",
      description: "You hold a diversified set of assets and prefer steady growth.",
    };
  }

  if (totalValue >= 15000 || holdCount >= 2) {
    return {
      label: "Growth",
      riskTolerance: "medium-high",
      description: "You appear to favor growth opportunities and are comfortable with some volatility.",
    };
  }

  return {
    label: "Conservative",
    riskTolerance: "low",
    description: "You are just getting started and may prefer lower-risk ideas.",
  };
}

function buildPersonalizedRecommendations({ transactions = [], cryptos = [] }) {
  const ownedKeys = new Set(
    transactions.map((transaction) => normalizeHoldingKey(transaction.cryptoType)),
  );
  const profile = inferProfile(transactions);

  const scored = cryptos
    .filter((coin) => {
      const symbolKey = normalizeHoldingKey(coin.symbol);
      const nameKey = normalizeHoldingKey(coin.name);
      return !ownedKeys.has(symbolKey) && !ownedKeys.has(nameKey);
    })
    .map((coin) => {
      const trend = coin.ai?.trendPrediction;
      const risk = coin.ai?.risk;
      const trendScore = Number(trend?.confidence || 0);
      const riskScore = Number(risk?.score || 0);
      const change24h = Number.parseFloat(coin.percent_change_24h) || 0;
      const rank = Number.parseInt(coin.rank, 10) || 9999;

      let score = trendScore * 0.6 + Math.max(0, change24h) * 1.5 + (100 - rank) * 0.02;

      if (profile.riskTolerance === "low") {
        score -= riskScore * 0.6;
      } else if (profile.riskTolerance === "medium-high") {
        score += Math.max(0, change24h) * 0.8;
      } else {
        score += Math.max(0, change24h) * 0.2;
      }

      if (risk?.label === "High") {
        score -= 25;
      } else if (risk?.label === "Medium") {
        score += 3;
      } else {
        score += 8;
      }

      return {
        ...coin,
        score,
        riskLabel: risk?.label || "Unknown",
      };
    })
    .filter((coin) => coin.ai?.trendPrediction?.label !== "Down")
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((coin) => ({
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      price_usd: coin.price_usd,
      percent_change_24h: coin.percent_change_24h,
      ai: coin.ai,
      riskLabel: coin.riskLabel,
      reason: profile.riskTolerance === "low"
        ? `${coin.symbol} fits a ${profile.label.toLowerCase()} profile because it has ${coin.ai?.trendPrediction?.label?.toLowerCase() || "positive"} momentum and manageable risk.`
        : `${coin.symbol} matches your ${profile.label.toLowerCase()} profile with strong momentum and a favorable market signal.`,
    }));

  return {
    profile,
    recommendations: scored,
    portfolioSize: ownedKeys.size,
    ownedSymbols: [...ownedKeys],
  };
}

module.exports = {
  buildPersonalizedRecommendations,
  inferProfile,
  normalizeHoldingKey,
};
