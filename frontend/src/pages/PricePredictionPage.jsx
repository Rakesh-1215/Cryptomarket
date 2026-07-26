import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  formatPrice,
  getChangeColor,
} from "../utils/coinFormatting.js";
import { buildForecastChartData } from "../utils/forecastChart.js";
import BrandLogo from "../components/BrandLogo.jsx";
const MODEL_LABELS = {
  xgboost: "XGBoost",
  randomForest: "Random Forest",
};

function predictionClass(label) {
  if (label === "Up" || label === "Buy") return "text-green-400 bg-green-950/60 border-green-800";
  if (label === "Down" || label === "Sell") return "text-red-400 bg-red-950/60 border-red-800";
  return "text-yellow-300 bg-yellow-950/50 border-yellow-800";
}

function signalClass(signal) {
  return predictionClass(signal);
}

function confidenceLabel(value) {
  const pct = Number(value) || 0;
  if (pct >= 80) return "High";
  if (pct >= 65) return "Medium";
  return "Low";
}

function ConfidenceBar({ value, signal }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const barColor =
    signal === "Buy"
      ? "bg-green-500"
      : signal === "Sell"
        ? "bg-red-500"
        : "bg-yellow-500";

  return (
    <div className="mt-2">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-gray-500">Confidence</span>
        <span className="font-semibold text-gray-200">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-800">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ProbabilityBar({ probIncrease, probDecrease, compact = false }) {
  const up = Math.max(0, Math.min(100, Number(probIncrease) || 0));
  const down = Math.max(0, Math.min(100, Number(probDecrease) || 0));

  return (
    <div className={compact ? "" : "mt-3"}>
      {!compact ? (
        <div className="mb-2 flex justify-between text-xs font-semibold">
          <span className="text-green-400">Increase {up}%</span>
          <span className="text-red-400">Decrease {down}%</span>
        </div>
      ) : null}
      <div className="flex h-2.5 overflow-hidden rounded-full bg-gray-800">
        <div className="bg-green-500 transition-all" style={{ width: `${up}%` }} />
        <div className="bg-red-500 transition-all" style={{ width: `${down}%` }} />
      </div>
    </div>
  );
}

function ProbabilityPanel({ probabilities, ensemble, symbol }) {
  const probUp = probabilities?.increase ?? ensemble?.probIncrease ?? 50;
  const probDown = probabilities?.decrease ?? ensemble?.probDecrease ?? 50;
  const historical = probabilities?.historical ?? ensemble?.historicalProbabilities;
  const modelsUp = probabilities?.modelsPredictingUp ?? ensemble?.modelsPredictingUp ?? 0;
  const modelsDown = probabilities?.modelsPredictingDown ?? ensemble?.modelsPredictingDown ?? 0;

  return (
    <section className="mt-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Price direction probabilities</h2>
          <p className="text-sm text-gray-400">
            Next-day chance of increase vs decrease for {symbol}
          </p>
        </div>
        {historical?.sampleDays ? (
          <p className="text-xs text-gray-500">
            Historical baseline: {historical.probIncrease}% up / {historical.probDecrease}% down
            ({historical.sampleDays} days)
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-5">
          <p className="text-sm text-gray-400">ML ensemble forecast</p>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <p className="text-3xl font-bold text-green-400">{probUp}%</p>
              <p className="text-sm text-gray-500">Probability of increase</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-red-400">{probDown}%</p>
              <p className="text-sm text-gray-500">Probability of decrease</p>
            </div>
          </div>
          <ProbabilityBar probIncrease={probUp} probDecrease={probDown} />
          <p className="mt-3 text-xs text-gray-500">
            {modelsUp} model{modelsUp === 1 ? "" : "s"} predict up, {modelsDown} predict down
          </p>
        </div>

        {historical?.sampleDays ? (
          <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-5">
            <p className="text-sm text-gray-400">Historical frequency</p>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <p className="text-3xl font-bold text-green-400">{historical.probIncrease}%</p>
                <p className="text-sm text-gray-500">Past up days ({historical.upDays})</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-red-400">{historical.probDecrease}%</p>
                <p className="text-sm text-gray-500">Past down days ({historical.downDays})</p>
              </div>
            </div>
            <ProbabilityBar
              probIncrease={historical.probIncrease}
              probDecrease={historical.probDecrease}
            />
            <p className="mt-3 text-xs text-gray-500">
              Used as 25% weight in the ensemble probability blend
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SignalHero({ recommendation, ensemble, prediction, symbol }) {
  if (!recommendation?.signal) return null;

  const signal = recommendation.signal;
  const confidence = recommendation.confidence || ensemble?.confidence || 0;
  const confidenceText = confidenceLabel(confidence);
  const changePercent = ensemble?.changePercent ?? 0;
  const rmse = prediction?.evaluation?.regression?.rmse;
  const votes = recommendation.votes || ensemble?.votes || {};

  return (
    <section className="mt-8 rounded-2xl border border-gray-800 bg-black/60 p-6 shadow-2xl shadow-black/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-white">Recommendations</p>     
        </div>
        <span className={`inline-flex rounded-lg border px-3 py-1 text-xs font-semibold ${signalClass(signal)}`}>
          {signal}
        </span>
      </div>

      <div className="mt-5 rounded-2xl bg-gray-900/80 p-5 font-mono text-sm leading-7 text-gray-100">
        <div>Signal: {signal}</div>
        <div>
          Predicted Change: {changePercent >= 0 ? "+" : ""}
          {changePercent.toFixed(2)}%
        </div>
        <div>Model Confidence: {confidenceText}</div>
        <div>RMSE: {rmse != null ? formatPrice(rmse) : "N/A"}</div>
      </div>

      {recommendation.summary ? (
        <p className="mt-4 max-w-3xl text-sm text-gray-400">{recommendation.summary}</p>
      ) : null}

      {recommendation.probIncrease != null ? (
        <div className="mt-4 max-w-md">
          <ProbabilityBar
            probIncrease={recommendation.probIncrease}
            probDecrease={recommendation.probDecrease}
          />
        </div>
      ) : null}

      <div className="mt-5 grid min-w-[220px] grid-cols-3 gap-3">
        {["Buy", "Hold", "Sell"].map((voteLabel) => (
          <div
            key={voteLabel}
            className={`rounded-lg border p-3 text-center ${
              signal === voteLabel
                ? "border-blue-700 bg-blue-950/30"
                : "border-gray-800 bg-gray-900/50"
            }`}
          >
            <p className="text-xs text-gray-500">{voteLabel}</p>
            <p className="mt-1 text-xl font-bold text-white">{votes[voteLabel] ?? 0}</p>
            <p className="text-xs text-gray-500">votes</p>
          </div>
        ))}
      </div>

      <ConfidenceBar value={confidence} signal={signal} />
    </section>
  );
}

function ModelCard({ modelKey, result, currentPrice }) {
  const label = MODEL_LABELS[modelKey] || modelKey;

  if (result?.error) {
    return (
      <div className="rounded-lg border border-red-900/60 bg-gray-900 p-4">
        <p className="font-semibold text-white">{label}</p>
        <p className="mt-2 text-sm text-red-400">{result.error}</p>
      </div>
    );
  }

  const change = Number(result?.changePercent) || 0;

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-white">{label}</p>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${signalClass(result?.signal)}`}
          >
            {result?.signal || "Hold"} {result?.confidence ?? 0}%
          </span>
          <span
            className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-medium ${predictionClass(result?.direction)}`}
          >
            {result?.direction}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">Predicted price</span>
          <span className="font-semibold text-gray-100">
            {formatPrice(result?.predictedPrice || 0)}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">vs current</span>
          <span className={`font-semibold ${getChangeColor(change)}`}>
            {change > 0 ? "+" : ""}
            {change.toFixed(2)}%
          </span>
        </div>
        {result?.probIncrease != null ? (
          <div className="pt-1">
            <div className="flex justify-between gap-3 text-xs">
              <span className="text-green-400">↑ {result.probIncrease}%</span>
              <span className="text-red-400">↓ {result.probDecrease}%</span>
            </div>
            <ProbabilityBar
              probIncrease={result.probIncrease}
              probDecrease={result.probDecrease}
              compact
            />
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">RMSE</span>
          <span className="text-gray-300">
            {formatPrice(result?.metrics?.rmse || 0)}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">MAE</span>
          <span className="text-gray-300">
            {formatPrice(result?.metrics?.mae || 0)}
          </span>
        </div>
      </div>
    </div>
  );
}

function HistoryChart({ history, predictedPrice, currentPrice }) {
  if (!history?.length) return null;

  const chartData = buildForecastChartData(history, currentPrice, predictedPrice, 5);
  const historicalPoints = chartData.historical.map((point) => `${point.x},${point.y}`).join(" ");
  const forecastPoints = chartData.forecast.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-gray-400">Interactive forecast path</p>
        <p className="text-xs text-gray-500">Hover to inspect signal points</p>
      </div>
      <svg viewBox="0 0 100 100" className="h-48 w-full" preserveAspectRatio="none">
        <line x1="0" y1="100" x2="100" y2="0" stroke="rgba(255,255,255,0.06)" strokeDasharray="2 2" />
        <polyline fill="none" stroke="#3b82f6" strokeWidth="1.2" points={historicalPoints} />
        <polyline fill="none" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="2 2" points={forecastPoints} />
        {chartData.series.map((point) => (
          <circle
            key={`${point.type}-${point.index}`}
            cx={point.x}
            cy={point.y}
            r="1.5"
            fill={point.type === "forecast" ? "#22c55e" : "#3b82f6"}
          />
        ))}
      </svg>
      <div className="mt-3 flex justify-between text-xs text-gray-500">
        <span>{history[0]?.date}</span>
        <span className="text-green-400">Forecast horizon</span>
        <span>{chartData.forecast.at(-1)?.date || history.at(-1)?.date}</span>
      </div>
    </div>
  );
}

export default function PricePredictionPage() {
  const [coins, setCoins] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState("BTC");
  const [days, setDays] = useState(90);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Crypto Market - ML Price Prediction";
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadCoins() {
      try {
        const response = await fetch("/api/ai/predictable-coins");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!ignore && data.coins?.length) {
          setCoins(data.coins);
          setSelectedSymbol(data.coins[0].symbol);
        }
      } catch {
        if (!ignore) {
          setCoins([
            { symbol: "BTC", name: "Bitcoin", coinId: "bitcoin" },
            { symbol: "ETH", name: "Ethereum", coinId: "ethereum" },
          ]);
        }
      }
    }

    loadCoins();
    return () => {
      ignore = true;
    };
  }, []);

  const selectedCoin = useMemo(
    () => coins.find((coin) => coin.symbol === selectedSymbol),
    [coins, selectedSymbol],
  );

  const runPrediction = async (force = false) => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        symbol: selectedSymbol,
        days: String(days),
      });
      if (force) params.set("force", "true");

      const response = await fetch(`/api/ai/price-prediction?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPrediction(data);
    } catch (err) {
      setPrediction(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedSymbol) return;
    runPrediction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSymbol, days]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          {/* <BrandLogo /> */}
          <div>
            <h1 className="text-2xl font-bold text-white">ML Price Prediction</h1>
            <p className="mt-1 text-sm text-gray-400">
              Buy / Sell / Hold signals, confidence scores, and increase/decrease probabilities.
            </p>
          </div>
        </div>
        <NavLink
          to="/ai-dashboard"
          className="w-fit rounded-md border border-gray-700 px-3 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-800"
        >
          AI Dashboard
        </NavLink>
      </div>

      <section className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-gray-400">Cryptocurrency</label>
            <select
              value={selectedSymbol}
              onChange={(event) => setSelectedSymbol(event.target.value)}
              className="w-full rounded-md border border-gray-700 bg-black px-3 py-2 text-sm text-white"
            >
              {coins.map((coin) => (
                <option key={coin.symbol} value={coin.symbol}>
                  {coin.name} ({coin.symbol})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-400">History window</label>
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="w-full rounded-md border border-gray-700 bg-black px-3 py-2 text-sm text-white"
            >
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
              <option value={180}>180 days</option>
              <option value={365}>365 days</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => runPrediction(true)}
              disabled={loading}
              className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Training models..." : "Refresh prediction"}
            </button>
          </div>
        </div>
      </section>

      {loading && !prediction ? (
        <p className="mt-8 text-gray-300">Running ML models. This may take a minute...</p>
      ) : null}

      {error ? (
        <p className="mt-8 text-red-400">Error: {error}</p>
      ) : null}

      {prediction ? (
        <>
          <SignalHero
            recommendation={prediction.recommendation}
            ensemble={prediction.ensemble}
            prediction={prediction}
            symbol={prediction.symbol}
          />

          <ProbabilityPanel
            probabilities={prediction.probabilities}
            ensemble={prediction.ensemble}
            symbol={prediction.symbol}
          />

          <section className="mt-8 grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              <p className="text-sm text-gray-400">Selected coin</p>
              <p className="mt-2 text-xl font-bold text-white">
                {selectedCoin?.name || prediction.symbol}
              </p>
              <p className="text-sm text-gray-500">{prediction.symbol}</p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              <p className="text-sm text-gray-400">Current price</p>
              <p className="mt-2 text-xl font-bold text-white">
                {formatPrice(prediction.currentPrice)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              <p className="text-sm text-gray-400">Ensemble signal</p>
              <p className={`mt-2 text-xl font-bold ${signalClass(prediction.ensemble?.signal)}`}>
                {prediction.ensemble?.signal || "Hold"}
              </p>
              <p className="text-sm text-gray-500">
                {prediction.ensemble?.confidence ?? 0}% confidence
              </p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              <p className="text-sm text-gray-400">P(increase)</p>
              <p className="mt-2 text-xl font-bold text-green-400">
                {prediction.probabilities?.increase ?? prediction.ensemble?.probIncrease ?? 50}%
              </p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              <p className="text-sm text-gray-400">P(decrease)</p>
              <p className="mt-2 text-xl font-bold text-red-400">
                {prediction.probabilities?.decrease ?? prediction.ensemble?.probDecrease ?? 50}%
              </p>
            </div>
          </section>

          <section className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              <p className="text-sm text-gray-400">Risk score</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-2xl font-bold text-white">
                  {prediction.riskScore?.score ?? 50}/100
                </p>
                <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${prediction.riskScore?.label === "High" ? "border-red-800 bg-red-950/40 text-red-300" : prediction.riskScore?.label === "Low" ? "border-green-800 bg-green-950/40 text-green-300" : "border-yellow-800 bg-yellow-950/40 text-yellow-300"}`}>
                  {prediction.riskScore?.label ?? "Medium"}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-500">{prediction.riskScore?.summary}</p>
              <p className="mt-2 text-xs text-gray-500">
                Volatility {prediction.riskScore?.volatility ?? 0}% · Sharpe proxy {prediction.riskScore?.sharpeProxy ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              <p className="text-sm text-gray-400">Ensemble forecast price</p>
              <p className="mt-2 text-2xl font-bold text-white">
                {formatPrice(prediction.ensemble?.predictedPrice || 0)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              <p className="text-sm text-gray-400">Model agreement</p>
              <p className="mt-2 text-2xl font-bold text-blue-400">
                {prediction.ensemble?.modelsAgreeing ?? 0}/{prediction.ensemble?.modelsTotal ?? 0}
              </p>
              <p className="text-sm text-gray-500">
                {prediction.ensemble?.agreementPercent ?? 0}% aligned on{" "}
                {prediction.ensemble?.signal || "Hold"}
              </p>
            </div>
          </section>

          <section className="mt-8">
            <HistoryChart
              history={prediction.history}
              predictedPrice={prediction.ensemble?.predictedPrice}
              currentPrice={prediction.currentPrice}
            />
          </section>

          <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-2">
            {Object.keys(MODEL_LABELS).map((modelKey) => (
              <ModelCard
                key={modelKey}
                modelKey={modelKey}
                result={prediction.models?.[modelKey]}
                currentPrice={prediction.currentPrice}
              />
            ))}
          </section>

          <p className="mt-6 text-xs text-gray-500">
            Models train on CoinGecko daily history ({prediction.historicalDays} days).
            {prediction.cached ? " Served from cache." : " Fresh run."}{" "}
            Educational demo only — not financial advice.
          </p>
        </>
      ) : null}
    </main>
  );
}
