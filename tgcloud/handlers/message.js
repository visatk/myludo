// Telegram Serverless Update Handler: message
// Docs: https://core.telegram.org/bots/serverless#update-handlers
import { call } from "sdk/api";
import { db, eq, sql } from "sdk/db";
import {
	buildMiniAppKeyboard,
	DAILY_REWARD_COOLDOWN_MS,
	getLobbySnapshotData,
	getOrCreateProfileFromUser,
} from "../lib/ludo.js";
import { users } from "../schema.js";

export default async function (msg) {
	if (!msg.text || !msg.from) return;

	const chatId = msg.chat.id;
	const text = msg.text.trim();
	const profile = await getOrCreateProfileFromUser(msg.from);

	if (text.startsWith("/start")) {
		const parts = text.split(/\s+/);
		const startPayload = parts[1] || "";
		const isRoomInvite = startPayload.toLowerCase().startsWith("room-");
		const roomCode = isRoomInvite
			? startPayload.slice(5).toUpperCase()
			: null;

		const greeting = roomCode
			? `👑 <b>Royal Ludo Arena Invite!</b>\n\nYou have been invited to join table <code>#${roomCode}</code>.\nTap the button below to enter the arena immediately!`
			: `👑 <b>Welcome to Royal Ludo Arena, ${profile.firstName}!</b>\n\n` +
				`💰 <b>Balance:</b> ${profile.coins.toLocaleString()} Coins • 💎 ${profile.gems} Gems\n` +
				`⚔️ <b>Rating:</b> ${profile.rating} ELO (Lv.${profile.level})\n\n` +
				`Compete in Classic 4-Token, Blitz 2-Token Rush, or High-Roller 1,000-Coin matches with instant multiplayer & Apirone Crypto Treasury!`;

		await call("sendMessage", {
			chat_id: chatId,
			text: greeting,
			parse_mode: "HTML",
			reply_markup: buildMiniAppKeyboard(startPayload),
		});
		return;
	}

	if (text.startsWith("/play")) {
		await call("sendMessage", {
			chat_id: chatId,
			text: `🎲 <b>Ready to Roll, ${profile.firstName}?</b>\nTap below to launch Royal Ludo Arena in full-screen mode!`,
			parse_mode: "HTML",
			reply_markup: buildMiniAppKeyboard(),
		});
		return;
	}

	if (text.startsWith("/daily")) {
		const now = Date.now();
		const elapsed = now - (profile.lastDailyClaim || 0);
		if (profile.lastDailyClaim > 0 && elapsed < DAILY_REWARD_COOLDOWN_MS) {
			const hoursLeft = Math.ceil(
				(DAILY_REWARD_COOLDOWN_MS - elapsed) / (60 * 60 * 1000),
			);
			await call("sendMessage", {
				chat_id: chatId,
				text: `⏳ <b>Daily Chest Cooldown</b>\nYou already claimed today's reward! Come back in <b>${hoursLeft}h</b>.`,
				parse_mode: "HTML",
				reply_markup: buildMiniAppKeyboard(),
			});
			return;
		}

		await db
			.update(users)
			.set({
				coins: sql`${users.coins} + 500`,
				gems: sql`${users.gems} + 10`,
				lastDailyClaim: now,
				updatedAt: now,
			})
			.where(eq(users.id, profile.id));

		await call("sendMessage", {
			chat_id: chatId,
			text: `🎁 <b>Daily Chest Claimed!</b>\n+500 Gold Coins & +10 Gems added to your treasury!\nNew Balance: <b>${(profile.coins + 500).toLocaleString()} Coins</b>`,
			parse_mode: "HTML",
			reply_markup: buildMiniAppKeyboard(),
		});
		return;
	}

	if (text.startsWith("/leaderboard")) {
		const snapshot = await getLobbySnapshotData();
		const lines = snapshot.leaderboard.map(
			(p) =>
				`${p.rank}. <b>${p.name}</b> — ${p.rating} ELO (${p.gamesWon} Wins • ${p.coins.toLocaleString()} 🪙)`,
		);
		await call("sendMessage", {
			chat_id: chatId,
			text: `🏆 <b>Royal Ludo Arena • Top Commanders</b>\n\n${lines.join("\n") || "No matches recorded yet!"}`,
			parse_mode: "HTML",
			reply_markup: buildMiniAppKeyboard(),
		});
		return;
	}

	if (text.startsWith("/wallet")) {
		await call("sendMessage", {
			chat_id: chatId,
			text:
				`💎 <b>Apirone Crypto Treasury</b>\n\n` +
				`• <b>Coins:</b> ${profile.coins.toLocaleString()}\n` +
				`• <b>Gems:</b> ${profile.gems}\n` +
				`• <b>Supported Networks:</b> BTC, LTC, USDT (TRC-20), USDC (TRC-20)\n\n` +
				`Open the Mini App to generate instant QR deposit addresses!`,
			parse_mode: "HTML",
			reply_markup: buildMiniAppKeyboard(),
		});
	}
}
