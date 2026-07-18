import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { formatPrice } from "../utils/coinFormatting.js";
import { useAuth } from "../contexts/AuthContext.jsx";

const PORTFOLIO_KEYS = ["maxSharpe", "minVariance", "equalWeight", "current"];

const PORTFOLIO_LABELS = {
  maxSharpe: "Max Sharpe",
  minVariance: "Min Variance",
  equalWeight: "Equal Weight",
  current: "Your Portfolio",
};

function pct(value) {
  return `${(Number(value) * 100).toFixed(2)}%`;
}

function MetricCard({ label, value, accent = "text-white" }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function EfficientFrontierChart({ frontier, portfolios }) {
  if (!frontier?.length) return null;

  const points = frontier.map((point) => ({
    x: point.volatility * 100,
    y: point.expectedReturn * 100,
  }));

  const markers = ["maxSharpe", "minVariance", "equalWeight"]
    .map((key) => portfolios?.[key]?.metrics)
    .filter(Boolean)
    .map((metrics) => ({
      x: metrics.volatility * 100,
      y: metrics.expectedReturn * 100,
    }));

  const allX = [...points.map((p) => p.x), ...markers.map((p) => p.x)];
  const allY = [...points.map((p) => p.y), ...markers.map((p) => p.y)];
  const minX = Math.min(...allX) * 0.95;
  const maxX = Math.max(...allX) * 1.05;
  const minY = Math.min(...allY) * 0.95;
  const maxY = Math.max(...allY) * 1.05;
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const toSvg = (x, y) => ({
    sx: ((x - minX) / rangeX) * 100,
    sy: 100 - ((y - minY) / rangeY) * 100,
  });

  const polyline = points
    .map((point) => {
      const { sx, sy } = toSvg(point.x, point.y);
      return `${sx},${sy}`;
    })
    .join(" ");

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <p className="mb-1 text-sm font-semibold text-white">Efficient frontier</p>
      <p className="mb-4 text-xs text-gray-500">
        Risk (volatility) vs expected return — blue curve; green dot = max Sharpe
      </p>
      <svg viewBox="0 0 100 100" className="h-56 w-full rounded-md bg-gray-950">
        <polyline fill="none" stroke="#3b82f6" strokeWidth="1.2" points={polyline} />
        {markers[0] ? (
          (() => {
            const { sx, sy } = toSvg(markers[0].x, markers[0].y);
            return <circle cx={sx} cy={sy} r="2.5" fill="#22c55e" />;
          })()
        ) : null}
      </svg>
      <div className="mt-2 flex justify-between text-xs text-gray-500">
        <span>Lower risk</span>
        <span>Higher return</span>
      </div>
    </div>
  );
}

