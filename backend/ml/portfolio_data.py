"""Build aligned return series for Modern Portfolio Theory optimization."""

from __future__ import annotations

import time
from typing import Any

import pandas as pd

from coin_mapping import SYMBOL_TO_COINGECKO, resolve_coin_id
from fetch_historical import fetch_market_chart, iso_timestamp

TRADING_DAYS = 365


def resolve_symbols(symbols: list[str]) -> list[dict[str, str]]:
    assets: list[dict[str, str]] = []
    for symbol in symbols:
        key = (symbol or "").strip().upper()
        coin_id = resolve_coin_id(key)
        if not coin_id:
            continue
        assets.append({"symbol": key, "coinId": coin_id})
    return assets


def fetch_returns_matrix(
    assets: list[dict[str, str]],
    days: int = 90,
) -> tuple[pd.DataFrame, pd.Series]:
    price_series: dict[str, pd.Series] = {}

    for index, asset in enumerate(assets):
        if index > 0:
            time.sleep(1.1)
        frame = fetch_market_chart(asset["coinId"], days=days)
        price_series[asset["symbol"]] = frame.set_index("date")["price"]

    prices = pd.DataFrame(price_series).dropna(how="any")
    if len(prices) < 20:
        raise RuntimeError(
            f"Not enough overlapping history across assets ({len(prices)} rows)"
        )

    returns = prices.pct_change().dropna()
    latest_prices = prices.iloc[-1]
    return returns, latest_prices


def annualize_mean(daily_returns: pd.Series) -> float:
    return float(daily_returns.mean() * TRADING_DAYS)


def annualize_cov(daily_returns: pd.DataFrame) -> pd.DataFrame:
    return daily_returns.cov() * TRADING_DAYS


def summarize_assets(
    returns: pd.DataFrame,
    latest_prices: pd.Series,
    mean_returns: pd.Series,
    cov_matrix: pd.DataFrame,
) -> list[dict[str, Any]]:
    assets: list[dict[str, Any]] = []
    for symbol in returns.columns:
        daily = returns[symbol]
        assets.append(
            {
                "symbol": symbol,
                "latestPrice": round(float(latest_prices[symbol]), 4),
                "expectedReturn": round(float(mean_returns[symbol]), 4),
                "volatility": round(float(daily.std() * (TRADING_DAYS**0.5)), 4),
                "sharpeStandalone": round(
                    float(mean_returns[symbol] / (daily.std() * (TRADING_DAYS**0.5)))
                    if daily.std() > 0
                    else 0.0,
                    4,
                ),
            }
        )
    return assets
