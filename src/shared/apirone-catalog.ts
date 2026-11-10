import type { ApironeCurrencyCode, ApironeCurrencyMeta } from "./types.ts";

/**
 * Complete Apirone v2 Supported Currencies Catalog
 * Reference: https://apirone.com/docs/currencies/index.md
 */
export const APIRONE_CURRENCIES: readonly ApironeCurrencyMeta[] = [
	{
		code: "gram",
		name: "TON / GRAM Network",
		symbol: "TON",
		network: "TON Mainnet",
		decimals: 9,
		unitName: "nanoton",
		unitsFactor: 1e9,
		iconColor: "#0098EA",
		badge: "Telegram Native",
		minDepositUsd: 1,
	},
	{
		code: "usdt@ton",
		name: "USDT (Jetton on TON)",
		symbol: "USDT",
		network: "TON Jetton",
		decimals: 6,
		unitName: "micro-usdt",
		unitsFactor: 1e6,
		iconColor: "#26A17B",
		badge: "Zero Gas Feel",
		minDepositUsd: 1,
	},
	{
		code: "usdt@trx",
		name: "USDT (TRC-20)",
		symbol: "USDT",
		network: "TRON (TRC-20)",
		decimals: 6,
		unitName: "micro-usdt",
		unitsFactor: 1e6,
		iconColor: "#26A17B",
		badge: "Popular",
		minDepositUsd: 2,
	},
	{
		code: "usdc@trx",
		name: "USDC (TRC-20)",
		symbol: "USDC",
		network: "TRON (TRC-20)",
		decimals: 6,
		unitName: "micro-usdc",
		unitsFactor: 1e6,
		iconColor: "#2775CA",
		badge: "Stablecoin",
		minDepositUsd: 2,
	},
	{
		code: "btc",
		name: "Bitcoin",
		symbol: "BTC",
		network: "Bitcoin Mainnet",
		decimals: 8,
		unitName: "satoshi",
		unitsFactor: 1e8,
		iconColor: "#F7931A",
		badge: "Store of Value",
		minDepositUsd: 5,
	},
	{
		code: "ltc",
		name: "Litecoin",
		symbol: "LTC",
		network: "Litecoin",
		decimals: 8,
		unitName: "litoshi",
		unitsFactor: 1e8,
		iconColor: "#345D9D",
		badge: "Low Fee",
		minDepositUsd: 1,
	},
	{
		code: "doge",
		name: "Dogecoin",
		symbol: "DOGE",
		network: "Dogecoin",
		decimals: 8,
		unitName: "kint",
		unitsFactor: 1e8,
		iconColor: "#C2A633",
		badge: "Meme King",
		minDepositUsd: 1,
	},
	{
		code: "trx",
		name: "TRON",
		symbol: "TRX",
		network: "TRON Mainnet",
		decimals: 6,
		unitName: "sun",
		unitsFactor: 1e6,
		iconColor: "#EF0027",
		badge: "Fast",
		minDepositUsd: 1,
	},
	{
		code: "eth",
		name: "Ethereum",
		symbol: "ETH",
		network: "ERC-20 Mainnet",
		decimals: 6,
		unitName: "microeth",
		unitsFactor: 1e6,
		iconColor: "#627EEA",
		badge: "Web3",
		minDepositUsd: 5,
	},
	{
		code: "usdt@eth",
		name: "USDT (ERC-20)",
		symbol: "USDT",
		network: "Ethereum (ERC-20)",
		decimals: 6,
		unitName: "micro-usdt",
		unitsFactor: 1e6,
		iconColor: "#26A17B",
		badge: "ERC-20",
		minDepositUsd: 5,
	},
	{
		code: "usdc@eth",
		name: "USDC (ERC-20)",
		symbol: "USDC",
		network: "Ethereum (ERC-20)",
		decimals: 6,
		unitName: "micro-usdc",
		unitsFactor: 1e6,
		iconColor: "#2775CA",
		badge: "ERC-20",
		minDepositUsd: 5,
	},
	{
		code: "bnb",
		name: "BNB Smart Chain",
		symbol: "BNB",
		network: "BSC (BEP-20)",
		decimals: 8,
		unitName: "jager",
		unitsFactor: 1e8,
		iconColor: "#F3BA2F",
		badge: "BSC",
		minDepositUsd: 2,
	},
	{
		code: "usdt@bnb",
		name: "USDT (BEP-20)",
		symbol: "USDT",
		network: "BNB Smart Chain",
		decimals: 6,
		unitName: "micro-usdt",
		unitsFactor: 1e6,
		iconColor: "#26A17B",
		badge: "BEP-20",
		minDepositUsd: 1,
	},
	{
		code: "usdc@bnb",
		name: "USDC (BEP-20)",
		symbol: "USDC",
		network: "BNB Smart Chain",
		decimals: 6,
		unitName: "micro-usdc",
		unitsFactor: 1e6,
		iconColor: "#2775CA",
		badge: "BEP-20",
		minDepositUsd: 1,
	},
	{
		code: "bch",
		name: "Bitcoin Cash",
		symbol: "BCH",
		network: "Bitcoin Cash",
		decimals: 8,
		unitName: "satoshi",
		unitsFactor: 1e8,
		iconColor: "#8DC351",
		badge: "Instant",
		minDepositUsd: 1,
	},
] as const;

