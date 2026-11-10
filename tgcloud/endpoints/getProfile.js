// Telegram Serverless Mini App Endpoint: getProfile
// Invoked via Telegram.WebApp.Serverless.call("getProfile", {}, cb)
import { env } from "sdk";
import {
	APIRONE_CURRENCIES,
	COIN_PACKS,
	getLobbySnapshotData,
	getOrCreateProfileFromUser,
} from "../lib/ludo.js";

export default async function (_input, ctx) {
	const profile = await getOrCreateProfileFromUser(ctx.user);
	const lobby = await getLobbySnapshotData();

	return {
		ok: true,
		authenticated: true,
		botUsername: env.TELEGRAM_BOT_USERNAME || "RoyalLudoArenaBot",
		profile,
		lobby,
		coinPacks: COIN_PACKS,
		currencies: APIRONE_CURRENCIES,
	};
}