function AllocationTable({ portfolio }) {
  if (!portfolio?.allocations?.length) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-800 text-gray-300">
          <tr>
            <th className="px-4 py-3">Asset</th>
            <th className="px-4 py-3">Weight</th>
            <th className="px-4 py-3">Allocation</th>
            <th className="px-4 py-3">Units</th>
          </tr>
        </thead>
        <tbody>
          {portfolio.allocations.map((row) => (
            <tr key={row.symbol} className="border-t border-gray-800 text-gray-200">
              <td className="px-4 py-3 font-medium">{row.symbol}</td>
              <td className="px-4 py-3">{row.weight}%</td>
              <td className="px-4 py-3">{formatPrice(row.allocationUsd)}</td>
              <td className="px-4 py-3 text-gray-400">{row.units}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PortfolioOptimizationPage() {
  const { isAuthenticated, token } = useAuth();
  const [universe, setUniverse] = useState([]);
  const [selected, setSelected] = useState(["BTC", "ETH", "SOL", "BNB", "XRP", "ADA"]);
  const [days, setDays] = useState(90);
  const [budget, setBudget] = useState(10000);
  const [riskFreeRate, setRiskFreeRate] = useState(4);
  const [includeHoldings, setIncludeHoldings] = useState(true);
  const [activePortfolio, setActivePortfolio] = useState("maxSharpe");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Crypto Market - Portfolio Optimization";
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadUniverse() {
      try {
        const response = await fetch("/api/ai/portfolio/universe");
        const data = await response.json();
        if (!ignore && data.assets?.length) setUniverse(data.assets);
      } catch {
        if (!ignore) {
          setUniverse([
            { symbol: "BTC", name: "Bitcoin" },
            { symbol: "ETH", name: "Ethereum" },
            { symbol: "SOL", name: "Solana" },
          ]);
        }
      }
    }

    loadUniverse();
    return () => {
      ignore = true;
    };
  }, []);

  const portfolioTabs = useMemo(() => {
    if (!result?.portfolios) return [];
    return PORTFOLIO_KEYS.filter((key) => result.portfolios[key]);
  }, [result]);

  useEffect(() => {
    if (portfolioTabs.length && !portfolioTabs.includes(activePortfolio)) {
      setActivePortfolio(portfolioTabs[0]);
    }
  }, [portfolioTabs, activePortfolio]);

  const runOptimization = async (force = false) => {
    if (selected.length < 2) {
      setError("Select at least 2 assets.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        symbols: selected.join(","),
        days: String(days),
        budget: String(budget),
        riskFreeRate: String(riskFreeRate / 100),
      });
      if (force) params.set("force", "true");
      if (includeHoldings && isAuthenticated) params.set("includeHoldings", "true");

      const headers = {};
      if (isAuthenticated && token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`/api/ai/portfolio/optimize?${params}`, { headers });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selected.length >= 2) runOptimization();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, days, budget, riskFreeRate, includeHoldings, isAuthenticated]);

  const active = result?.portfolios?.[activePortfolio] || result?.recommended;

  function toggleSymbol(symbol) {
    setSelected((current) => {
      if (current.includes(symbol)) {
        return current.filter((item) => item !== symbol);
      }
      if (current.length >= 8) return current;
      return [...current, symbol];
    });
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Portfolio Optimization</h1>
          <p className="mt-1 text-sm text-gray-400">
            Modern Portfolio Theory — maximize Sharpe ratio on the efficient frontier.
          </p>
        </div>
        <NavLink
          to="/ai-dashboard"
          className="w-fit rounded-md border border-gray-700 px-3 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-800"
        >
          AI Dashboard
        </NavLink>
      </div>

      <section className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <p className="mb-3 text-sm font-semibold text-gray-300">
          Select assets (2–8)
        </p>
        <div className="flex flex-wrap gap-2">
          {universe.map((asset) => {
            const activeSymbol = selected.includes(asset.symbol);
            return (
              <button
                key={asset.symbol}
                type="button"
                onClick={() => toggleSymbol(asset.symbol)}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                  activeSymbol
                    ? "border-blue-600 bg-blue-950/50 text-blue-200"
                    : "border-gray-700 text-gray-400 hover:border-gray-600"
                }`}
              >
                {asset.symbol}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm text-gray-400">History (days)</label>
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="w-full rounded-md border border-gray-700 bg-black px-3 py-2 text-sm text-white"
            >
              <option value={60}>60</option>
              <option value={90}>90</option>
              <option value={180}>180</option>
              <option value={365}>365</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-400">Budget (USD)</label>
            <input
              type="number"
              min={100}
              step={100}
              value={budget}
              onChange={(event) => setBudget(Number(event.target.value) || 10000)}
              className="w-full rounded-md border border-gray-700 bg-black px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-400">Risk-free rate (%)</label>
            <input
              type="number"
              min={0}
              max={20}
              step={0.1}
              value={riskFreeRate}
              onChange={(event) => setRiskFreeRate(Number(event.target.value) || 4)}
              className="w-full rounded-md border border-gray-700 bg-black px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => runOptimization(true)}
              disabled={loading}
              className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Optimizing..." : "Refresh"}
            </button>
          </div>
        </div>

        {isAuthenticated ? (
          <label className="mt-4 flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={includeHoldings}
              onChange={(event) => setIncludeHoldings(event.target.checked)}
              className="rounded border-gray-600"
            />
            Compare with my current portfolio holdings
          </label>
        ) : (
          <p className="mt-4 text-xs text-gray-500">
            Login to compare MPT results with your purchase history.
          </p>
        )}
      </section>

      {loading && !result ? (
        <p className="mt-8 text-gray-300">
          Fetching history and running Markowitz optimization…
        </p>
      ) : null}

      {error ? <p className="mt-8 text-red-400">Error: {error}</p> : null}

      {result && active ? (
        <>
          <section className="mt-8 grid gap-4 md:grid-cols-4">
            <MetricCard
              label="Expected return (annual)"
              value={pct(active.metrics.expectedReturn)}
              accent="text-green-400"
            />
            <MetricCard
              label="Volatility (annual)"
              value={pct(active.metrics.volatility)}
              accent="text-yellow-300"
            />
            <MetricCard
              label="Sharpe ratio"
              value={active.metrics.sharpeRatio.toFixed(3)}
              accent="text-blue-400"
            />
            <MetricCard label="Budget" value={formatPrice(result.budget)} />
          </section>

          <section className="mt-6 flex flex-wrap gap-2">
            {portfolioTabs.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setActivePortfolio(key)}
                className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                  activePortfolio === key
                    ? "border-blue-600 bg-blue-950/40 text-blue-200"
                    : "border-gray-700 text-gray-400 hover:bg-gray-800"
                }`}
              >
                {PORTFOLIO_LABELS[key] || key}
              </button>
            ))}
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 text-lg font-bold text-white">
                {active.label} — allocation
              </h2>
              <AllocationTable portfolio={active} />
            </div>
            <EfficientFrontierChart
              frontier={result.efficientFrontier}
              portfolios={result.portfolios}
            />
          </section>

          <section className="mt-8">
            <h2 className="mb-3 text-lg font-bold text-white">Portfolio comparison</h2>
            <div className="overflow-hidden rounded-lg border border-gray-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-800 text-gray-300">
                  <tr>
                    <th className="px-4 py-3">Strategy</th>
                    <th className="px-4 py-3">Return</th>
                    <th className="px-4 py-3">Volatility</th>
                    <th className="px-4 py-3">Sharpe</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioTabs.map((key) => {
                    const portfolio = result.portfolios[key];
                    return (
                      <tr key={key} className="border-t border-gray-800 text-gray-200">
                        <td className="px-4 py-3 font-medium">
                          {PORTFOLIO_LABELS[key] || key}
                        </td>
                        <td className="px-4 py-3 text-green-400">
                          {pct(portfolio.metrics.expectedReturn)}
                        </td>
                        <td className="px-4 py-3 text-yellow-300">
                          {pct(portfolio.metrics.volatility)}
                        </td>
                        <td className="px-4 py-3 text-blue-400">
                          {portfolio.metrics.sharpeRatio.toFixed(3)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="mb-3 text-lg font-bold text-white">Asset statistics</h2>
            <div className="overflow-hidden rounded-lg border border-gray-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-800 text-gray-300">
                  <tr>
                    <th className="px-4 py-3">Asset</th>
                    <th className="px-4 py-3">Expected return</th>
                    <th className="px-4 py-3">Volatility</th>
                    <th className="px-4 py-3">Standalone Sharpe</th>
                  </tr>
                </thead>
                <tbody>
                  {result.assets?.map((asset) => (
                    <tr key={asset.symbol} className="border-t border-gray-800 text-gray-200">
                      <td className="px-4 py-3 font-medium">{asset.symbol}</td>
                      <td className="px-4 py-3">{pct(asset.expectedReturn)}</td>
                      <td className="px-4 py-3">{pct(asset.volatility)}</td>
                      <td className="px-4 py-3">{asset.sharpeStandalone.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="mt-6 text-xs text-gray-500">
            {result.method}. {result.sampleDays} overlapping daily returns, annualized over{" "}
            {result.assumptions?.tradingDays} days. Long-only weights.
            {result.cached ? " Cached result." : " Fresh optimization."}{" "}
            {result.disclaimer}
          </p>
        </>
      ) : null}
    </main>
  );
}
