import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useCurrency } from "../contexts/CurrencyContext.jsx";

function Badge({ children, className }) {
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}

export default function RecommendationsPage() {
  const { isAuthenticated, token, buyCryptoWithRazorpay } = useAuth();
  const { currency, formatPrice } = useCurrency();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [buyingSymbol, setBuyingSymbol] = useState("");
  const [message, setMessage] = useState("");
  const [paymentCoin, setPaymentCoin] = useState(null);
  const [quantity, setQuantity] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

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
      toast.error("Please login first to buy this coin.");
      return;
    }
    setPaymentCoin(coin);
    setQuantity("1");
    setPaymentMethod("card");
    setPaymentError("");
    setPaymentSuccess("");
  };

  const closePaymentModal = () => {
    if (submittingPayment) return;
    setPaymentCoin(null);
    setPaymentError("");
    setPaymentSuccess("");
  };

  const totalAmount = useMemo(() => {
    if (!paymentCoin) return 0;
    const qty = Number(quantity);
    const price = Number.parseFloat(paymentCoin.price_usd) || 0;
    if (!Number.isFinite(qty) || qty <= 0) return 0;
    return qty * price;
  }, [paymentCoin, quantity]);

  const validatePayment = () => {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return "Please enter a valid quantity.";
    return "";
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    setPaymentError("");
    setPaymentSuccess("");

    const validationMsg = validatePayment();
    if (validationMsg) {
      setPaymentError(validationMsg);
      return;
    }

    const symbol = (paymentCoin?.symbol || "").toUpperCase();
    const name = paymentCoin?.name || symbol;
    const qty = Number(quantity);
    const price = Number.parseFloat(paymentCoin.price_usd) || 0;

    try {
      setSubmittingPayment(true);
      setBuyingSymbol(symbol);
      const result = await buyCryptoWithRazorpay({
        cryptoType: symbol,
        cryptoName: name,
        amount: qty,
        price,
        preferredMethod: paymentMethod,
      });
      if (!result.success) {
        setPaymentError(result.error || "Purchase failed.");
        return;
      }
      setPaymentSuccess(`Payment successful via ${paymentMethod === "paylater" ? "Pay Later" : "Card"}. Purchased ${qty} ${symbol} for ${formatPrice(totalAmount)}.`);
      setMessage(`Payment successful. Purchased ${qty} ${symbol} for ${formatPrice(qty * price)}.`);
      setTimeout(() => {
        closePaymentModal();
      }, 2000);
    } finally {
      setBuyingSymbol("");
      setSubmittingPayment(false);
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

      {paymentCoin ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closePaymentModal}>
          <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Buy {paymentCoin.name}</h3>
              <button type="button" className="text-gray-400 hover:text-gray-200" onClick={closePaymentModal}>✕</button>
            </div>

            <form className="space-y-4" onSubmit={submitPayment}>
              <div>
                <label className="mb-1 block text-sm text-gray-300">Quantity</label>
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="rounded-md border border-blue-800 bg-blue-950/40 px-3 py-3 text-sm text-blue-100">
                Choose a payment method below, then Razorpay checkout will open with that method preselected.
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-300">Payment method</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setPaymentMethod("card")} aria-pressed={paymentMethod === "card"} className={`rounded-md border px-3 py-2 text-sm font-medium ${paymentMethod === "card" ? "border-blue-600 bg-blue-600 text-white" : "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>
                    Card
                  </button>
                  <button type="button" onClick={() => setPaymentMethod("paylater")} aria-pressed={paymentMethod === "paylater"} className={`rounded-md border px-3 py-2 text-sm font-medium ${paymentMethod === "paylater" ? "border-blue-600 bg-blue-600 text-white" : "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>
                    Pay Later
                  </button>
                </div>
              </div>

              <div className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200">
                Total: <span className="font-semibold">{formatPrice(totalAmount)}</span>
                {currency === "INR" ? (
                  <span className="text-xs text-gray-400 ml-2">(${totalAmount.toFixed(2)} USD)</span>
                ) : null}
              </div>
              <p className="text-xs text-gray-500">
                Checkout amount is charged in INR using your backend USD_TO_INR_RATE setting. Pay Later appears only if it is enabled on your Razorpay account.
              </p>

              {paymentError ? <p className="text-sm text-red-400">{paymentError}</p> : null}
              {paymentSuccess ? <p className="text-sm text-green-400">{paymentSuccess}</p> : null}

              <button type="submit" disabled={submittingPayment} className="w-full rounded-md bg-green-600 py-2 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60">
                {submittingPayment ? "Opening Razorpay..." : "Pay with Razorpay"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
