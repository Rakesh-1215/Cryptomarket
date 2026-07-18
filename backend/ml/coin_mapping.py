"""Map common crypto symbols to CoinGecko coin IDs."""

SYMBOL_TO_COINGECKO = {
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "USDT": "tether",
    "BNB": "binancecoin",
    "SOL": "solana",
    "XRP": "ripple",
    "USDC": "usd-coin",
    "ADA": "cardano",
    "DOGE": "dogecoin",
    "TRX": "tron",
    "AVAX": "avalanche-2",
    "DOT": "polkadot",
    "LINK": "chainlink",
    "MATIC": "matic-network",
    "SHIB": "shiba-inu",
    "LTC": "litecoin",
    "BCH": "bitcoin-cash",
    "UNI": "uniswap",
    "XLM": "stellar",
    "ATOM": "cosmos",
    "ETC": "ethereum-classic",
    "XMR": "monero",
    "FIL": "filecoin",
    "APT": "aptos",
    "ARB": "arbitrum",
    "OP": "optimism",
    "NEAR": "near",
    "ICP": "internet-computer",
    "HBAR": "hedera-hashgraph",
    "VET": "vechain",
}


def resolve_coin_id(symbol: str, name: str | None = None) -> str | None:
    key = (symbol or "").strip().upper()
    if key in SYMBOL_TO_COINGECKO:
        return SYMBOL_TO_COINGECKO[key]

    if name:
        slug = name.strip().lower().replace(" ", "-")
        if slug:
            return slug

    return None
