"""Buy / Sell / Hold signals with confidence scores from model outputs."""

from __future__ import annotations

import math
from typing import Any

import pandas as pd

BUY_THRESHOLD = 0.75
SELL_THRESHOLD = -0.75


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def change_to_signal(change_percent: float) -> str:
    if change_percent >= BUY_THRESHOLD:
        return "Buy"
    if change_percent <= SELL_THRESHOLD:
        return "Sell"
    return "Hold"


def model_confidence(
    change_percent: float,
    current_price: float,
    rmse: float | None = None,
) -> int:
    magnitude = min(abs(change_percent) * 7.5, 38.0)

    if abs(change_percent) < 0.25:
        magnitude *= 0.45
    elif abs(change_percent) < BUY_THRESHOLD:
        magnitude *= 0.75

    accuracy_bonus = 0.0
    if rmse is not None and current_price > 0:
        error_ratio = (rmse / current_price) * 100
        accuracy_bonus = clamp(14.0 - error_ratio * 2.5, 0.0, 14.0)

    return int(clamp(52, 96, 54 + magnitude + accuracy_bonus))


def model_probabilities(
    change_percent: float,
    current_price: float,
    rmse: float | None = None,
) -> dict[str, float]:
    """Estimate P(increase) and P(decrease) from predicted return and model error."""
    steepness = 2.8
    raw_up = 1.0 / (1.0 + math.exp(-change_percent * steepness))

    if rmse is not None and current_price > 0:
        error_pct = (rmse / current_price) * 100
        uncertainty = clamp(error_pct / 8.0, 0.0, 0.42)
        raw_up = raw_up * (1.0 - uncertainty) + 0.5 * uncertainty

    prob_increase = round(raw_up * 100, 1)
    prob_decrease = round((1.0 - raw_up) * 100, 1)
    return {
        "probIncrease": prob_increase,
        "probDecrease": prob_decrease,
    }


def historical_probabilities(frame: pd.DataFrame) -> dict[str, Any]:
    """Baseline up/down rates from daily price history."""
    returns = frame["price"].pct_change().dropna()
    if returns.empty:
        return {"probIncrease": 50.0, "probDecrease": 50.0, "sampleDays": 0}

    up = int((returns > 0).sum())
    down = int((returns < 0).sum())
    total = len(returns)
    prob_increase = round(up / total * 100, 1)
    prob_decrease = round(down / total * 100, 1)

    return {
        "probIncrease": prob_increase,
        "probDecrease": prob_decrease,
        "sampleDays": total,
        "upDays": up,
        "downDays": down,
    }


def build_ensemble_probabilities(
    model_results: list[dict[str, Any]],
    current_price: float,
    historical: dict[str, Any] | None = None,
) -> dict[str, Any]:
    valid = [
        item
        for item in model_results
        if "predictedPrice" in item and "error" not in item
    ]
    if not valid:
        return {}

    weighted_up = 0.0
    weight_total = 0.0
    up_count = 0
    down_count = 0
    flat_count = 0

    for item in valid:
        change = float(item.get("changePercent") or 0.0)
        rmse = item.get("metrics", {}).get("rmse")
        if rmse is None:
            rmse = current_price * 0.02

        probs = model_probabilities(change, current_price, rmse)
        weight = 1.0 / (float(rmse) + 1e-6)
        weighted_up += (probs["probIncrease"] / 100.0) * weight
        weight_total += weight

        if change > 0.1:
            up_count += 1
        elif change < -0.1:
            down_count += 1
        else:
            flat_count += 1

    ml_up = weighted_up / weight_total if weight_total else 0.5

    if historical and historical.get("sampleDays", 0) > 0:
        hist_up = historical["probIncrease"] / 100.0
        blended_up = ml_up * 0.75 + hist_up * 0.25
    else:
        blended_up = ml_up

    prob_increase = round(blended_up * 100, 1)
    prob_decrease = round((1.0 - blended_up) * 100, 1)

    return {
        "probIncrease": prob_increase,
        "probDecrease": prob_decrease,
        "modelsPredictingUp": up_count,
        "modelsPredictingDown": down_count,
        "modelsPredictingFlat": flat_count,
    }


def attach_model_signal(result: dict[str, Any], current_price: float) -> dict[str, Any]:
    if "error" in result or "predictedPrice" not in result:
        return result

    change = float(result.get("changePercent") or 0.0)
    rmse = result.get("metrics", {}).get("rmse")
    signal = change_to_signal(change)
    confidence = model_confidence(change, current_price, rmse)
    probabilities = model_probabilities(change, current_price, rmse)

    enriched = dict(result)
    enriched["signal"] = signal
    enriched["confidence"] = confidence
    enriched.update(probabilities)
    return enriched


def build_ensemble_signal(
    model_results: list[dict[str, Any]],
    current_price: float,
    ensemble_change_percent: float,
) -> dict[str, Any]:
    valid = [
        item
        for item in model_results
        if "predictedPrice" in item and "error" not in item
    ]
    if not valid:
        return {}

    votes = {"Buy": 0, "Hold": 0, "Sell": 0}
    confidences: list[int] = []

    for item in valid:
        change = float(item.get("changePercent") or 0.0)
        signal = change_to_signal(change)
        votes[signal] += 1
        rmse = item.get("metrics", {}).get("rmse")
        confidences.append(model_confidence(change, current_price, rmse))

    best_count = max(votes.values())
    leaders = [key for key, count in votes.items() if count == best_count]
    if len(leaders) == 1:
        winner = leaders[0]
    elif "Hold" in leaders:
        winner = "Hold"
    else:
        winner = leaders[0]
    total = len(valid)
    agreement_ratio = votes[winner] / total

    magnitude = min(abs(ensemble_change_percent) * 6.0, 28.0)
    if abs(ensemble_change_percent) < 0.25:
        magnitude *= 0.4

    avg_model_confidence = sum(confidences) / len(confidences)
    blended = (
        agreement_ratio * 42.0
        + magnitude
        + avg_model_confidence * 0.35
    )
    confidence = int(clamp(55, 97, blended))

    return {
        "signal": winner,
        "confidence": confidence,
        "votes": votes,
        "modelsAgreeing": votes[winner],
        "modelsTotal": total,
        "agreementPercent": round(agreement_ratio * 100, 1),
    }
