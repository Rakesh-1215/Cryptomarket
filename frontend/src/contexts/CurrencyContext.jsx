import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import {
  setGlobalCurrency,
  formatPrice as utilFormatPrice,
  formatNumber as utilFormatNumber,
} from "../utils/coinFormatting.js";

const CurrencyContext = createContext(null);

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem("preferred_currency") || "USD";
    }
    return "USD";
  });
  const [rate, setRate] = useState(86);

  // Sync to global formatting module on mount & currency/rate change
  useEffect(() => {
    setGlobalCurrency(currency, rate);
  }, [currency, rate]);

  // Fetch live exchange rate from backend
  useEffect(() => {
    fetch("/api/currency-rate")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.rate === "number" && data.rate > 0) {
          setRate(data.rate);
          setGlobalCurrency(currency, data.rate);
        }
      })
      .catch(() => {
        // Fall back to default rate of 86
      });
  }, [currency]);

  const setCurrency = useCallback((newCurrency) => {
    if (newCurrency !== "USD" && newCurrency !== "INR") return;
    setCurrencyState(newCurrency);
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("preferred_currency", newCurrency);
    }
    setGlobalCurrency(newCurrency, rate);
  }, [rate]);

  const toggleCurrency = useCallback(() => {
    setCurrency((prev) => (prev === "USD" ? "INR" : "USD"));
  }, [setCurrency]);

  const formatPrice = useCallback(
    (price) => utilFormatPrice(price, currency, rate),
    [currency, rate],
  );

  const formatNumber = useCallback(
    (num) => utilFormatNumber(num, currency, rate),
    [currency, rate],
  );

  const value = useMemo(
    () => ({
      currency,
      setCurrency,
      toggleCurrency,
      rate,
      currencySymbol: currency === "INR" ? "₹" : "$",
      formatPrice,
      formatNumber,
    }),
    [currency, setCurrency, toggleCurrency, rate, formatPrice, formatNumber],
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}
