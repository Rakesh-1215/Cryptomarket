# AI-Powered Crypto Market Prediction and Portfolio Recommendation System

## 1. Project Overview

This project started as a full-stack crypto market web application and was extended into an AI-style system.

It now combines:
- Live cryptocurrency market data
- User authentication
- Purchase transaction tracking
- Rule-based trend prediction
- Rule-based risk analysis
- Portfolio recommendations
- An AI dashboard for insights

This is a beginner-friendly AI MVP, which means it gives intelligent outputs and personalized suggestions, even though it does not yet use a trained machine learning model.

## 2. Main Goal

The goal of this project is to help users:
- View live crypto market data
- Understand which coins may rise or fall
- See risk levels for each coin
- Buy cryptocurrencies in a simulated workflow
- Receive recommendations based on their purchase history

So the project is not just a normal crypto dashboard. It adds decision-support features that make it smarter and more personalized.

## 3. Why This Project Is AI-Powered

This project is AI-powered because it does more than display raw data.

It analyzes market inputs and generates:
- Trend predictions such as `Up`, `Stable`, or `Down`
- Risk labels such as `Low`, `Medium`, or `High`
- Personalized portfolio recommendations

These features make the project different from a standard crypto website.

### What makes it different from ordinary crypto apps

A basic crypto app usually:
- fetches prices
- lists market data
- maybe shows charts

This project additionally:
- interprets data
- applies scoring rules
- classifies coins
- gives recommendation output
- adapts results to user purchase history

That extra intelligence is what gives it an AI flavor.

## 4. Current AI Approach

Right now, the project uses a **rule-based AI approach**.

This means:
- the system looks at market signals
- applies logic rules
- produces a predicted label and confidence

Example:
- if 24h change is strong positive
- and 7d trend is also healthy
- and volume is supportive
- then prediction becomes `Up`

This is not a trained ML model yet, but it is still a valid first AI stage for a beginner project.

### Why we used a rule-based approach first

We chose this because:
- it is easier to understand
- it works well for learning
- it integrates quickly with an existing full-stack app
- it prepares the project for future ML upgrades

This is a common first step before using real machine learning.

## 5. System Architecture

```text
React Frontend
    |
    v
Express Backend
    |
    +--> CoinLore API (live crypto market data)
    |
    +--> MongoDB (users + transactions)
    |
    +--> AI logic in backend
```

### Flow of the system

1. Frontend requests crypto data from backend.
2. Backend fetches raw market data from CoinLore.
3. Backend calculates prediction and risk.
4. Backend sends enriched data to frontend.
5. Logged-in users can buy coins.
6. Purchase history is stored in MongoDB.
7. Recommendation API checks purchase history and suggests suitable coins.

## 6. Tech Stack Used

### Frontend

- `React`
- `React Router`
- `Vite`
- plain CSS with utility-style class usage already present in the project

### Backend

- `Node.js`
- `Express.js`

### Database

- `MongoDB`
- `Mongoose`

### Authentication

- `bcryptjs`
- `jsonwebtoken`

### Email verification

- `nodemailer`
- OTP-based email verification after registration
- OTP-based login verification before a JWT session is created

### Email

- `nodemailer`

### External Data Source

- `CoinLore API`

### Development Utilities

- `dotenv`
- `concurrently`

## 7. Toolkit Notes

This section explains each toolkit in simple language.

### React

React is used to build the user interface.

We used React because:
- it makes UI easier to organize into components
- it supports state and effects
- it works well with dynamic API data

Where it helps in this project:
- crypto listing page
- login and register pages
- navbar
- AI dashboard
- modals for coin details and simulated payment

### React Router

React Router handles navigation between pages without reloading the browser.

Used for routes like:
- `/`
- `/trending`
- `/gainers`
- `/login`
- `/register`
- `/ai-dashboard`

### Vite

Vite is the frontend build and dev tool.

Why we used it:
- fast development server
- fast production build
- simple React integration

### Node.js

Node.js runs the backend JavaScript outside the browser.

It is the runtime that powers:
- server logic
- API endpoints
- database access
- authentication

### Express.js

Express is the backend framework used to create APIs.

We used it for:
- user registration
- login
- token verification
- buy transactions
- live crypto API passthrough
- AI insights API
- recommendation API

### MongoDB

