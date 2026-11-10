// Telegram Serverless Mini App Endpoint: matchmaking
// Invoked via Telegram.WebApp.Serverless.call("matchmaking", input, cb)
import { EndpointError } from "sdk";
import { and, db, desc, eq, lt } from "sdk/db";
import { generateRoomCode } from "../lib/ludo.js";
import { rooms } from "../schema.js";

export default async function (input = {}) {
	const mode = input.mode || "classic";
	const maxPlayers = input.maxPlayers || 4;
	const createPrivate = Boolean(input.createPrivate);
	const now = Date.now();

	// Join by explicit roomCode if provided
	if (input.roomCode && typeof input.roomCode === "string") {
		const code = input.roomCode.trim().toUpperCase();
		const found = await db
			.select()
			.from(rooms)
			.where(eq(rooms.roomCode, code))
			.get();

		if (!found) {
			throw new EndpointError(`ROOM_NOT_FOUND: No room found with code ${code}`);
		}
		return {
			ok: true,
			roomId: String(found.roomId),
			roomCode: String(found.roomCode),
			mode: String(found.mode),
			maxPlayers: Number(found.maxPlayers),
		};
	}

	// Quick-match into an existing open public waiting table
	if (!createPrivate) {
		const openRoom = await db
			.select()
			.from(rooms)
			.where(
				and(
					eq(rooms.isPrivate, 0),
					eq(rooms.status, "waiting"),
					eq(rooms.mode, mode),
					eq(rooms.maxPlayers, maxPlayers),
					lt(rooms.playerCount, rooms.maxPlayers),
				),
			)
			.orderBy(desc(rooms.updatedAt))
			.get();

		if (openRoom && openRoom.updatedAt > now - 1000 * 60 * 15) {
			return {
				ok: true,
				roomId: String(openRoom.roomId),
				roomCode: String(openRoom.roomCode),
				mode: String(openRoom.mode),
				maxPlayers: Number(openRoom.maxPlayers),
			};
		}
	}

	// Otherwise create a fresh room
	const roomCode = generateRoomCode();
	const roomId = `ludo-${roomCode.toLowerCase()}`;
	const stakeCoins =
		mode === "high_roller" ? 1000 : mode === "blitz" ? 250 : 100;
	const roomName =
		input.roomName ||
		(mode === "high_roller"
			? "VIP Crown Table"
			: mode === "blitz"
				? "Blitz Rush Table"
				: "Royal Classic Table");

	await db.insert(rooms).values({
		roomId,
		roomCode,
		name: roomName,
		mode,
		status: "waiting",
		stakeCoins,
		prizePoolCoins: stakeCoins * maxPlayers,
		playerCount: 1,
		maxPlayers,
		isPrivate: createPrivate ? 1 : 0,
		updatedAt: now,
	});

	return {
		ok: true,
		roomId,
		roomCode,
		mode,
		maxPlayers,
	};
}
