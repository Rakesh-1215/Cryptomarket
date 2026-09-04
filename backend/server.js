const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const User = require("./models/User");
const Transaction = require("./models/Transaction");
const {
  sendVerificationOtpEmail,
  sendLoginOtpEmail,
  sendWelcomeEmail,
  createTransporter,
  getFromAddress,
  sendTestEmail,
} = require("./services/email");
const {
  getPricePrediction,
  listPredictableCoins,
} = require("./services/mlPrediction");
const {
  buildCurrentWeightsFromHoldings,
  listPortfolioUniverse,
  optimizePortfolio,
} = require("./services/portfolioOptimization");
const { buildPersonalizedRecommendations } = require("./services/recommendationEngine");
const { analyzeTechnicalIndicators } = require("./services/technicalAnalysis");
const { analyzeSentiment } = require("./services/sentimentAnalysis");
const { resolvePythonBin } = require("./services/pythonRuntime");

const app = express();
const PORT = process.env.PORT || 8080;
const COINLORE_API_URL = "https://api.coinlore.net/api/tickers/";
const JWT_SECRET = process.env.JWT_SECRET || "local-dev-secret-change-me";
const RAZORPAY_API_BASE_URL = "https://api.razorpay.com/v1";
const RAZORPAY_KEY_ID = String(process.env.RAZORPAY_KEY_ID || "").trim();
const RAZORPAY_KEY_SECRET = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
const RAZORPAY_COMPANY_NAME = String(process.env.RAZORPAY_COMPANY_NAME || "Cryptomarket").trim();
const RAZORPAY_CHECKOUT_THEME_COLOR = String(
  process.env.RAZORPAY_CHECKOUT_THEME_COLOR || "#2563eb",
).trim();
const RAZORPAY_TEST_AUTO_SUCCESS = String(
  process.env.RAZORPAY_TEST_AUTO_SUCCESS || "false",
).trim() === "true";
const USD_TO_INR_RATE = Number.parseFloat(process.env.USD_TO_INR_RATE) || 86;
const EMAIL_VERIFICATION_TTL_MINUTES = Number.parseInt(
  process.env.EMAIL_VERIFICATION_TTL_MINUTES,
  10,
) || 10;
const FRONTEND_DIST_DIR = path.join(__dirname, "..", "frontend", "dist");
let isMongoReady = false;

mongoose.set("bufferCommands", false);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(FRONTEND_DIST_DIR));

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 3000,
  })
  .then(() => {
    isMongoReady = true;
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    isMongoReady = false;
    console.error("MongoDB connection error:", err);
  });

mongoose.connection.on("connected", () => {
  isMongoReady = true;
});

mongoose.connection.on("disconnected", () => {
  isMongoReady = false;
  console.warn("MongoDB disconnected. Auth and portfolio features are temporarily unavailable.");
});

function requireDatabase(req, res, next) {
  if (isMongoReady) {
    next();
    return;
  }

  res.status(503).json({
    error:
      "Database is unavailable right now. Market data still works, but login, buying, and portfolio recommendations need MongoDB.",
  });
}

