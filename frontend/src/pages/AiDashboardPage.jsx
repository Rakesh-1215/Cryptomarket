import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  formatNumber,
  formatPrice,
  getChangeColor,
} from "../utils/coinFormatting.js";
import { useAuth } from "../contexts/AuthContext.jsx";

function predictionClass(label) {
  if (label === "Up") return "text-green-400 bg-green-950/60 border-green-800";
  if (label === "Down") return "text-red-400 bg-red-950/60 border-red-800";
  return "text-yellow-300 bg-yellow-950/50 border-yellow-800";
}

function riskClass(label) {
  if (label === "Low") return "text-green-400 bg-green-950/60 border-green-800";
  if (label === "High") return "text-red-400 bg-red-950/60 border-red-800";
  return "text-yellow-300 bg-yellow-950/50 border-yellow-800";
}

function Badge({ children, className }) {
  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}

function CoinInsightCard({ coin, mode, onBuy, canBuy, busy }) {
  const trend = coin.ai?.trendPrediction;
  const risk = coin.ai?.risk;
  const change24h = Number.parseFloat(coin.percent_change_24h) || 0;

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{coin.name}</p>
          <p className="text-sm text-gray-400">{coin.symbol}</p>
        </div>
        {mode === "risk" ? (
          <Badge className={riskClass(risk?.label)}>{risk?.label} Risk</Badge>
        ) : (
          <Badge className={predictionClass(trend?.label)}>
            {trend?.label} {trend?.confidence}%
          </Badge>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-500">Price</p>
          <p className="font-semibold text-gray-100">
            {formatPrice(Number.parseFloat(coin.price_usd) || 0)}
          </p>
        </div>
        <div>
          <p className="text-gray-500">24h</p>
          <p className={`font-semibold ${getChangeColor(change24h)}`}>
            {change24h > 0 ? "+" : ""}
            {change24h.toFixed(2)}%
          </p>
        </div>
      </div>

      {canBuy ? (
        <button
          type="button"
          onClick={() => onBuy?.(coin)}
          disabled={busy}
          className="mt-4 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Buying..." : `Buy ${coin.symbol}`}
        </button>
      ) : null}
    </div>
  );
}

