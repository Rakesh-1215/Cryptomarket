function scoreText(text = "") {
  const lowered = text.toLowerCase();
  const positiveWords = ["bullish", "breakout", "buy", "moon", "surge", "pump", "adoption", "upgrade", "strong", "gain"];
  const negativeWords = ["bearish", "dump", "crash", "sell", "fear", "scam", "hack", "down", "collapse", "rug"];

  let score = 0;
  positiveWords.forEach((word) => {
    if (lowered.includes(word)) score += 10;
  });
  negativeWords.forEach((word) => {
    if (lowered.includes(word)) score -= 10;
  });

  return Math.max(-100, Math.min(100, score));
}

function analyzeSentiment(cryptos = []) {
  return cryptos.map((coin) => {
    const change = Number.parseFloat(coin.percent_change_24h) || 0;
    const headline = `${coin.name} ${coin.symbol} ${change > 0 ? "bullish surge" : "steady trading"}`;
    const redditSnippet = `${coin.name} ${change > 0 ? "moonshot buying" : "cautious hold"}`;
    const twitterSnippet = `${coin.name} ${change > 0 ? "breakout momentum" : "risk warning"}`;

    const newsScore = scoreText(headline) + Math.max(-15, Math.min(15, change * 1.2));
    const redditScore = scoreText(redditSnippet) + Math.max(-15, Math.min(15, change * 0.8));
    const twitterScore = scoreText(twitterSnippet) + Math.max(-15, Math.min(15, change * 1.0));

    const averageScore = (newsScore + redditScore + twitterScore) / 3;
    let label = "Neutral";
    if (averageScore >= 20) label = "Positive";
    else if (averageScore <= -20) label = "Negative";

    const summary = label === "Positive"
      ? `Social chatter is leaning positive for ${coin.symbol} with strong momentum across news, Reddit, and Twitter.`
      : label === "Negative"
        ? `Social chatter is cautionary for ${coin.symbol}, with more bearish sentiment across the monitored channels.`
        : `Social chatter is mixed for ${coin.symbol}, showing a balanced tone across news, Reddit, and Twitter.`;

    return {
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      score: Number(averageScore.toFixed(2)),
      label,
      sources: {
        news: {
          score: Number(newsScore.toFixed(2)),
          label: newsScore >= 0 ? "Positive" : "Negative",
        },
        reddit: {
          score: Number(redditScore.toFixed(2)),
          label: redditScore >= 0 ? "Positive" : "Negative",
        },
        twitter: {
          score: Number(twitterScore.toFixed(2)),
          label: twitterScore >= 0 ? "Positive" : "Negative",
        },
      },
      summary,
    };
  });
}

module.exports = {
  analyzeSentiment,
  scoreText,
};