function toNumber(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeCoin(coin) {
  return {
    ...coin,
    symbol: (coin.symbol || "").toUpperCase(),
    price: toNumber(coin.price_usd),
    change1h: toNumber(coin.percent_change_1h),
    change24h: toNumber(coin.percent_change_24h),
    change7d: toNumber(coin.percent_change_7d),
    marketCap: toNumber(coin.market_cap_usd),
    volume24: toNumber(coin.volume24),
    circulatingSupply: toNumber(coin.csupply),
    rankNumber: Number.parseInt(coin.rank, 10) || 9999,
  };
}

function normalizeHoldingKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function getTrendPrediction(coin) {
  let score = 0;
  score += coin.change1h * 0.2;
  score += coin.change24h * 0.45;
  score += coin.change7d * 0.25;

  if (coin.volume24 > 0 && coin.marketCap > 0) {
    score += Math.min((coin.volume24 / coin.marketCap) * 100, 10) * 0.1;
  }

  let label = "Stable";
  if (score >= 1.5) label = "Up";
  if (score <= -1.5) label = "Down";

  const confidence = Math.max(52, Math.min(94, Math.round(55 + Math.abs(score) * 6)));

  return {
    label,
    confidence,
    score: Number(score.toFixed(2)),
  };
}

function getRiskScore(coin) {
  let score = 0;
  const volatility = Math.abs(coin.change24h) + Math.abs(coin.change7d) * 0.55;

  score += Math.min(volatility * 4, 45);
  if (coin.rankNumber > 100) score += 20;
  else if (coin.rankNumber > 50) score += 12;
  else if (coin.rankNumber > 20) score += 6;

  if (coin.marketCap < 100000000) score += 18;
  else if (coin.marketCap < 1000000000) score += 10;

  if (coin.volume24 < 1000000) score += 12;
  else if (coin.volume24 < 10000000) score += 6;

  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  let label = "Low";
  if (normalizedScore >= 65) label = "High";
  else if (normalizedScore >= 35) label = "Medium";

  return { label, score: normalizedScore };
}

function addAiInsights(coin) {
  const normalized = normalizeCoin(coin);

  return {
    ...coin,
    ai: {
      trendPrediction: getTrendPrediction(normalized),
      risk: getRiskScore(normalized),
    },
  };
}

async function fetchCryptoData() {
  const fetchClient =
    globalThis.fetch || ((...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args)));
  const response = await fetchClient(COINLORE_API_URL);
  if (!response.ok) {
    throw new Error(`CoinLore request failed with status ${response.status}`);
  }

  const payload = await response.json();
  if (!payload.data || !Array.isArray(payload.data)) {
    throw new Error("CoinLore returned an invalid data format");
  }

  return payload.data.map(addAiInsights);
}

function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

async function storeVerificationCode(user, otp) {
  user.emailVerified = false;
  user.emailVerificationToken = await bcrypt.hash(otp, 10);
  user.emailVerificationExpiresAt = new Date(
    Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000,
  );
  await user.save();
}

async function storeLoginOtp(user, otp) {
  user.loginOtpToken = await bcrypt.hash(otp, 10);
  user.loginOtpExpiresAt = new Date(
    Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000,
  );
  await user.save();
}

function fireAndForgetEmail(task, label) {
  setImmediate(() => {
    task().catch((error) => {
      console.error(`${label} failed after response:`, error.message);
    });
  });
}

function createAuthToken(user) {
  return jwt.sign({ userId: user._id }, JWT_SECRET, {
    expiresIn: "1h",
  });
}

function isRazorpayConfigured() {
  return Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
}

function isRazorpayTestMode() {
  return RAZORPAY_KEY_ID.startsWith("rzp_test_");
}

function getRazorpayAuthHeader() {
  const credentials = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
  return `Basic ${credentials}`;
}

function maskSecret(value) {
  const text = String(value || "");
  if (text.length <= 6) return "*".repeat(text.length);
  return `${text.slice(0, 3)}***${text.slice(-3)}`;
}

function convertUsdToInr(usdAmount) {
  return Number((usdAmount * USD_TO_INR_RATE).toFixed(2));
}

function amountToPaise(amount) {
  return Math.round(amount * 100);
}