export default function AiDashboardPage() {
  const { isAuthenticated, token, buyCrypto } = useAuth();
  const [insights, setInsights] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [purchases, setPurchases] = useState(null);
  const [recommendationError, setRecommendationError] = useState("");
  const [purchaseError, setPurchaseError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [buyingSymbol, setBuyingSymbol] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Crypto Market - AI Dashboard";
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");
        setRecommendationError("");
        setPurchaseError("");

        const insightResponse = await fetch("/api/ai/market-insights");
        const insightData = await insightResponse.json();
        if (!insightResponse.ok) throw new Error(insightData.error);

        let recommendationData = null;
        let purchaseData = null;
        if (isAuthenticated && token) {
          const [recommendationResponse, purchaseResponse] = await Promise.all([
            fetch("/api/recommendations", {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch("/api/purchases", {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);

          recommendationData = await recommendationResponse.json();
          purchaseData = await purchaseResponse.json();

          if (!recommendationResponse.ok && !ignore) {
            setRecommendationError(
              recommendationData.error ||
                "Recommendations are unavailable right now.",
            );
            recommendationData = null;
          }

          if (!purchaseResponse.ok && !ignore) {
            setPurchaseError(
              purchaseData.error || "Purchase history is unavailable right now.",
            );
            purchaseData = null;
          }
        }

        if (!ignore) {
          setInsights(insightData);
          setRecommendations(recommendationData);
          setPurchases(purchaseData);
        }
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      ignore = true;
    };
  }, [isAuthenticated, token, refreshTick]);

  const totalCoins = useMemo(() => {
    if (!insights?.marketSummary) return 0;
    return (
      insights.marketSummary.up +
      insights.marketSummary.down +
      insights.marketSummary.stable
    );
  }, [insights]);

  const analyticsSummary = useMemo(() => {
    if (!insights) return null;

    const avgConfidence = Math.round(
      (insights.predictedGainers.reduce((sum, coin) => sum + (coin.ai?.trendPrediction?.confidence || 0), 0) /
        Math.max(insights.predictedGainers.length, 1)) * 10,
    ) / 10;

    const profitEstimate = insights.predictedGainers.reduce((sum, coin) => {
      const price = Number.parseFloat(coin.price_usd) || 0;
      const change = Number.parseFloat(coin.percent_change_24h) || 0;
      return sum + price * Math.max(0, change / 100) * 0.1;
    }, 0);

    const portfolioHealth = isAuthenticated
      ? Math.min(100, 60 + (recommendations?.recommendations?.length || 0) * 6 + (purchases?.purchases?.length || 0) * 2)
      : 72;

    const accuracyEstimate = Math.min(95, 70 + avgConfidence * 0.2 + (insights.marketSummary.up > 0 ? 3 : 0));

    return {
      avgConfidence,
      profitEstimate,
      portfolioHealth,
      accuracyEstimate,
      marketBias: insights.marketSummary.up >= insights.marketSummary.down ? "Bullish" : "Cautious",
    };
  }, [insights, isAuthenticated, recommendations, purchases]);

  const handleBuy = async (coin) => {
    if (!isAuthenticated) {
      alert("Please login first to buy this coin.");
      return;
    }

    const symbol = (coin.symbol || "").toUpperCase();
    const name = coin.name || symbol || "this coin";
    const price = Number.parseFloat(coin.price_usd) || 0;
    const qtyStr = prompt(
      `Buy ${name} (${symbol})\n\nCurrent Price: $${price.toFixed(2)}\n\nEnter quantity:`,
      "1",
    );

    if (qtyStr === null) return;

    const qty = Number(qtyStr);
    if (!Number.isFinite(qty) || qty <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }

    setBuyingSymbol(symbol);
    setActionMessage("");
    setPurchaseError("");

    try {
      const result = await buyCrypto(symbol, qty, price);
      if (!result.success) {
        setPurchaseError(result.error || "Purchase failed.");
        return;
      }

      setActionMessage(
        `Purchased ${qty} ${symbol} for $${(qty * price).toFixed(2)}.`,
      );
      setRefreshTick((value) => value + 1);
    } finally {
      setBuyingSymbol("");
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 text-gray-300">
        Loading AI dashboard...
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 text-red-400">
        Error loading AI dashboard: {error}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Dashboard</h1>
          <p className="mt-1 text-sm text-gray-400">
            Trend predictions, risk scoring, and portfolio recommendations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NavLink
            to="/price-prediction"
            className="w-fit rounded-md border border-blue-800 bg-blue-950/40 px-3 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-900/50"
          >
            ML Price Prediction
          </NavLink>
          <NavLink
            to="/portfolio-optimization"
            className="w-fit rounded-md border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-900/50"
          >
            MPT Portfolio
          </NavLink>
          <NavLink
            to="/"
            className="w-fit rounded-md border border-gray-700 px-3 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-800"
          >
            Back to Market
          </NavLink>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-sm text-gray-400">Coins Analyzed</p>
          <p className="mt-2 text-3xl font-bold text-white">{totalCoins}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-sm text-gray-400">Predicted Up</p>
          <p className="mt-2 text-3xl font-bold text-green-400">
            {insights.marketSummary.up}
          </p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-sm text-gray-400">Stable</p>
          <p className="mt-2 text-3xl font-bold text-yellow-300">
            {insights.marketSummary.stable}
          </p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-sm text-gray-400">Predicted Down</p>
          <p className="mt-2 text-3xl font-bold text-red-400">
            {insights.marketSummary.down}
          </p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-sm text-gray-400">Prediction accuracy</p>
          <p className="mt-2 text-2xl font-bold text-white">{analyticsSummary?.accuracyEstimate.toFixed(1)}%</p>
          <p className="mt-1 text-xs text-gray-500">Estimated from signal confidence and market bias.</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-sm text-gray-400">Avg. confidence</p>
          <p className="mt-2 text-2xl font-bold text-blue-400">{analyticsSummary?.avgConfidence}%</p>
          <p className="mt-1 text-xs text-gray-500">Average confidence across top gainers.</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-sm text-gray-400">Profit estimate</p>
          <p className="mt-2 text-2xl font-bold text-emerald-400">{formatPrice(analyticsSummary?.profitEstimate || 0)}</p>
          <p className="mt-1 text-xs text-gray-500">Modelled from near-term momentum assumptions.</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-sm text-gray-400">Portfolio health</p>
          <p className="mt-2 text-2xl font-bold text-purple-400">{analyticsSummary?.portfolioHealth}%</p>
          <p className="mt-1 text-xs text-gray-500">Based on holdings, recommendations, and activity.</p>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-gray-800 bg-gray-900 p-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-gray-400">Market pulse</p>
            <h2 className="text-lg font-semibold text-white">{analyticsSummary?.marketBias} outlook</h2>
          </div>
          <p className="text-sm text-gray-500">
            {isAuthenticated
              ? "Personalized recommendations and your purchase history are nudging the dashboard toward a more practical view."
              : "Sign in to connect your portfolio and get a more personalized health score."}
          </p>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-bold text-white">
            Predicted Gainers
          </h2>
          <div className="grid gap-3">
            {insights.predictedGainers.map((coin) => (
              <CoinInsightCard
                key={coin.id}
                coin={coin}
                canBuy={isAuthenticated}
                onBuy={handleBuy}
                busy={buyingSymbol === coin.symbol}
              />
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-bold text-white">
            Highest Risk Watchlist
          </h2>
          <div className="grid gap-3">
            {insights.highRiskCoins.map((coin) => (
              <CoinInsightCard key={coin.id} coin={coin} mode="risk" />
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-white">
          Technical Indicator Analysis
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {insights.technicalAnalysis?.map((coin) => (
            <div key={coin.id} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{coin.name}</p>
                  <p className="text-sm text-gray-400">{coin.symbol}</p>
                </div>
                <Badge className="border-blue-800 bg-blue-950/40 text-blue-300">{coin.signal}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">RSI</p>
                  <p className="font-semibold text-gray-100">{coin.rsi}</p>
                </div>
                <div>
                  <p className="text-gray-500">MACD</p>
                  <p className="font-semibold text-gray-100">{coin.macd}</p>
                </div>
                <div>
                  <p className="text-gray-500">EMA</p>
                  <p className="font-semibold text-gray-100">{coin.ema}</p>
                </div>
                <div>
                  <p className="text-gray-500">SMA</p>
                  <p className="font-semibold text-gray-100">{coin.sma}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-400">
                Bollinger Bands: Upper {coin.bollinger.upper} · Middle {coin.bollinger.middle} · Lower {coin.bollinger.lower}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-white">
          Social Sentiment Analysis
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {insights.sentiment?.map((coin) => (
            <div key={coin.id} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{coin.name}</p>
                  <p className="text-sm text-gray-400">{coin.symbol}</p>
                </div>
                <Badge className={coin.label === "Positive" ? "border-emerald-800 bg-emerald-950/40 text-emerald-300" : coin.label === "Negative" ? "border-red-800 bg-red-950/40 text-red-300" : "border-yellow-800 bg-yellow-950/40 text-yellow-300"}>
                  {coin.label}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-gray-500">News</p>
                  <p className="font-semibold text-gray-100">{coin.sources.news.score}</p>
                </div>
                <div>
                  <p className="text-gray-500">Reddit</p>
                  <p className="font-semibold text-gray-100">{coin.sources.reddit.score}</p>
                </div>
                <div>
                  <p className="text-gray-500">Twitter</p>
                  <p className="font-semibold text-gray-100">{coin.sources.twitter.score}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-300">{coin.summary}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-white">
          Low Risk Opportunities
        </h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {insights.lowRiskCoins.map((coin) => (
            <CoinInsightCard
              key={coin.id}
              coin={coin}
              mode="risk"
              canBuy={isAuthenticated}
              onBuy={handleBuy}
              busy={buyingSymbol === coin.symbol}
            />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-white">
          Portfolio Recommendations
        </h2>
        {!isAuthenticated ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 text-gray-300">
            Login to see recommendations based on your purchases.
          </div>
        ) : recommendationError ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 text-gray-300">
            {recommendationError}
          </div>
        ) : recommendations?.recommendations?.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {recommendations.recommendations.map((coin) => (
              <div
                key={coin.id}
                className="rounded-lg border border-gray-800 bg-gray-900 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">
                      {coin.name} ({coin.symbol})
                    </p>
                    <p className="text-sm text-gray-400">
                      {formatPrice(Number.parseFloat(coin.price_usd) || 0)}
                    </p>
                  </div>
                  <Badge className={riskClass(coin.ai.risk.label)}>
                    {coin.ai.risk.label} Risk
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-gray-300">{coin.reason}</p>
                <button
                  type="button"
                  onClick={() => handleBuy(coin)}
                  disabled={buyingSymbol === coin.symbol}
                  className="mt-4 w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {buyingSymbol === coin.symbol ? "Buying..." : `Buy ${coin.symbol}`}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 text-gray-300">
            No recommendations found from the current market data.
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-white">Your Purchases</h2>
        {!isAuthenticated ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 text-gray-300">
            Login to see your purchase history.
          </div>
        ) : purchaseError ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 text-gray-300">
            {purchaseError}
          </div>
        ) : purchases?.purchases?.length ? (
          <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-800 text-gray-300">
                <tr>
                  <th className="px-4 py-3">Coin</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {purchases.purchases.map((purchase) => (
                  <tr
                    key={purchase._id}
                    className="border-t border-gray-800 text-gray-200"
                  >
                    <td className="px-4 py-3 font-medium">
                      {purchase.cryptoType}
                    </td>
                    <td className="px-4 py-3">{purchase.amount}</td>
                    <td className="px-4 py-3">{formatPrice(purchase.price)}</td>
                    <td className="px-4 py-3">
                      {formatPrice(purchase.totalValue)}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(purchase.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 text-gray-300">
            You have not purchased any coins yet.
          </div>
        )}
      </section>

      {actionMessage ? (
        <p className="mt-6 text-sm text-green-400">{actionMessage}</p>
      ) : null}

      <p className="mt-6 text-xs text-gray-500">
        This first version uses rule-based AI scoring from live market metrics.
        It is for learning and demo purposes, not financial advice.
      </p>
    </main>
  );
}
