"""Lightweight single-layer LSTM for next-day price prediction (NumPy only)."""

from __future__ import annotations

import numpy as np


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(x, -40, 40)))


def _tanh(x: np.ndarray) -> np.ndarray:
    return np.tanh(x)


class LSTMRegressor:
    def __init__(self, hidden_size: int = 32, learning_rate: float = 0.003, epochs: int = 80):
        self.hidden_size = hidden_size
        self.learning_rate = learning_rate
        self.epochs = epochs
        self.weights: dict[str, np.ndarray] = {}

    def _init_weights(self, input_size: int) -> None:
        h = self.hidden_size
        scale = 0.08
        self.weights = {
            "Wf": np.random.randn(h, input_size + h) * scale,
            "bf": np.zeros((h, 1)),
            "Wi": np.random.randn(h, input_size + h) * scale,
            "bi": np.zeros((h, 1)),
            "Wc": np.random.randn(h, input_size + h) * scale,
            "bc": np.zeros((h, 1)),
            "Wo": np.random.randn(h, input_size + h) * scale,
            "bo": np.zeros((h, 1)),
            "Wy": np.random.randn(1, h) * scale,
            "by": np.zeros((1, 1)),
        }

    def _forward_sequence(self, sequence: np.ndarray) -> tuple[float, list[dict]]:
        h = np.zeros((self.hidden_size, 1))
        c = np.zeros((self.hidden_size, 1))
        cache: list[dict] = []

        for step in sequence:
            x = step.reshape(-1, 1)
            concat = np.vstack([x, h])
            f = _sigmoid(self.weights["Wf"] @ concat + self.weights["bf"])
            i = _sigmoid(self.weights["Wi"] @ concat + self.weights["bi"])
            c_tilde = _tanh(self.weights["Wc"] @ concat + self.weights["bc"])
            c = f * c + i * c_tilde
            o = _sigmoid(self.weights["Wo"] @ concat + self.weights["bo"])
            h = o * _tanh(c)
            cache.append({"concat": concat, "f": f, "i": i, "c_tilde": c_tilde, "c": c, "o": o, "h": h})

        prediction = float((self.weights["Wy"] @ h + self.weights["by"]).item())
        return prediction, cache

    def fit(self, x_train: np.ndarray, y_train: np.ndarray) -> None:
        if len(x_train) == 0:
            raise ValueError("LSTM training set is empty")

        input_size = x_train.shape[2]
        self._init_weights(input_size)
        lr = self.learning_rate

        for _ in range(self.epochs):
            for seq, target in zip(x_train, y_train, strict=True):
                pred, cache = self._forward_sequence(seq)
                error = pred - float(target)
                dh = (self.weights["Wy"].T * error).reshape(-1, 1)
                dWy = error * cache[-1]["h"].T
                dby = np.array([[error]])

                self.weights["Wy"] -= lr * dWy
                self.weights["by"] -= lr * dby

                for step in reversed(cache):
                    concat = step["concat"]
                    h_prev = concat[step["concat"].shape[0] - self.hidden_size :]
                    c = step["c"]
                    o = step["o"]
                    f = step["f"]
                    i = step["i"]
                    c_tilde = step["c_tilde"]

                    tanh_c = _tanh(c)
                    do = dh * tanh_c
                    do_raw = do * o * (1.0 - o)
                    dc = dh * o * (1.0 - tanh_c**2)
                    dc_tilde = dc * i
                    dc_tilde_raw = dc_tilde * (1.0 - c_tilde**2)
                    di = dc * c_tilde
                    di_raw = di * i * (1.0 - i)
                    df = dc * c
                    df_raw = df * f * (1.0 - f)

                    dconcat = (
                        self.weights["Wo"].T @ do_raw
                        + self.weights["Wc"].T @ dc_tilde_raw
                        + self.weights["Wi"].T @ di_raw
                        + self.weights["Wf"].T @ df_raw
                    )

                    self.weights["Wo"] -= lr * (do_raw @ concat.T)
                    self.weights["bo"] -= lr * do_raw
                    self.weights["Wc"] -= lr * (dc_tilde_raw @ concat.T)
                    self.weights["bc"] -= lr * dc_tilde_raw
                    self.weights["Wi"] -= lr * (di_raw @ concat.T)
                    self.weights["bi"] -= lr * di_raw
                    self.weights["Wf"] -= lr * (df_raw @ concat.T)
                    self.weights["bf"] -= lr * df_raw

                    dh = dconcat[self.weights["Wf"].shape[1] - self.hidden_size :]

    def predict(self, sequence: np.ndarray) -> float:
        pred, _ = self._forward_sequence(sequence)
        return pred


def build_lstm_sequences(
    values: np.ndarray,
    lookback: int,
) -> tuple[np.ndarray, np.ndarray]:
    features = []
    targets = []
    for idx in range(lookback, len(values)):
        window = values[idx - lookback : idx]
        features.append(window.reshape(lookback, 1))
        targets.append(values[idx])
    return np.asarray(features, dtype=np.float64), np.asarray(targets, dtype=np.float64)


def train_lstm(
    prices: np.ndarray,
    lookback: int = 14,
) -> tuple[LSTMRegressor, float, float, float]:
    scaled = prices.astype(np.float64)
    mean = float(scaled.mean())
    std = float(scaled.std() or 1.0)
    normalized = (scaled - mean) / std

    x_all, y_all = build_lstm_sequences(normalized, lookback)
    split = max(1, int(len(x_all) * 0.8))
    x_train, y_train = x_all[:split], y_all[:split]
    x_test, y_test = x_all[split:], y_all[split:]

    model = LSTMRegressor(hidden_size=32, learning_rate=0.004, epochs=60)
    model.fit(x_train, y_train)

    if len(x_test):
        preds = np.array([model.predict(seq) for seq in x_test])
        actual = y_test
        rmse = float(np.sqrt(np.mean((preds - actual) ** 2)) * std)
        mae = float(np.mean(np.abs(preds - actual)) * std)
    else:
        rmse = 0.0
        mae = 0.0

    last_window = normalized[-lookback:].reshape(lookback, 1)
    next_norm = model.predict(last_window)
    next_price = float(next_norm * std + mean)
    return model, rmse, mae, next_price
