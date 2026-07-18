"""
Portfolio optimization using Modern Portfolio Theory (Markowitz).

Usage:
  python portfolio_optimize.py --symbols BTC,ETH,SOL,BNB --days 90 --budget 10000
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

import numpy as np

from coin_mapping import SYMBOL_TO_COINGECKO
from fetch_historical import iso_timestamp
from mpt_optimizer import (
    HAS_SCIPY,
    build_efficient_frontier,
    format_portfolio,
    optimize_max_sharpe,
    optimize_min_variance,
    portfolio_metrics,
)
from portfolio_data import (
    TRADING_DAYS,
    annualize_cov,
    annualize_mean,
    fetch_returns_matrix,
    resolve_symbols,
    summarize_assets,
)

DEFAULT_SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA"]
MAX_ASSETS = 8


def parse_symbols(raw: str | None) -> list[str]:
    if not raw:
        return DEFAULT_SYMBOLS
    symbols = [part.strip().upper() for part in raw.split(",") if part.strip()]
    return symbols[:MAX_ASSETS]


def parse_current_weights(
    raw: str | None,
    symbols: list[str],
) -> dict[str, float] | None:
    if not raw:
        return None

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return None

    weights: dict[str, float] = {}
    for symbol in symbols:
        key = symbol.upper()
        if key in payload:
            weights[key] = float(payload[key])
    return weights or None


def analyze_current_portfolio(
    weight_map: dict[str, float] | None,
    symbols: list[str],
    mean_returns: np.ndarray,
    cov_matrix: np.ndarray,
    risk_free_rate: float,
    budget: float,
    latest_prices: np.ndarray,
) -> dict[str, Any] | None:
    if not weight_map:
        return None

    total = sum(weight_map.get(symbol, 0.0) for symbol in symbols)
    if total <= 0:
        return None

    weights = np.array([weight_map.get(symbol, 0.0) / total for symbol in symbols])
    return format_portfolio(
        "current",
        "Your current portfolio",
        weights,
        symbols,
        mean_returns,
        cov_matrix,
        latest_prices,
        budget,
        risk_free_rate,
    )


def run_optimization(
    symbols: list[str],
    days: int = 90,
    budget: float = 10000.0,
    risk_free_rate: float = 0.04,
    current_weights: dict[str, float] | None = None,
) -> dict[str, Any]:
    if len(symbols) < 2:
        raise RuntimeError("Select at least 2 assets for portfolio optimization")

    assets = resolve_symbols(symbols)
    if len(assets) < 2:
        unknown = [symbol for symbol in symbols if symbol.upper() not in SYMBOL_TO_COINGECKO]
        raise RuntimeError(
            f"Could not resolve enough assets. Unsupported symbols: {', '.join(unknown) or 'none'}"
        )

    returns, latest_prices_series = fetch_returns_matrix(assets, days=days)
    symbol_list = list(returns.columns)
    mean_series = returns.apply(annualize_mean)
    cov_frame = annualize_cov(returns)

    mean_returns = mean_series.to_numpy(dtype=np.float64)
    cov_matrix = cov_frame.to_numpy(dtype=np.float64)
    latest_prices = latest_prices_series[symbol_list].to_numpy(dtype=np.float64)

    equal_weights = np.array([1.0 / len(symbol_list)] * len(symbol_list))
    max_sharpe_weights = optimize_max_sharpe(mean_returns, cov_matrix, risk_free_rate)
    min_var_weights = optimize_min_variance(mean_returns, cov_matrix)

    portfolios = {
        "maxSharpe": format_portfolio(
            "maxSharpe",
            "Maximum Sharpe (tangency portfolio)",
            max_sharpe_weights,
            symbol_list,
            mean_returns,
            cov_matrix,
            latest_prices,
            budget,
            risk_free_rate,
        ),
        "minVariance": format_portfolio(
            "minVariance",
            "Minimum variance portfolio",
            min_var_weights,
            symbol_list,
            mean_returns,
            cov_matrix,
            latest_prices,
            budget,
            risk_free_rate,
        ),
        "equalWeight": format_portfolio(
            "equalWeight",
            "Equal-weight benchmark",
            equal_weights,
            symbol_list,
            mean_returns,
            cov_matrix,
            latest_prices,
            budget,
            risk_free_rate,
        ),
    }

    current = analyze_current_portfolio(
        current_weights,
        symbol_list,
        mean_returns,
        cov_matrix,
        risk_free_rate,
        budget,
        latest_prices,
    )
    if current:
        portfolios["current"] = current

    frontier = build_efficient_frontier(
        mean_returns,
        cov_matrix,
        risk_free_rate,
        points=12,
    )

    correlation = cov_frame.copy()
    vols = np.sqrt(np.diag(cov_matrix))
    for i, sym_i in enumerate(symbol_list):
        for j, sym_j in enumerate(symbol_list):
            denom = vols[i] * vols[j]
            correlation.iloc[i, j] = cov_matrix[i, j] / denom if denom > 0 else 0.0

    return {
        "method": "Modern Portfolio Theory (Markowitz mean-variance)",
        "assumptions": {
            "longOnly": True,
            "weightConstraint": "Weights sum to 100%",
            "tradingDays": TRADING_DAYS,
            "optimizer": "scipy SLSQP" if HAS_SCIPY else "equal-weight fallback",
        },
        "symbols": symbol_list,
        "historicalDays": days,
        "sampleDays": len(returns),
        "budget": round(budget, 2),
        "riskFreeRate": risk_free_rate,
        "assets": summarize_assets(returns, latest_prices_series, mean_series, cov_frame),
        "portfolios": portfolios,
        "recommended": portfolios["maxSharpe"],
        "efficientFrontier": frontier,
        "correlationMatrix": {
            "symbols": symbol_list,
            "values": [
                [round(float(correlation.iloc[i, j]), 3) for j in range(len(symbol_list))]
                for i in range(len(symbol_list))
            ],
        },
        "metricsComparison": {
            key: portfolio["metrics"]
            for key, portfolio in portfolios.items()
        },
        "generatedAt": iso_timestamp(),
        "disclaimer": "Educational demo only. Past returns do not guarantee future results.",
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="MPT portfolio optimization")
    parser.add_argument(
        "--symbols",
        default=",".join(DEFAULT_SYMBOLS),
        help="Comma-separated symbols (max 8)",
    )
    parser.add_argument("--days", type=int, default=90)
    parser.add_argument("--budget", type=float, default=10000.0)
    parser.add_argument("--risk-free", type=float, default=0.04, dest="risk_free")
    parser.add_argument(
        "--current-weights",
        default="",
        help='JSON map of current weights, e.g. {"BTC":0.5,"ETH":0.5}',
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        symbols = parse_symbols(args.symbols)
        current = parse_current_weights(args.current_weights or None, symbols)
        payload = run_optimization(
            symbols=symbols,
            days=args.days,
            budget=args.budget,
            risk_free_rate=args.risk_free,
            current_weights=current,
        )
        print(json.dumps(payload))
        return 0
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"error": str(exc)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