export const FALLBACK_USD_RATES: Record<ApironeCurrencyCode, number> = {
	gram: 5.4,
	"usdt@ton": 1.0,
	"usdt@trx": 1.0,
	"usdc@trx": 1.0,
	btc: 88500.0,
	ltc: 92.5,
	doge: 0.24,
	trx: 0.21,
	eth: 3150.0,
	"usdt@eth": 1.0,
	"usdc@eth": 1.0,
	bnb: 625.0,
	"usdt@bnb": 1.0,
	"usdc@bnb": 1.0,
	bch: 440.0,
};

export interface CoinBundle {
	id: string;
	title: string;
	usdPrice: number;
	coins: number;
	bonusGems: number;
	tag?: string;
	popular?: boolean;
}

export const COIN_BUNDLES: readonly CoinBundle[] = [
	{
		id: "starter-pack",
		title: "Starter Chest",
		usdPrice: 1.99,
		coins: 2500,
		bonusGems: 25,
		tag: "+25% Bonus",
	},
	{
		id: "royal-champion",
		title: "Royal Champion Vault",
		usdPrice: 4.99,
		coins: 7500,
		bonusGems: 100,
		tag: "Most Popular",
		popular: true,
	},
	{
		id: "high-roller",
		title: "Grandmaster Treasury",
		usdPrice: 14.99,
		coins: 25000,
		bonusGems: 400,
		tag: "VIP Value",
	},
	{
		id: "whale-dynasty",
		title: "TON Whale Dynasty",
		usdPrice: 49.99,
		coins: 100000,
		bonusGems: 2000,
		tag: "Max Rewards",
	},
] as const;

export function getCurrencyMeta(code: ApironeCurrencyCode): ApironeCurrencyMeta {
	return (
		APIRONE_CURRENCIES.find((c) => c.code === code) ?? APIRONE_CURRENCIES[0]
	);
}

export function usdToCryptoUnits(
	usdAmount: number,
	currency: ApironeCurrencyCode,
	rateUsd: number,
): { units: number; formattedCrypto: string } {
	const meta = getCurrencyMeta(currency);
	const safeRate = rateUsd > 0 ? rateUsd : FALLBACK_USD_RATES[currency] || 1;
	const cryptoAmount = usdAmount / safeRate;
	const units = Math.max(1, Math.round(cryptoAmount * meta.unitsFactor));
	const displayDecimals = meta.decimals >= 8 ? 6 : 2;
	const formattedCrypto = (units / meta.unitsFactor).toFixed(displayDecimals);
	return { units, formattedCrypto };
}