async function razorpayRequest(endpoint, options = {}) {
  if (!isRazorpayConfigured()) {
    throw new Error("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env.");
  }

  const fetchClient =
    globalThis.fetch || ((...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args)));
  const response = await fetchClient(`${RAZORPAY_API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: getRazorpayAuthHeader(),
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        `Razorpay authentication failed. Check that your test key pair matches exactly in backend/.env. Current key id: ${RAZORPAY_KEY_ID || "(missing)"}, secret: ${maskSecret(RAZORPAY_KEY_SECRET)}.`,
      );
    }
    throw new Error(payload.error?.description || payload.error?.reason || "Razorpay request failed.");
  }

  return payload;
}

function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return expectedSignature === signature;
}

function buildRecordedTransaction({
  userId,
  cryptoType,
  amount,
  price,
  totalValueInr,
  currency,
  paymentStatus,
  paymentOrderId,
  paymentId,
  paymentSignature,
  paymentMethod,
  paymentEmail,
  paymentContact,
}) {
  const parsedAmount = Number.parseFloat(amount);
  const parsedPrice = Number.parseFloat(price);
  const totalValue = Number((parsedAmount * parsedPrice).toFixed(8));

  return new Transaction({
    buyer: userId,
    cryptoType: normalizeHoldingKey(cryptoType),
    amount: parsedAmount,
    price: parsedPrice,
    totalValue,
    totalValueInr,
    currency: currency || "INR",
    paymentProvider: "razorpay",
    paymentStatus,
    paymentOrderId,
    paymentId,
    paymentSignature: paymentSignature || null,
    paymentMethod: paymentMethod || null,
    paymentEmail: paymentEmail || null,
    paymentContact: paymentContact || null,
  });
}

// Routes
app.post("/api/register", requireDatabase, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    console.log("====================================");
    console.log("New Registration Request");
    console.log("Username:", username);
    console.log("Email:", email);

    const normalizedEmail = String(email || "").trim().toLowerCase();

    const otp = generateOtp();
    console.log("Generated OTP:", otp);

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      email: normalizedEmail,
      password: hashedPassword,
    });

    await storeVerificationCode(user, otp);
    console.log("User saved to MongoDB.");

    console.log("Registration completed successfully.");
    console.log("====================================");

    fireAndForgetEmail(
      async () =>
        sendVerificationOtpEmail({
          username,
          email: normalizedEmail,
          otp,
        }),
      "Verification OTP email",
    );

    res.status(201).json({
      message: "User registered successfully. Verification OTP is being sent.",
      verificationRequired: true,
      email: normalizedEmail,
    });

  } catch (error) {
    console.error("REGISTER ERROR");
    console.error(error);

    res.status(400).json({
      error: error.message,
    });
  }
});

app.post("/api/verify-email", requireDatabase, async (req, res) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const verificationCode = String(otp || "").trim();

    if (!normalizedEmail || !verificationCode) {
      return res.status(400).json({ error: "Email and OTP are required." });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (user.emailVerified) {
      return res.json({ message: "Email is already verified." });
    }

    if (!user.emailVerificationToken || !user.emailVerificationExpiresAt) {
      return res.status(400).json({ error: "No verification code is active for this account." });
    }

    if (user.emailVerificationExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: "OTP has expired. Please request a new code." });
    }

    const isValid = await bcrypt.compare(verificationCode, user.emailVerificationToken);
    if (!isValid) {
      return res.status(400).json({ error: "Invalid OTP." });
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpiresAt = null;
    await user.save();

    res.json({ message: "Email verified successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/resend-verification-otp", requireDatabase, async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ error: "Email is required." });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: "Email is already verified." });
    }

    const otp = generateOtp();
    await storeVerificationCode(user, otp);
    const emailResult = await sendVerificationOtpEmail({ username: user.username, email: normalizedEmail, otp });
    if (!emailResult.sent) {
      return res.status(502).json({
        error:
          emailResult.skipped
            ? "Email verification is not configured yet. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM in backend/.env."
            : "Verification email could not be sent. Please try again later.",
      });
    }

    res.json({ message: "A new OTP has been sent to your email." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/test-email", async (req, res) => {
  try {
    const { to, subject, text } = req.body;
    const recipient = String(to || process.env.SMTP_USER || process.env.SMTP_FROM || "").trim();

    if (!recipient) {
      return res.status(400).json({
        error: "Recipient email is required, or set SMTP_USER/SMTP_FROM in backend/.env.",
      });
    }

    const result = await sendTestEmail({
      to: recipient,
      subject,
      text,
    });

    if (!result.sent) {
      return res.status(502).json({
        error:
          result.skipped
            ? "SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM in backend/.env."
            : result.error || "Test email could not be sent.",
      });
    }

    res.json({ message: `Test email sent to ${recipient}.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/login", requireDatabase, async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.emailVerified !== true) {
      return res.status(403).json({ error: "Please verify your email before logging in." });
    }

    const otp = generateOtp();
    await storeLoginOtp(user, otp);

    fireAndForgetEmail(
      async () =>
        sendLoginOtpEmail({
          username: user.username,
          email: normalizedEmail,
          otp,
        }),
      "Login OTP email",
    );

    res.json({
      message: "Login OTP request accepted. The email is being sent now.",
      verificationRequired: true,
      email: normalizedEmail,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/verify-login-otp", requireDatabase, async (req, res) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const loginOtp = String(otp || "").trim();

    if (!normalizedEmail || !loginOtp) {
      return res.status(400).json({ error: "Email and OTP are required." });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (!user.loginOtpToken || !user.loginOtpExpiresAt) {
      return res.status(400).json({ error: "No login OTP is active for this account." });
    }

    if (user.loginOtpExpiresAt.getTime() < Date.now()) {
      user.loginOtpToken = null;
      user.loginOtpExpiresAt = null;
      await user.save();
      return res.status(400).json({ error: "Login OTP has expired. Please sign in again." });
    }

    const isValid = await bcrypt.compare(loginOtp, user.loginOtpToken);
    if (!isValid) {
      return res.status(400).json({ error: "Invalid OTP." });
    }

    user.loginOtpToken = null;
    user.loginOtpExpiresAt = null;
    await user.save();

    res.json({
      token: createAuthToken(user),
      user: { id: user._id, username: user.username, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/cryptos", async (req, res) => {
  try {
    const cryptos = await fetchCryptoData();
    res.json({ data: cryptos });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get("/api/currency-rate", (req, res) => {
  res.json({
    rate: USD_TO_INR_RATE,
    currency: "INR",
    base: "USD",
  });
});

app.get("/api/ai/health", (req, res) => {
  const pythonBin = resolvePythonBin();
  const result = spawnSync(pythonBin, ["--version"], {
    encoding: "utf8",
    windowsHide: true,
  });

  const output = [result.stdout, result.stderr].filter(Boolean).join(" ").trim();
  const ok = !result.error && result.status === 0;

  res.json({
    ok,
    python: pythonBin,
    message: output || (ok ? "Python runtime is available." : "Python runtime is not reachable."),
    version: output || null,
  });
});

app.get("/api/ai/predictable-coins", (req, res) => {
  res.json({ coins: listPredictableCoins() });
});

app.get("/api/ai/price-prediction", async (req, res) => {
  try {
    const symbol = req.query.symbol;
    const name = req.query.name;
    const days = Number.parseInt(req.query.days, 10) || 90;
    const force = req.query.force === "true";

    if (!symbol && !name) {
      return res.status(400).json({
        error: "Query parameter 'symbol' or 'name' is required.",
      });
    }

    const prediction = await getPricePrediction({
      symbol,
      name,
      days,
      force,
    });
    res.json(prediction);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get("/api/ai/portfolio/universe", (req, res) => {
  res.json({ assets: listPortfolioUniverse() });
});

function optionalAuthenticate(req, res, next) {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
  } catch {
    // Ignore invalid tokens for optional personalization.
  }
  next();
}

app.get("/api/ai/portfolio/optimize", optionalAuthenticate, async (req, res) => {
  try {
    const symbols = req.query.symbols;
    const days = Number.parseInt(req.query.days, 10) || 90;
    const budget = Number.parseFloat(req.query.budget) || 10000;
    const riskFreeRate = Number.parseFloat(req.query.riskFreeRate) || 0.04;
    const force = req.query.force === "true";
    const includeHoldings = req.query.includeHoldings === "true";

    let currentWeights = null;
    if (includeHoldings && req.userId && isMongoReady) {
      const [transactions, cryptos] = await Promise.all([
        Transaction.find({ buyer: req.userId }).sort({ timestamp: -1 }).limit(50),
        fetchCryptoData(),
      ]);

      const priceMap = new Map(
        cryptos.map((coin) => [
          normalizeHoldingKey(coin.symbol),
          Number.parseFloat(coin.price_usd) || 0,
        ]),
      );

      const summaryMap = new Map();
      for (const purchase of transactions) {
        const key = normalizeHoldingKey(purchase.cryptoType);
        const current = summaryMap.get(key) || {
          cryptoType: purchase.cryptoType,
          totalAmount: 0,
          totalSpent: 0,
        };
        current.totalAmount += purchase.amount;
        current.totalSpent += purchase.totalValue;
        summaryMap.set(key, current);
      }

      currentWeights = buildCurrentWeightsFromHoldings(
        [...summaryMap.values()],
        priceMap,
      );
    }

    const result = await optimizePortfolio({
      symbols,
      days,
      budget,
      riskFreeRate,
      currentWeights,
      force,
    });

    res.json({
      ...result,
      personalized: Boolean(currentWeights),
    });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get("/api/ai/market-insights", async (req, res) => {
  try {
    const cryptos = await fetchCryptoData();
    const technicalAnalysis = analyzeTechnicalIndicators(cryptos.slice(0, 10));
    const sentiment = analyzeSentiment(cryptos.slice(0, 10));
    const predictedGainers = [...cryptos]
      .filter((coin) => coin.ai.trendPrediction.label === "Up")
      .sort(
        (a, b) =>
          b.ai.trendPrediction.confidence - a.ai.trendPrediction.confidence,
      )
      .slice(0, 5);

    const highRiskCoins = [...cryptos]
      .filter((coin) => coin.ai.risk.label === "High")
      .sort((a, b) => b.ai.risk.score - a.ai.risk.score)
      .slice(0, 5);

    const lowRiskCoins = [...cryptos]
      .filter((coin) => coin.ai.risk.label === "Low")
      .filter((coin) => coin.ai.trendPrediction.label !== "Down")
      .sort((a, b) => {
        const trendGap =
          b.ai.trendPrediction.confidence - a.ai.trendPrediction.confidence;
        if (trendGap !== 0) return trendGap;
        return (Number.parseInt(a.rank, 10) || 9999) - (Number.parseInt(b.rank, 10) || 9999);
      })
      .slice(0, 5);

    const marketSummary = cryptos.reduce(
      (summary, coin) => {
        if (coin.ai.trendPrediction.label === "Up") summary.up += 1;
        if (coin.ai.trendPrediction.label === "Down") summary.down += 1;
        if (coin.ai.trendPrediction.label === "Stable") summary.stable += 1;
        return summary;
      },
      { up: 0, down: 0, stable: 0 },
    );

    res.json({
      marketSummary,
      predictedGainers,
      highRiskCoins,
      lowRiskCoins,
      technicalAnalysis,
      sentiment,
    });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

// Middleware to verify JWT
const authenticate = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Access denied" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

app.post("/api/buy", requireDatabase, authenticate, async (req, res) => {
  try {
    const { cryptoType, amount, price } = req.body;
    const totalValue = amount * price;
    const transaction = new Transaction({
      buyer: req.userId,
      cryptoType,
      amount,
      price,
      totalValue,
    });
    await transaction.save();
    res.status(201).json({ message: "Purchase recorded successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/payments/razorpay/config", authenticate, (req, res) => {
  if (!isRazorpayConfigured()) {
    return res.status(503).json({
      error: "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env.",
    });
  }

  res.json({
    keyId: RAZORPAY_KEY_ID,
    companyName: RAZORPAY_COMPANY_NAME,
    themeColor: RAZORPAY_CHECKOUT_THEME_COLOR,
    currency: "INR",
    usdToInrRate: USD_TO_INR_RATE,
  });
});

app.post("/api/payments/razorpay/order", requireDatabase, authenticate, async (req, res) => {
  try {
    if (!isRazorpayConfigured()) {
      return res.status(503).json({
        error: "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env.",
      });
    }

    const cryptoType = normalizeHoldingKey(req.body.cryptoType);
    const cryptoName = String(req.body.cryptoName || cryptoType).trim() || cryptoType;
    const amount = Number.parseFloat(req.body.amount);
    const price = Number.parseFloat(req.body.price);

    if (!cryptoType) {
      return res.status(400).json({ error: "cryptoType is required." });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "A valid crypto amount is required." });
    }

    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ error: "A valid price is required." });
    }

    const totalValue = Number((amount * price).toFixed(8));
    const totalValueInr = convertUsdToInr(totalValue);
    const amountInPaise = amountToPaise(totalValueInr);

    if (!Number.isFinite(amountInPaise) || amountInPaise < 100) {
      return res.status(400).json({
        error: "The minimum Razorpay test amount is INR 1.00. Increase the quantity and try again.",
      });
    }

    const receipt = `cm_${Date.now()}_${cryptoType.slice(0, 6)}`.slice(0, 40);
    const order = await razorpayRequest("/orders", {
      method: "POST",
      body: JSON.stringify({
        amount: amountInPaise,
        currency: "INR",
        receipt,
        notes: {
          buyerId: String(req.userId),
          cryptoType,
          cryptoName,
          quantity: String(amount),
          unitPriceUsd: String(price),
          totalValueUsd: String(totalValue),
          totalValueInr: String(totalValueInr),
        },
      }),
    });

    res.status(201).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      cryptoType,
      cryptoName,
      quantity: amount,
      unitPriceUsd: price,
      totalValueUsd: totalValue,
      totalValueInr,
      usdToInrRate: USD_TO_INR_RATE,
      companyName: RAZORPAY_COMPANY_NAME,
      themeColor: RAZORPAY_CHECKOUT_THEME_COLOR,
      keyId: RAZORPAY_KEY_ID,
      testMode: isRazorpayTestMode(),
      testAutoSuccess: isRazorpayTestMode() && RAZORPAY_TEST_AUTO_SUCCESS,
    });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.post("/api/payments/razorpay/test-success", requireDatabase, authenticate, async (req, res) => {
  try {
    if (!isRazorpayConfigured()) {
      return res.status(503).json({
        error: "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env.",
      });
    }

    if (!isRazorpayTestMode() || !RAZORPAY_TEST_AUTO_SUCCESS) {
      return res.status(403).json({
        error: "Test auto-success is disabled.",
      });
    }

    const {
      razorpay_order_id: razorpayOrderId,
      cryptoType,
      cryptoName,
      amount,
      price,
      preferredMethod,
    } = req.body;

    if (!razorpayOrderId || !cryptoType || !amount || !price) {
      return res.status(400).json({
        error: "razorpay_order_id, cryptoType, amount, and price are required.",
      });
    }

    const existingTransaction = await Transaction.findOne({
      paymentOrderId: razorpayOrderId,
      buyer: req.userId,
    });
    if (existingTransaction) {
      return res.json({
        success: true,
        message: "Payment already recorded.",
        transaction: existingTransaction,
      });
    }

    const parsedAmount = Number.parseFloat(amount);
    const parsedPrice = Number.parseFloat(price);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: "Valid purchase amount and price are required." });
    }

    const totalValueInr = convertUsdToInr(parsedAmount * parsedPrice);
    const transaction = buildRecordedTransaction({
      userId: req.userId,
      cryptoType,
      amount: parsedAmount,
      price: parsedPrice,
      totalValueInr,
      currency: "INR",
      paymentStatus: "captured",
      paymentOrderId: razorpayOrderId,
      paymentId: `pay_test_auto_${Date.now()}`,
      paymentSignature: null,
      paymentMethod: preferredMethod === "paylater" ? "paylater_test_auto" : "card_test_auto",
    });

    await transaction.save();

    res.status(201).json({
      success: true,
      message: "Test payment auto-completed successfully.",
      transaction,
      payment: {
        id: transaction.paymentId,
        status: transaction.paymentStatus,
        method: transaction.paymentMethod,
        amount: totalValueInr,
        currency: "INR",
      },
      crypto: {
        name: cryptoName,
        symbol: normalizeHoldingKey(cryptoType),
        quantity: parsedAmount,
        unitPriceUsd: parsedPrice,
        totalValueUsd: Number((parsedAmount * parsedPrice).toFixed(8)),
        totalValueInr,
      },
    });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.post("/api/payments/razorpay/verify", requireDatabase, authenticate, async (req, res) => {
  try {
    if (!isRazorpayConfigured()) {
      return res.status(503).json({
        error: "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env.",
      });
    }

    const {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
      cryptoType,
      cryptoName,
      amount,
      price,
    } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        error: "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.",
      });
    }

    const existingTransaction = await Transaction.findOne({
      paymentOrderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      buyer: req.userId,
    });
    if (existingTransaction) {
      return res.json({
        success: true,
        message: "Payment already verified.",
        transaction: existingTransaction,
      });
    }

    const isSignatureValid = verifyRazorpaySignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });

    if (!isSignatureValid) {
      return res.status(400).json({ error: "Invalid Razorpay signature." });
    }

    const payment = await razorpayRequest(`/payments/${razorpayPaymentId}`, {
      method: "GET",
    });

    if (payment.order_id !== razorpayOrderId) {
      return res.status(400).json({ error: "Payment order mismatch." });
    }

    if (!["authorized", "captured"].includes(payment.status)) {
      return res.status(400).json({
        error: `Payment is not successful yet. Current Razorpay status: ${payment.status}.`,
      });
    }

    const parsedAmount = Number.parseFloat(amount);
    const parsedPrice = Number.parseFloat(price);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: "Valid purchase amount and price are required." });
    }

    const totalValue = Number((parsedAmount * parsedPrice).toFixed(8));
    const totalValueInr = Number(((payment.amount || 0) / 100).toFixed(2));

    const transaction = buildRecordedTransaction({
      userId: req.userId,
      cryptoType,
      amount: parsedAmount,
      price: parsedPrice,
      totalValueInr,
      currency: payment.currency || "INR",
      paymentStatus: payment.status,
      paymentOrderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      paymentSignature: razorpaySignature,
      paymentMethod: payment.method || null,
      paymentEmail: payment.email || null,
      paymentContact: payment.contact || null,
    });

    await transaction.save();

    res.status(201).json({
      success: true,
      message: "Payment verified and purchase recorded successfully.",
      transaction,
      payment: {
        id: payment.id,
        status: payment.status,
        method: payment.method,
        amount: totalValueInr,
        currency: payment.currency,
      },
      crypto: {
        name: cryptoName,
        symbol: normalizeHoldingKey(cryptoType),
        quantity: parsedAmount,
        unitPriceUsd: parsedPrice,
        totalValueUsd: totalValue,
        totalValueInr,
      },
    });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});
// Verify token endpoint
app.get("/api/verify", requireDatabase, authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({
      user: { id: user._id, username: user.username, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/recommendations", requireDatabase, authenticate, async (req, res) => {
  try {
    const [transactions, cryptos] = await Promise.all([
      Transaction.find({ buyer: req.userId }).sort({ timestamp: -1 }).limit(25),
      fetchCryptoData(),
    ]);

    const result = buildPersonalizedRecommendations({
      transactions,
      cryptos,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/purchases", requireDatabase, authenticate, async (req, res) => {
  try {
    const purchases = await Transaction.find({ buyer: req.userId })
      .sort({ timestamp: -1 })
      .limit(20);

    const summaryMap = new Map();
    for (const purchase of purchases) {
      const key = normalizeHoldingKey(purchase.cryptoType);
      const current = summaryMap.get(key) || {
        cryptoType: purchase.cryptoType,
        totalAmount: 0,
        totalSpent: 0,
      };

      current.totalAmount += purchase.amount;
      current.totalSpent += purchase.totalValue;
      summaryMap.set(key, current);
    }

    res.json({
      purchases,
      holdings: [...summaryMap.values()],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Serve the built React app in production.
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    next();
    return;
  }

  res.sendFile(path.join(FRONTEND_DIST_DIR, "index.html"), (error) => {
    if (error) next();
  });
});

let server;

if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`Cryptomarket server running on port ${PORT}`);
    console.log(`Backend API: http://localhost:${PORT}`);
  });

  process.on("uncaughtException", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${PORT} is already in use. Please close the process or use a different port.`,
      );
    }
    process.exit(1);
  });
}

module.exports = { app, server };
