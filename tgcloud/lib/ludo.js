// Shared helpers for Royal Ludo Arena on Telegram Serverless (tgcloud)
import { env } from "sdk";
import { db, desc, eq, sql } from "sdk/db";
import { rooms, users } from "../schema.js";

export const DAILY_REWARD_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const COIN_PACKS = [
	{
		id: "pack_starter",
		title: "Squire Pouch",
		badge: "Popular",
		coins: 5000,
		bonusGems: 25,
		priceUsd: 1.99,
	},
	{
		id: "pack_knight",
		title: "Royal Knight Chest",
		badge: "+20% Bonus",
		coins: 15000,
		bonusGems: 90,
		priceUsd: 4.99,
	},
	{
		id: "pack_monarch",
		title: "Monarch Vault",
		badge: "Best Value",
		coins: 40000,
		bonusGems: 250,
		priceUsd: 9.99,
	},
	{
		id: "pack_emperor",
		title: "Grand Emperor Treasury",
		badge: "VIP Whale",
		coins: 120000,
		bonusGems: 800,
		priceUsd: 24.99,
	},
];

export const APIRONE_CURRENCIES = [
	{
		code: "btc",
		symbol: "BTC",
		name: "Bitcoin",
		network: "Bitcoin Mainnet",
		decimals: 8,
		fallbackRateUsd: 88000,
	},
	{
		code: "ltc",
		symbol: "LTC",
		name: "Litecoin",
		network: "Litecoin Mainnet",
		decimals: 8,
		fallbackRateUsd: 95,
	},
	{
		code: "usdt@trx",
		symbol: "USDT (TRC-20)",
		name: "Tether USD",
		network: "TRON (TRC-20)",
		decimals: 6,
		fallbackRateUsd: 1,
	},
	{
		code: "usdc@trx",
		symbol: "USDC (TRC-20)",
		name: "USD Coin",
		network: "TRON (TRC-20)",
		decimals: 6,
		fallbackRateUsd: 1,
	},
];

export function generateRoomCode(length = 6) {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	const randomBytes = new Uint32Array(length);
	crypto.getRandomValues(randomBytes);
	let code = "";
	for (let i = 0; i < length; i++) {
		code += chars[randomBytes[i] % chars.length];
	}
	return code;
}

export function mapUserRow(row) {
	return {
		id: String(row.id),
		username: String(row.username || "commander"),
		firstName: String(row.firstName || "Commander"),
		lastName: row.lastName ? String(row.lastName) : undefined,
		photoUrl: row.photoUrl ? String(row.photoUrl) : undefined,
		isPremium: Boolean(row.isPremium),
		coins: Number(row.coins ?? 2500),
		gems: Number(row.gems ?? 50),
		xp: Number(row.xp ?? 100),
		level: Number(row.level ?? 1),
		rating: Number(row.rating ?? 1200),
		gamesPlayed: Number(row.gamesPlayed ?? 0),
		gamesWon: Number(row.gamesWon ?? 0),
		winStreak: Number(row.winStreak ?? 0),
		tokensCaptured: Number(row.tokensCaptured ?? 0),
		lastDailyClaim: Number(row.lastDailyClaim ?? 0),
	};
}

export async function getOrCreateProfileFromUser(tgUser) {
	const userId = `tg-${tgUser.id}`;
	const now = Date.now();
	const username = tgUser.username || `user_${tgUser.id}`;
	const firstName = tgUser.first_name || "Royal Player";
	const lastName = tgUser.last_name || null;
	const photoUrl = tgUser.photo_url || null;
	const isPremium = tgUser.is_premium ? 1 : 0;

	await db
		.insert(users)
		.values({
			id: userId,
			username,
			firstName,
			lastName,
			photoUrl,
			isPremium,
			coins: 3000,
			gems: 60,
			xp: 100,
			level: 1,
			rating: 1200,
			gamesPlayed: 0,
			gamesWon: 0,
			winStreak: 0,
			tokensCaptured: 0,
			lastDailyClaim: 0,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: users.id,
			set: {
				username,
				firstName,
				lastName,
				photoUrl: sql`COALESCE(${photoUrl}, ${users.photoUrl})`,
				isPremium,
				updatedAt: now,
			},
		});

	const row = await db.select().from(users).where(eq(users.id, userId)).get();
	return mapUserRow(row);
}

export async function getLobbySnapshotData() {
	const cutoff = Date.now() - 1000 * 60 * 30;
	const activeRooms = await db
		.select()
		.from(rooms)
		.where(eq(rooms.isPrivate, 0))
		.orderBy(desc(rooms.updatedAt))
		.limit(20)
		.all();

	const filteredRooms = activeRooms
		.filter((r) => r.status !== "finished" && r.updatedAt > cutoff)
		.map((r) => ({
			roomId: String(r.roomId),
			roomCode: String(r.roomCode),
			name: String(r.name),
			mode: String(r.mode),
			status: String(r.status),
			stakeCoins: Number(r.stakeCoins),
			prizePoolCoins: Number(r.prizePoolCoins),
			playerCount: Number(r.playerCount),
			maxPlayers: Number(r.maxPlayers),
			isPrivate: Boolean(r.isPrivate),
		}));

	const topUsers = await db
		.select()
		.from(users)
		.orderBy(desc(users.rating), desc(users.gamesWon))
		.limit(10)
		.all();

	const leaderboard = topUsers.map((r, idx) => ({
		rank: idx + 1,
		id: String(r.id),
		name: String(r.firstName || r.username),
		rating: Number(r.rating),
		gamesWon: Number(r.gamesWon),
		coins: Number(r.coins),
	}));

	return {
		rooms: filteredRooms,
		leaderboard,
		onlinePlayers: Math.max(12, filteredRooms.length * 3 + 8),
	};
}

export function buildMiniAppKeyboard(startParam = "") {
	const baseUrl = env.STATIC_URL || "https://t.me";
	const url = startParam
		? `${baseUrl}?tgWebAppStartParam=${encodeURIComponent(startParam)}`
		: baseUrl;

	return {
		inline_keyboard: [
			[
				{
					text: "🎲 Play Royal Ludo Arena",
					web_app: { url },
				},
			],
			[
				{
					text: "🎁 Claim Daily +500 Coins",
					callback_data: "claim_daily",
				},
				{
					text: "🏆 Top 10 Leaderboard",
					callback_data: "show_leaderboard",
				},
			],
		],
	};
}
