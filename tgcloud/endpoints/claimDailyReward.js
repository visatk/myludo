// Telegram Serverless Mini App Endpoint: claimDailyReward
// Invoked via Telegram.WebApp.Serverless.call("claimDailyReward", {}, cb)
import { EndpointError } from "sdk";
import { db, eq, sql } from "sdk/db";
import {
	DAILY_REWARD_COOLDOWN_MS,
	getOrCreateProfileFromUser,
	mapUserRow,
} from "../lib/ludo.js";
import { users } from "../schema.js";

export default async function (_input, ctx) {
	const profile = await getOrCreateProfileFromUser(ctx.user);
	const now = Date.now();
	const elapsed = now - (profile.lastDailyClaim || 0);

	if (profile.lastDailyClaim > 0 && elapsed < DAILY_REWARD_COOLDOWN_MS) {
		const hoursLeft = Math.ceil(
			(DAILY_REWARD_COOLDOWN_MS - elapsed) / (60 * 60 * 1000),
		);
		throw new EndpointError(
			`DAILY_COOLDOWN: Daily chest already claimed! Next reward in ~${hoursLeft}h.`,
		);
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

	const updated = await db
		.select()
		.from(users)
		.where(eq(users.id, profile.id))
		.get();

	return {
		ok: true,
		profile: mapUserRow(updated),
		rewardCoins: 500,
		rewardGems: 10,
	};
}
