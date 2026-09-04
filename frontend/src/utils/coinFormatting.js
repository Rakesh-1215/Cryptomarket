let currentCurrency =
  typeof window !== "undefined" && window.localStorage
    ? window.localStorage.getItem("preferred_currency") || "USD"
    : "USD";
let currentRate = 86; // Default 1 USD = 86 INR matching backend

export function setGlobalCurrency(currency, rate) {
  if (currency === "USD" || currency === "INR") {
    currentCurrency = currency;
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("preferred_currency", currency);
    }
  }
  if (typeof rate === "number" && rate > 0) {
    currentRate = rate;
  }
}

export function getGlobalCurrency() {
  return currentCurrency;
}

export function getGlobalRate() {
  return currentRate;
}

export function formatPrice(price, currency = currentCurrency, rate = currentRate) {
  const numeric = Number(price);
  if (!Number.isFinite(numeric)) return currency === "INR" ? "₹0.00" : "$0.00";

  const isNegative = numeric < 0;
  const absValue = Math.abs(numeric);
  const symbol = currency === "INR" ? "₹" : "$";
  const prefix = isNegative ? `-${symbol}` : symbol;

  if (currency === "INR") {
    const inrValue = absValue * rate;
    if (inrValue < 0.0001 && inrValue > 0) {
      return `${prefix}${inrValue.toFixed(6)}`;
    }
    if (inrValue < 1 && inrValue > 0) {
      return `${prefix}${inrValue.toFixed(4)}`;
    }
    return `${prefix}${inrValue.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  // USD
  if (absValue < 0.01 && absValue > 0) {
    return `${prefix}${absValue.toFixed(6)}`;
  }
  if (absValue < 1 && absValue > 0) {
    return `${prefix}${absValue.toFixed(4)}`;
  }
  return `${prefix}${absValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatNumber(num, currency = currentCurrency, rate = currentRate) {
  const numeric = Number(num);
  if (!Number.isFinite(numeric)) return currency === "INR" ? "₹0.00" : "$0.00";

  const isNegative = numeric < 0;
  const abs = Math.abs(numeric) * (currency === "INR" ? rate : 1);
  const symbol = currency === "INR" ? "₹" : "$";
  const prefix = isNegative ? `-${symbol}` : symbol;

  if (abs >= 1e12) return `${prefix}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${prefix}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${prefix}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${prefix}${(abs / 1e3).toFixed(2)}K`;
  return `${prefix}${abs.toFixed(2)}`;
}

export function getChangeColor(change) {
  if (change > 0) return "text-green-400";
  if (change < 0) return "text-red-400";
  return "text-gray-400";
}

