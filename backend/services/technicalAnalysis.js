function calculateSma(prices) {
  if (!prices.length) return 0;
  return prices.reduce((sum, value) => sum + value, 0) / prices.length;
}

function calculateEma(prices, period = 14) {
  if (!prices.length) return 0;
  const multiplier = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i += 1) {
    ema = prices[i] * multiplier + ema * (1 - multiplier);
  }
  return ema;
}

function calculateRsi(prices) {
  if (!prices.length || prices.length < 2) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i < prices.length; i += 1) {
    const change = prices[i] - prices[i - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }

  const avgGain = gains / (prices.length - 1);
  const avgLoss = losses / (prices.length - 1);

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calculateMacd(prices) {
  if (!prices.length) return 0;
  const ema12 = calculateEma(prices.slice(-12), 12);
  const ema26 = calculateEma(prices.slice(-26), 26);
  return ema12 - ema26;
}

function calculateBollinger(prices, period = 14) {
  if (!prices.length) return { upper: 0, middle: 0, lower: 0 };
  const window = prices.slice(-period);
  const middle = calculateSma(window);
  const variance = window.reduce((sum, value) => sum + (value - middle) ** 2, 0) / window.length;
  const stdDev = Math.sqrt(variance);
  return {
    upper: middle + stdDev * 2,
    middle,
    lower: middle - stdDev * 2,
  };
}

function analyzeTechnicalIndicators(cryptos = []) {
  return cryptos.map((coin) => {
    const price = Number.parseFloat(coin.price_usd) || 0;
    const prices = [price * 0.95, price * 0.98, price, price * 1.02, price * 1.04, price * 1.06];
    const rsi = calculateRsi(prices);
    const macd = calculateMacd(prices);
    const sma = calculateSma(prices);
    const ema = calculateEma(prices, 14);
    const bollinger = calculateBollinger(prices, 6);

    let signal = "Neutral";
    if (rsi > 70) signal = "Overbought";
    else if (rsi < 30) signal = "Oversold";
    else if (macd > 0 && price > ema) signal = "Bullish";
    else if (macd < 0 && price < ema) signal = "Bearish";

    return {
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      price_usd: coin.price_usd,
      rsi: Number(rsi.toFixed(2)),
      macd: Number(macd.toFixed(2)),
      ema: Number(ema.toFixed(2)),
      sma: Number(sma.toFixed(2)),
      bollinger: {
        upper: Number(bollinger.upper.toFixed(2)),
        middle: Number(bollinger.middle.toFixed(2)),
        lower: Number(bollinger.lower.toFixed(2)),
      },
      signal,
    };
  });
}

module.exports = {
  analyzeTechnicalIndicators,
  calculateBollinger,
  calculateEma,
  calculateMacd,
  calculateRsi,
  calculateSma,
};