MongoDB stores project data in document format.

We used it to store:
- user accounts
- purchase transactions

Why it fits this project:
- easy to use with JavaScript
- flexible schema design
- works nicely for rapid prototyping

### Mongoose

Mongoose is the ODM used to connect Node.js with MongoDB.

It helps by:
- defining schemas
- validating structure
- making database operations easier

Models used in this project:
- `User`
- `Transaction`

### bcryptjs

`bcryptjs` hashes passwords before storing them.

Why important:
- passwords should never be stored as plain text
- hashed passwords improve security

### jsonwebtoken

`jsonwebtoken` is used for login tokens.

How it works:
- user logs in
- backend checks credentials
- backend generates a JWT token
- frontend stores token
- protected routes use token for authorization

### dotenv

`dotenv` loads variables from `.env`.

We used it for:
- `MONGODB_URI`
- `JWT_SECRET`

This keeps important configuration outside the main code.

### concurrently

`concurrently` allows frontend and backend to run together with one command.

Used in:
- `npm run dev:all`

### CoinLore API

CoinLore provides live cryptocurrency market data.

Fields used from CoinLore include:
- `price_usd`
- `percent_change_1h`
- `percent_change_24h`
- `percent_change_7d`
- `market_cap_usd`
- `volume24`
- `csupply`
- `rank`

These fields act like the input features for our AI logic.

## 8. Features Implemented

### 1. Live Crypto Market Data

The app fetches live data from CoinLore through backend endpoint:

- `GET /api/cryptos`

This is better than calling CoinLore directly from React because:
- backend can enrich the data
- frontend stays simpler
- AI logic stays centralized

### 2. User Authentication

Users can:
- register
- login
- verify session
- logout

Protected actions:
- buy crypto
- view personalized recommendations

### 3. Buy Transaction Recording

Users can simulate buying a cryptocurrency.

Each purchase stores:
- buyer
- coin type
- amount
- price
- total value
- timestamp

This transaction history becomes the base for personalization.

### 4. Trend Prediction

The backend calculates a simple trend prediction for each coin.

Output:
- `Up`
- `Stable`
- `Down`

It also gives a confidence percentage.

#### Logic used

The prediction score uses:
- 1-hour change
- 24-hour change
- 7-day change
- volume to market-cap ratio

Positive values increase the chance of `Up`.
Negative values increase the chance of `Down`.
Middle-range values become `Stable`.

### 5. Risk Scoring

The backend assigns each coin a risk label:
- `Low`
- `Medium`
- `High`

#### Logic used

Risk is estimated using:
- price volatility
- market rank
- market capitalization
- trading volume

General idea:
- more volatility means more risk
- low market cap means more risk
- low volume means more risk
- weaker rank often means more risk

### 6. Portfolio Recommendations

Endpoint:
- `GET /api/recommendations`

Recommendations are personalized using:
- user purchase history
- current trend prediction
- current risk label

#### Recommendation approach

The system:
1. checks which coins the user already owns
2. avoids recommending those coins again
3. removes coins predicted as `Down`
4. removes coins with `High` risk
5. sorts the remaining coins by stronger trend confidence and better rank

This creates a simple but useful personalized recommendation list.

### 7. AI Dashboard

The AI dashboard shows:
- coins analyzed
- predicted up coins
- stable coins
- predicted down coins
- top predicted gainers
- highest risk watchlist
- personalized recommendations for logged-in users

This page turns separate AI outputs into one focused experience.

## 9. Important Backend APIs

### Public APIs

- `GET /api/cryptos`
  Returns live crypto data plus AI insights.

- `GET /api/ai/market-insights`
  Returns predicted gainers, high-risk coins, and market summary.

### Protected APIs

- `POST /api/register`
- `POST /api/login`
- `GET /api/verify`
- `POST /api/buy`
- `GET /api/recommendations`

Protected APIs require a JWT token.

## 10. Database Design

### User Model

Stores:
- username
- email
- password
- created date

### Transaction Model

Stores:
- buyer reference
- crypto type
- amount
- price
- total value
- timestamp

### Why this design matters

Without transactions, the system cannot personalize recommendations.

So the database is not only for authentication. It also supports the AI-style user-specific experience.

## 11. Approaches Used in This Project

### Approach 1: Full-stack first, AI second

