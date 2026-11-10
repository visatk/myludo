// Telegram Serverless Mini App Endpoint: listLobby
// Invoked via Telegram.WebApp.Serverless.call("listLobby", {}, cb)
import { getLobbySnapshotData } from "../lib/ludo.js";

export default async function () {
	const lobby = await getLobbySnapshotData();
	return {
		ok: true,
		...lobby,
	};
}
