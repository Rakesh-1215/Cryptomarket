"""Modern Portfolio Theory optimization (Markowitz mean-variance)."""

from __future__ import annotations

from typing import Any

import numpy as np

try:
    from scipy.optimize import minimize

    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False


def portfolio_metrics(
    weights: np.ndarray,
    mean_returns: np.ndarray,
    cov_matrix: np.ndarray,
    risk_free_rate: float,
) -> dict[str, float]:
    portfolio_return = float(np.dot(weights, mean_returns))
    variance = float(np.dot(weights.T, np.dot(cov_matrix, weights)))
    volatility = float(np.sqrt(max(variance, 0.0)))
    sharpe = (
        (portfolio_return - risk_free_rate) / volatility if volatility > 0 else 0.0
    )
    return {
        "expectedReturn": round(portfolio_return, 4),
        "volatility": round(volatility, 4),
        "variance": round(variance, 6),
        "sharpeRatio": round(sharpe, 4),
    }


def _neg_sharpe(
    weights: np.ndarray,
    mean_returns: np.ndarray,
    cov_matrix: np.ndarray,
    risk_free_rate: float,
) -> float:
    portfolio_return = float(np.dot(weights, mean_returns))
    variance = float(np.dot(weights.T, np.dot(cov_matrix, weights)))
    volatility = float(np.sqrt(max(variance, 0.0)))
    if volatility <= 0:
        return 0.0
    sharpe = (portfolio_return - risk_free_rate) / volatility
    return -sharpe


def _portfolio_variance(weights: np.ndarray, cov_matrix: np.ndarray) -> float:
    return float(np.dot(weights.T, np.dot(cov_matrix, weights)))


def optimize_max_sharpe(
    mean_returns: np.ndarray,
    cov_matrix: np.ndarray,
    risk_free_rate: float,
) -> np.ndarray:
    count = len(mean_returns)
    if not HAS_SCIPY:
        return np.array([1.0 / count] * count)

    bounds = tuple((0.0, 1.0) for _ in range(count))
    constraints = ({"type": "eq", "fun": lambda weights: np.sum(weights) - 1.0},)
    initial = np.array([1.0 / count] * count)

    result = minimize(
        _neg_sharpe,
        initial,
        args=(mean_returns, cov_matrix, risk_free_rate),
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
    )
    if not result.success:
        return initial
    return result.x


def optimize_min_variance(
    mean_returns: np.ndarray,
    cov_matrix: np.ndarray,
) -> np.ndarray:
    count = len(mean_returns)
    if not HAS_SCIPY:
        return np.array([1.0 / count] * count)

    bounds = tuple((0.0, 1.0) for _ in range(count))
    constraints = ({"type": "eq", "fun": lambda weights: np.sum(weights) - 1.0},)
    initial = np.array([1.0 / count] * count)

    result = minimize(
        _portfolio_variance,
        initial,
        args=(cov_matrix,),
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
    )
    if not result.success:
        return initial
    return result.x


def optimize_target_return(
    mean_returns: np.ndarray,
    cov_matrix: np.ndarray,
    target_return: float,
) -> np.ndarray | None:
    count = len(mean_returns)
    if not HAS_SCIPY:
        return None

    bounds = tuple((0.0, 1.0) for _ in range(count))
    constraints = (
        {"type": "eq", "fun": lambda weights: np.sum(weights) - 1.0},
        {
            "type": "eq",
            "fun": lambda weights: float(np.dot(weights, mean_returns) - target_return),
        },
    )
    initial = np.array([1.0 / count] * count)

    result = minimize(
        _portfolio_variance,
        initial,
        args=(cov_matrix,),
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
    )
    if not result.success:
        return None
    return result.x


def build_efficient_frontier(
    mean_returns: np.ndarray,
    cov_matrix: np.ndarray,
    risk_free_rate: float,
    points: int = 12,
) -> list[dict[str, float]]:
    min_ret = float(np.min(mean_returns))
    max_ret = float(np.max(mean_returns))
    if max_ret <= min_ret:
        weights = np.array([1.0 / len(mean_returns)] * len(mean_returns))
        metrics = portfolio_metrics(weights, mean_returns, cov_matrix, risk_free_rate)
        return [{"expectedReturn": metrics["expectedReturn"], "volatility": metrics["volatility"]}]

    targets = np.linspace(min_ret, max_ret, points)
    frontier: list[dict[str, float]] = []

    for target in targets:
        weights = optimize_target_return(mean_returns, cov_matrix, float(target))
        if weights is None:
            continue
        metrics = portfolio_metrics(weights, mean_returns, cov_matrix, risk_free_rate)
        frontier.append(
            {
                "expectedReturn": metrics["expectedReturn"],
                "volatility": metrics["volatility"],
            }
        )

    return frontier


def format_portfolio(
    name: str,
    label: str,
    weights: np.ndarray,
    symbols: list[str],
    mean_returns: np.ndarray,
    cov_matrix: np.ndarray,
    latest_prices: np.ndarray,
    budget: float,
    risk_free_rate: float,
) -> dict[str, Any]:
    metrics = portfolio_metrics(weights, mean_returns, cov_matrix, risk_free_rate)
    allocations: list[dict[str, Any]] = []

    for index, symbol in enumerate(symbols):
        weight = float(weights[index])
        price = float(latest_prices[index])
        allocation_usd = round(budget * weight, 2)
        units = round(allocation_usd / price, 8) if price > 0 else 0.0
        allocations.append(
            {
                "symbol": symbol,
                "weight": round(weight * 100, 2),
                "allocationUsd": allocation_usd,
                "units": units,
                "latestPrice": round(price, 4),
            }
        )

    allocations.sort(key=lambda item: item["weight"], reverse=True)

    return {
        "name": name,
        "label": label,
        "metrics": metrics,
        "allocations": allocations,
    }