We did not start with machine learning.
We first made sure the app could:
- fetch data
- store users
- store transactions
- support frontend pages

Then we added AI-style logic on top.

This is a good beginner approach because it builds a stable foundation first.

### Approach 2: Backend-centered intelligence

Instead of calculating prediction logic in the frontend, we kept it in the backend.

Benefits:
- one source of truth
- easier to update logic
- cleaner frontend
- future ML integration becomes easier

### Approach 3: Rule-based intelligence

We used a simple explainable scoring approach instead of a black-box model.

Benefits:
- easy to understand
- easy to debug
- easy to present in interviews or viva

### Approach 4: Personalization using transactions

Rather than generic recommendations for everyone, we used user purchase history to personalize the result.

This makes the project feel more intelligent and useful.

## 12. Database Schema, API Endpoints, ML Pipeline, and Explainable AI

### Database schema

The application uses MongoDB with two main collections:

- Users
  - username
  - email
  - password (hashed)
  - createdAt
- Transactions
  - buyer (reference to the user)
  - cryptoType
  - amount
  - price
  - totalValue
  - timestamp

This schema supports both authentication and personalized recommendations based on user buying behavior.

### API endpoints

Public endpoints:
- GET /api/cryptos — returns live market data with AI enrichment
- GET /api/ai/health — checks the Python ML runtime
- GET /api/ai/predictable-coins — returns supported ML coin symbols
- GET /api/ai/price-prediction — runs the ML prediction pipeline
- GET /api/ai/market-insights — returns market summary, gainers, and risk watchlist

Protected endpoints:
- POST /api/register
- POST /api/login
- GET /api/verify
- POST /api/buy
- GET /api/recommendations
- GET /api/purchases
- GET /api/ai/portfolio/optimize

### ML pipeline

The Python ML pipeline is triggered through the Node backend and follows this flow:

1. Fetch historical market data from CoinGecko.
2. Build a tabular dataset with prices, volume, moving averages, returns, and volatility features.
3. Train multiple models on demand: Random Forest and XGBoost.
4. Aggregate model predictions into an ensemble signal.
5. Produce risk scoring, recommendation summaries, and explainable AI metadata.
6. Return the final forecast payload to the MERN application.

### Feature engineering

The feature set includes:
- price
- volume
- moving averages (7-day and 14-day)
- lagged prices
- daily return features
- rolling volatility
- volume change

These features help the model capture short-term momentum, trend behavior, and volatility regimes.

### Model training and evaluation

Training is performed on the fly using historical price windows. The system reports the following metrics for the ML workflow:
- MAE (Mean Absolute Error)
- RMSE (Root Mean Squared Error)
- MAPE (Mean Absolute Percentage Error)
- Accuracy
- Precision
- Recall
- F1 Score

These values are included in the prediction response so the frontend can display model quality alongside the forecast.

### Deployment strategy

Recommended deployment structure:
- React frontend: Vercel or Netlify
- Node/Express backend: Render, Railway, or Heroku
- Python ML runtime: Render or Railway with the Python dependencies installed from ml/requirements.txt
- MongoDB: MongoDB Atlas

The app is designed so the MERN frontend talks to the Express API, and the Express API bridges to the Python ML engine for prediction tasks.

### Explainable AI

The ML output is designed to be understandable rather than a black box:
- the response includes a natural-language explanation
- feature importance is surfaced for the most influential inputs
- the risk score and signal rationale are returned alongside the forecast
- the ensemble uses multiple models so users can see both the prediction and the reason behind it

## 13. What We Learned from This Project

By building this project, you learn:
- how frontend and backend connect
- how APIs work
- how MongoDB stores application data
- how authentication works
- how AI-style scoring can be added to a web app
- how personalized recommendation logic works
- how to structure a project for future ML upgrades

## 13. What Is Still Not Fully AI/ML Yet

This is important to understand honestly.

Current version:
- uses rule-based intelligence
- does not train on historical data
- does not evaluate model accuracy
- does not use scikit-learn or TensorFlow

So this is an **AI-style intelligent application**, not yet a full machine learning system.

That is completely okay for a beginner stage.

## 14. Future Improvements

To make this project stronger in AI/ML terms, the next upgrades should be:

