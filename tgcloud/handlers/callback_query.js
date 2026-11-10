// Telegram Serverless Update Handler: callback_query
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

export default async function (query) {
	const data = query.data || "";
	const chatId = query.message?.chat?.id;
	if (!chatId || !query.from) {
		await call("answerCallbackQuery", { callback_query_id: query.id });
		return;
	}

	const profile = await getOrCreateProfileFromUser(query.from);

	if (data === "claim_daily") {
		const now = Date.now();
		const elapsed = now - (profile.lastDailyClaim || 0);
		if (profile.lastDailyClaim > 0 && elapsed < DAILY_REWARD_COOLDOWN_MS) {
			const hoursLeft = Math.ceil(
				(DAILY_REWARD_COOLDOWN_MS - elapsed) / (60 * 60 * 1000),
			);
			await call("answerCallbackQuery", {
				callback_query_id: query.id,
				text: `⏳ Daily reward already claimed! Try again in ${hoursLeft}h.`,
				show_alert: true,
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

		await call("answerCallbackQuery", {
			callback_query_id: query.id,
			text: "🎁 +500 Gold Coins & +10 Gems claimed!",
			show_alert: true,
		});
		return;
	}

	if (data === "show_leaderboard") {
		await call("answerCallbackQuery", { callback_query_id: query.id });
		const snapshot = await getLobbySnapshotData();
		const lines = snapshot.leaderboard.map(
			(p) =>
				`${p.rank}. <b>${p.name}</b> — ${p.rating} ELO (${p.gamesWon} Wins)`,
		);
		await call("sendMessage", {
			chat_id: chatId,
			text: `🏆 <b>Royal Ludo Arena • Top 10 Leaderboard</b>\n\n${lines.join("\n")}`,
			parse_mode: "HTML",
			reply_markup: buildMiniAppKeyboard(),
		});
		return;
	}

	await call("answerCallbackQuery", { callback_query_id: query.id });
}
