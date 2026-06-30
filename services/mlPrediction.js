const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ML_DIR = path.join(__dirname, "..", "ml");
const PREDICT_SCRIPT = path.join(ML_DIR, "predict.py");
const VENV_PYTHON = path.join(__dirname, "..", ".venv", "Scripts", "python.exe");
const PYTHON_BIN = process.env.PYTHON_BIN || (fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : "python");

const COIN_PREDICTIONS = [
  { symbol: "BTC", name: "Bitcoin", coinId: "bitcoin" },
  { symbol: "ETH", name: "Ethereum", coinId: "ethereum" },
  { symbol: "BNB", name: "BNB", coinId: "binancecoin" },
  { symbol: "SOL", name: "Solana", coinId: "solana" },
  { symbol: "XRP", name: "XRP", coinId: "ripple" },
  { symbol: "ADA", name: "Cardano", coinId: "cardano" },
  { symbol: "DOGE", name: "Dogecoin", coinId: "dogecoin" },
  { symbol: "TRX", name: "TRON", coinId: "tron" },
  { symbol: "AVAX", name: "Avalanche", coinId: "avalanche-2" },
  { symbol: "DOT", name: "Polkadot", coinId: "polkadot" },
  { symbol: "LINK", name: "Chainlink", coinId: "chainlink" },
  { symbol: "MATIC", name: "Polygon", coinId: "matic-network" },
  { symbol: "LTC", name: "Litecoin", coinId: "litecoin" },
  { symbol: "UNI", name: "Uniswap", coinId: "uniswap" },
  { symbol: "ATOM", name: "Cosmos", coinId: "cosmos" },
];

const CACHE_TTL_MS = 60 * 60 * 1000;
const predictionCache = new Map();

function cacheKey(coinId, days) {
  return `${coinId}:${days}`;
}

function getCachedPrediction(coinId, days) {
  const entry = predictionCache.get(cacheKey(coinId, days));
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    predictionCache.delete(cacheKey(coinId, days));
    return null;
  }
  return entry.payload;
}

function setCachedPrediction(coinId, days, payload) {
  predictionCache.set(cacheKey(coinId, days), {
    timestamp: Date.now(),
    payload,
  });
}

function runPythonPrediction({ coinId, symbol, days }) {
  return new Promise((resolve, reject) => {
    const args = [
      PREDICT_SCRIPT,
      "--coin-id",
      coinId,
      "--symbol",
      symbol,
      "--days",
      String(days),
    ];

    const child = spawn(PYTHON_BIN, args, {
      cwd: ML_DIR,
      env: process.env,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(
        new Error(
          `Failed to start Python (${PYTHON_BIN}). Install Python 3 and run: pip install -r ml/requirements.txt. ${error.message}`,
        ),
      );
    });

    child.on("close", (code) => {
      const trimmed = stdout.trim();
      if (!trimmed) {
        reject(
          new Error(
            stderr.trim() ||
              `Python prediction exited with code ${code ?? "unknown"}`,
          ),
        );
        return;
      }

      try {
        const payload = JSON.parse(trimmed);
        if (payload.error) {
          reject(new Error(payload.error));
          return;
        }
        if (code !== 0) {
          reject(new Error(payload.error || `Python exited with code ${code}`));
          return;
        }
        resolve(payload);
      } catch (error) {
        reject(
          new Error(
            `Invalid JSON from prediction script: ${error.message}. Output: ${trimmed.slice(0, 200)}`,
          ),
        );
      }
    });
  });
}

function resolveCoin(symbol, name) {
  const normalized = String(symbol || "")
    .trim()
    .toUpperCase();

  const known = COIN_PREDICTIONS.find((coin) => coin.symbol === normalized);
  if (known) return known;

  if (name) {
    const slug = String(name).trim().toLowerCase().replace(/\s+/g, "-");
    return {
      symbol: normalized || slug.toUpperCase(),
      name: name.trim(),
      coinId: slug,
    };
  }

  return null;
}

function buildFallbackPrediction(coin, days) {
  return {
    coinId: coin.coinId,
    symbol: coin.symbol,
    currentPrice: 0,
    historicalDays: days,
    lookbackDays: 14,
    forecastHorizonDays: 1,
    history: [],
    models: {},
    ensemble: {
      predictedPrice: 0,
      changePercent: 0,
      direction: "Stable",
      signal: "Hold",
      confidence: 50,
      probIncrease: 50,
      probDecrease: 50,
      modelsAgreeing: 0,
      modelsTotal: 0,
    },
    probabilities: {
      increase: 50,
      decrease: 50,
      historical: {},
      modelsPredictingUp: 0,
      modelsPredictingDown: 0,
    },
    riskScore: {
      score: 50,
      label: "Medium",
      volatility: 0.0,
      sharpeProxy: 0.0,
      summary: "Fallback mode: the Python ML runtime is unavailable.",
    },
    evaluation: {
      regression: {
        mae: 0,
        rmse: 0,
        mape: 0,
      },
      classification: {
        accuracy: 50,
        precision: 50,
        recall: 50,
        f1Score: 50,
        support: 0,
      },
    },
    explainability: {
      featureImportance: [],
      topDrivers: [],
      riskFactors: [],
      modelAgreement: "0/0 models agree",
    },
    explanation: "Prediction is temporarily using a neutral fallback while the Python backend is unavailable.",
    generatedAt: new Date().toISOString(),
    disclaimer: "Educational demo only. Not financial advice.",
    fallback: true,
  };
}

async function getPricePrediction({ symbol, name, days = 90, force = false }) {
  const coin = resolveCoin(symbol, name);
  if (!coin) {
    throw new Error(`Unsupported coin symbol: ${symbol || "unknown"}`);
  }

  const safeDays = Math.max(30, Math.min(365, Number(days) || 90));

  if (!force) {
    const cached = getCachedPrediction(coin.coinId, safeDays);
    if (cached) {
      return { ...cached, cached: true };
    }
  }

  try {
    const payload = await runPythonPrediction({
      coinId: coin.coinId,
      symbol: coin.symbol,
      days: safeDays,
    });

    setCachedPrediction(coin.coinId, safeDays, payload);
    return { ...payload, cached: false };
  } catch (error) {
    const fallback = buildFallbackPrediction(coin, safeDays);
    fallback.error = error.message;
    return { ...fallback, cached: false };
  }
}

function listPredictableCoins() {
  return COIN_PREDICTIONS;
}

module.exports = {
  COIN_PREDICTIONS,
  getPricePrediction,
  listPredictableCoins,
  resolveCoin,
};
