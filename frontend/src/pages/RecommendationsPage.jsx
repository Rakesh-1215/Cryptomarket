import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { formatPrice } from "../utils/coinFormatting.js";

function Badge({ children, className }) {
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}

export default function RecommendationsPage() {
  const { isAuthenticated, token, buyCrypto } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [buyingSymbol, setBuyingSymbol] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    document.title = "Crypto Market - Personalized Recommendations";
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadRecommendations() {
      if (!isAuthenticated || !token) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const response = await fetch("/api/recommendations", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to load recommendations");
        if (!ignore) setData(payload);
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadRecommendations();
    return () => {
      ignore = true;
    };
  }, [isAuthenticated, token]);

  const summary = useMemo(() => {
    if (!data?.profile) return null;
    return {
      label: data.profile.label,
      description: data.profile.description,
      size: data.portfolioSize,
      recommendations: data.recommendations?.length || 0,
    };
  }, [data]);

  const handleBuy = async (coin) => {
    if (!isAuthenticated) {
      alert("Please login first to buy this coin.");
      return;
    }

    const symbol = (coin.symbol || "").toUpperCase();
    const price = Number.parseFloat(coin.price_usd) || 0;
    const qtyStr = prompt(`Buy ${symbol}\n\nCurrent Price: $${price.toFixed(2)}\n\nEnter quantity:`, "1");
    if (qtyStr === null) return;

    const qty = Number(qtyStr);
    if (!Number.isFinite(qty) || qty <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }

    setBuyingSymbol(symbol);
    setMessage("");
    try {
      const result = await buyCrypto(symbol, qty, price);
      if (!result.success) {
        setError(result.error || "Purchase failed.");
        return;
      }
      setMessage(`Purchased ${qty} ${symbol} for $${(qty * price).toFixed(2)}.`);
    } finally {
      setBuyingSymbol("");
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10 text-gray-300">
        <h1 className="text-2xl font-bold text-white">Personalized Recommendations</h1>
        <p className="mt-3 max-w-2xl text-sm text-gray-400">
          Sign in to receive tailored crypto suggestions based on your purchasing history, trend signals, and risk appetite.
        </p>
        <div className="mt-6 rounded-lg border border-gray-800 bg-gray-900 p-6">
          <NavLink to="/login" className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">
            Login to continue
          </NavLink>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Personalized Recommendations</h1>
          <p className="mt-2 text-sm text-gray-400">
            Recommendations combine your history with live trend and risk signals to surface ideas that fit your profile.
          </p>
        </div>
        <NavLink to="/ai-dashboard" className="w-fit rounded-md border border-gray-700 px-3 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-800">
          Back to AI Dashboard
        </NavLink>
      </div>

      {loading ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-gray-300">Loading your personalized recommendations...</div>
      ) : error ? (
        <div className="rounded-lg border border-red-800 bg-red-950/40 p-6 text-red-300">{error}</div>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
              <p className="text-sm text-gray-400">Investor profile</p>
              <p className="mt-2 text-xl font-semibold text-white">{summary?.label}</p>
              <p className="mt-2 text-sm text-gray-400">{summary?.description}</p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
              <p className="text-sm text-gray-400">Current holdings</p>
              <p className="mt-2 text-xl font-semibold text-white">{summary?.size || 0}</p>
              <p className="mt-2 text-sm text-gray-400">Coins already in your portfolio.</p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
              <p className="text-sm text-gray-400">Suggested now</p>
              <p className="mt-2 text-xl font-semibold text-white">{summary?.recommendations || 0}</p>
              <p className="mt-2 text-sm text-gray-400">Curated ideas for your next move.</p>
            </div>
          </section>

          <section className="mt-8 grid gap-4 lg:grid-cols-2">
            {data?.recommendations?.map((coin) => (
              <article key={coin.id} className="rounded-lg border border-gray-800 bg-gray-900 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{coin.name}</p>
                    <p className="text-sm text-gray-400">{coin.symbol}</p>
                  </div>
                  <Badge className="border-emerald-800 bg-emerald-950/40 text-emerald-300">{coin.riskLabel} Risk</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Price</p>
                    <p className="font-semibold text-gray-100">{formatPrice(Number.parseFloat(coin.price_usd) || 0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">24h change</p>
                    <p className="font-semibold text-gray-100">{coin.percent_change_24h}%</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-gray-300">{coin.reason}</p>
                <button
                  type="button"
                  onClick={() => handleBuy(coin)}
                  disabled={buyingSymbol === coin.symbol}
                  className="mt-5 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {buyingSymbol === coin.symbol ? "Buying..." : `Buy ${coin.symbol}`}
                </button>
              </article>
            ))}
          </section>

          {message ? <p className="mt-6 text-sm text-green-400">{message}</p> : null}
        </>
      )}
    </main>
  );
}