1. Save historical coin data in MongoDB.
2. Build a dataset from past market snapshots.
3. Train a model to predict `Up`, `Down`, or `Stable`.
4. Replace rule-based trend prediction with model output.
5. Add evaluation metrics like accuracy, precision, recall, or F1-score.
6. Improve recommendations with collaborative filtering or portfolio similarity logic.
7. Add a portfolio analytics page.
8. Add tests for APIs and UI.

## 15. Local Setup Instructions

### Requirements

- Node.js installed
- MongoDB installed and running locally
- npm installed

### Environment file

Create or use:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/cryptomarket
JWT_SECRET=local-dev-secret-change-me
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=Cryptomarket <your-email@gmail.com>
EMAIL_VERIFICATION_TTL_MINUTES=10
```

### Verification flow

1. Register a new account.
2. The backend creates the user with `emailVerified = false` and sends a 6-digit OTP.
3. Open `/verify-email` and enter the email plus OTP.
4. After successful verification, submit the login form.
5. The backend checks the password, sends a login OTP, and only creates the JWT session after the OTP is entered correctly.

### Test email endpoint

You can send a mail test without registering a user:

```bash
POST /api/test-email
{
  "to": "your-email@example.com"
}
```

If `to` is omitted, the backend tries `SMTP_USER` or `SMTP_FROM` from `backend/.env`.

### Install dependencies

```bash
npm install
```

### Seed demo data

```bash
npm run seed
```

### Start frontend and backend

```bash
npm run dev:all
```

### URLs

- Frontend: `http://localhost:5000`
- Backend: `http://localhost:8080`

## 16. Demo Login Credentials

- `john@example.com` / `password123`
- `jane@example.com` / `password123`
- `trader@example.com` / `password123`

## 17. Project Strengths

This project is strong for a beginner because:
- it is full-stack
- it uses real APIs
- it uses a real database
- it supports authentication
- it stores user behavior
- it adds intelligent analysis
- it gives personalized output

That is already more complete than many beginner projects.

## 18. Short Viva Notes

If someone asks what type of project this is, you can say:

`This is a full-stack crypto market web application enhanced with rule-based AI features such as trend prediction, risk scoring, and portfolio recommendation. It is the MVP stage of a future ML-enabled system.`

If someone asks why it is AI-powered, you can say:

`Because the application does not only show market data. It analyzes that data and generates predictive and personalized outputs.`

If someone asks whether it is machine learning, you can say:

`Not fully yet. The current version uses rule-based intelligence. The next phase is to replace that logic with a trained ML model.`

## 19. Q and A

### Q1. Why did we choose a rule-based approach first?

Because it is easier to build, easier to explain, and suitable for a beginner project. It also gives us a base for adding ML later.

### Q2. What data is used for prediction?

The project uses live crypto market data such as price, 1-hour change, 24-hour change, 7-day change, volume, market cap, supply, and rank.

### Q3. Why did we use MongoDB?

MongoDB is flexible, easy to use with Node.js, and good for storing users and transaction documents.

### Q4. Why is the recommendation system personalized?

Because it uses the logged-in user's transaction history and avoids suggesting coins the user already owns.

### Q5. What makes this better than a normal crypto tracker?

A normal tracker only shows data. This project interprets the data, scores the risk, predicts possible direction, and suggests coins based on user behavior.

### Q6. Is this a real AI project?

Yes, at the beginner MVP level. It uses intelligent decision logic and personalized outputs. It is not yet a full machine learning system.

### Q7. What is needed to turn this into a stronger ML project?

Historical data collection, model training, model evaluation, and replacing rule-based logic with actual predictions from a trained model.

### Q8. Why is the AI logic kept in the backend?

Because backend logic is easier to maintain, easier to secure, and better for future scaling and ML integration.

### Q9. What is the role of JWT in this project?

JWT is used for user authentication and for protecting private routes like buying coins and fetching personal recommendations.

### Q10. Can this project be extended further?

Yes. It can be extended into a stronger crypto intelligence platform with machine learning, sentiment analysis, portfolio optimization, alerts, and historical analytics.

## 20. Final Summary

This project is a beginner-friendly AI-powered crypto web application that combines:
- full-stack development
- database-driven personalization
- rule-based intelligence
- user-focused insights

It is a strong MVP and a very good foundation for a future machine learning project.
