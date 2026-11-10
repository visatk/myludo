import { type Connection, type ConnectionContext, Server, type WSMessage } from "partyserver";
import {
	applyTokenMove,
	BOT_PROFILES,
	chooseBestBotMove,
	createInitialRoomState,
	createInitialTokens,
	fillEmptySeatsWithBots,
	getNextTurnColor,
	getSeatColorsForMaxPlayers,
	getValidTokenIndexes,
	PLAYER_COLORS,
} from "../shared/ludo-engine.ts";
import type {
	ClientToServerMessage,
	PlayerColor,
	PlayerSlot,
	RoomState,
	ServerToClientMessage,
} from "../shared/types.ts";
import type { MatchmakingCoordinator } from "./matchmaking-coordinator.ts";
import {
	type AuthenticatedUser,
	VERIFIED_IDENTITY_HEADER,
} from "./telegram-auth.ts";

interface ConnectionPlayerAttachment {
	playerId: string;
	playerName: string;
	color?: PlayerColor;
	verifiedUser?: AuthenticatedUser;
}

function cryptoRandomDice(): number {
	const arr = new Uint32Array(1);
	crypto.getRandomValues(arr);
	return (arr[0] % 6) + 1;
}

export class LudoRoom extends Server<Cloudflare.Env> {
	static options = {
		hibernate: true,
	};

	private state!: RoomState;

	override async onStart(): Promise<void> {
		this.sql`
			CREATE TABLE IF NOT EXISTS room_state (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				json TEXT NOT NULL,
				updated_at INTEGER NOT NULL
			)
		`;

		const rows = this.sql<{ json: string }>`
			SELECT json FROM room_state WHERE id = 1
		`;
		if (rows.length > 0 && rows[0].json) {
			try {
				this.state = JSON.parse(rows[0].json) as RoomState;
				return;
			} catch {
				// Re-initialize if corrupted
			}
		}

		const roomId = this.name || "room-royal";
		const roomCode = roomId.replace(/^room-/i, "").toUpperCase().slice(0, 6);
		this.state = createInitialRoomState({
			roomId,
			roomCode,
		});
		this.persistState();
	}

	private persistState(): void {
		const json = JSON.stringify(this.state);
		const now = Date.now();
		this.sql`
			INSERT INTO room_state (id, json, updated_at)
			VALUES (1, ${json}, ${now})
			ON CONFLICT(id) DO UPDATE SET json = ${json}, updated_at = ${now}
		`;
	}

	private sendTo(connection: Connection, msg: ServerToClientMessage): void {
		try {
			connection.send(JSON.stringify(msg));
		} catch {
			// Ignore closed socket
		}
	}

	private broadcastMessage(msg: ServerToClientMessage): void {
		this.broadcast(JSON.stringify(msg));
	}

	private broadcastState(): void {
		this.persistState();
		this.broadcastMessage({
			type: "ROOM_STATE",
			state: this.state,
		});
		void this.syncWithCoordinator();
	}

	private async syncWithCoordinator(): Promise<void> {
		try {
			const ns = this.env.MatchmakingCoordinator;
			const stub = ns.getByName("global") as unknown as MatchmakingCoordinator;
			const seatedPlayers = PLAYER_COLORS.map((c) => this.state.players[c]).filter(
				(p): p is PlayerSlot => p !== null,
			);
			const humanPlayers = seatedPlayers.filter((p) => !p.isBot);
			const botCount = seatedPlayers.filter((p) => p.isBot).length;
			const hostPlayer =
				seatedPlayers.find((p) => p.id === this.state.hostId) ??
				humanPlayers[0] ??
				seatedPlayers[0];

			await stub.upsertRoomSummary({
				roomId: this.state.roomId,
				roomCode: this.state.roomCode,
				name: this.state.name,
				mode: this.state.mode,
				maxPlayers: this.state.maxPlayers,
				currentPlayers: seatedPlayers.length,
				botCount,
				stakeCoins: this.state.stakeCoins,
				prizePoolCoins: this.state.prizePoolCoins,
				status: this.state.status,
				isPrivate: this.state.isPrivate,
				updatedAt: Date.now(),
				hostName: hostPlayer?.name ?? "Royal Host",
			});
		} catch {
			// Non-fatal
		}
	}

	private async scheduleNextActionAlarm(): Promise<void> {
		if (this.state.status !== "playing") {
			await this.ctx.storage.deleteAlarm();
			return;
		}
		const currentPlayer = this.state.players[this.state.turnColor];
		if (!currentPlayer) return;

		if (currentPlayer.isBot) {
			// Bots act briskly (650ms for rolling or 750ms for moving)
			const delay = this.state.turnPhase === "rolling" ? 650 : 750;
			await this.ctx.storage.setAlarm(Date.now() + delay);
		} else if (this.state.turnDeadlineAt) {
			await this.ctx.storage.setAlarm(this.state.turnDeadlineAt);
		}
	}

	override async onConnect(
		connection: Connection<ConnectionPlayerAttachment>,
		ctx: ConnectionContext,
	): Promise<void> {
		const identityHeader = ctx.request.headers.get(VERIFIED_IDENTITY_HEADER);
		if (identityHeader) {
			try {
				const verifiedUser = JSON.parse(identityHeader) as AuthenticatedUser;
				if (verifiedUser?.id) {
					const fullName = [verifiedUser.firstName, verifiedUser.lastName]
						.filter(Boolean)
						.join(" ");
					connection.setState({
						playerId: verifiedUser.id,
						playerName: fullName || verifiedUser.firstName || "Telegram Player",
						verifiedUser,
					});
				}
			} catch {
				// Ignore malformed header
			}
		}
		this.updateSpectatorCount();
		this.sendTo(connection, {
			type: "ROOM_STATE",
			state: this.state,
		});
	}

	override async onClose(
		connection: Connection<ConnectionPlayerAttachment>,
		_code: number,
		_reason: string,
		_wasClean: boolean,
	): Promise<void> {
		const meta = connection.state;
		if (meta?.playerId) {
			for (const color of PLAYER_COLORS) {
				const p = this.state.players[color];
				if (p && p.id === meta.playerId && !p.isBot) {
					p.isConnected = false;
				}
			}
		}
		this.updateSpectatorCount();
		this.broadcastState();
	}

	private updateSpectatorCount(): void {
		const connections = Array.from(this.getConnections());
		const seatedIds = new Set(
			PLAYER_COLORS.map((c) => this.state.players[c]?.id).filter(Boolean),
		);
		let spectators = 0;
		for (const conn of connections) {
			const st = conn.state as ConnectionPlayerAttachment | null;
			if (!st?.playerId || !seatedIds.has(st.playerId)) {
				spectators++;
			}
		}
		this.state.spectatorCount = spectators;
	}

	override async onMessage(
		connection: Connection<ConnectionPlayerAttachment>,
		message: WSMessage,
	): Promise<void> {
		if (typeof message !== "string") return;

		let payload: ClientToServerMessage;
		try {
			payload = JSON.parse(message) as ClientToServerMessage;
		} catch {
			this.sendTo(connection, {
				type: "ERROR",
				message: "Invalid JSON message",
			});
			return;
		}

		switch (payload.type) {
			case "PING": {
				this.sendTo(connection, { type: "PONG", serverTime: Date.now() });
				return;
			}

			case "JOIN_ROOM": {
				const { player: rawPlayer, preferredColor, roomConfig } = payload;
				const verified = connection.state?.verifiedUser;
				const player = verified?.isVerifiedInitData
					? {
							id: verified.id,
							telegramId: verified.telegramId,
							name:
								[verified.firstName, verified.lastName]
									.filter(Boolean)
									.join(" ") || verified.firstName,
							username: verified.username,
							avatarUrl: verified.photoUrl,
						}
					: {
							id: verified?.id || rawPlayer.id,
							telegramId: verified?.telegramId ?? rawPlayer.telegramId,
							name: (rawPlayer.name || verified?.firstName || "Royal Commander").slice(
								0,
								50,
							),
							username: rawPlayer.username ?? verified?.username,
							avatarUrl: rawPlayer.avatarUrl ?? verified?.photoUrl,
						};

				// Apply room config if waiting and no host yet
				if (this.state.status === "waiting" && !this.state.hostId && roomConfig) {
					if (roomConfig.name) this.state.name = roomConfig.name;
					if (roomConfig.mode) {
						this.state.mode = roomConfig.mode;
						this.state.targetTokensHome = roomConfig.mode === "blitz" ? 2 : 4;
						this.state.turnDurationMs =
							roomConfig.mode === "blitz" ? 15000 : 22000;
					}
					if (roomConfig.maxPlayers) {
						this.state.maxPlayers = roomConfig.maxPlayers;
					}
					if (typeof roomConfig.stakeCoins === "number") {
						this.state.stakeCoins = roomConfig.stakeCoins;
					}
					if (typeof roomConfig.isPrivate === "boolean") {
						this.state.isPrivate = roomConfig.isPrivate;
					}
					this.state.prizePoolCoins =
						this.state.stakeCoins * this.state.maxPlayers;
				}

				// Check if player is already seated (reconnecting)
				let assignedColor: PlayerColor | undefined;
				for (const color of PLAYER_COLORS) {
					const existing = this.state.players[color];
					if (existing && existing.id === player.id) {
						existing.isConnected = true;
						existing.name = player.name || existing.name;
						existing.username = player.username ?? existing.username;
						existing.avatarUrl = player.avatarUrl ?? existing.avatarUrl;
						assignedColor = color;
						break;
					}
				}

				// If not seated and game is waiting, assign an open seat
				if (!assignedColor && this.state.status === "waiting") {
					const allowedSeats = getSeatColorsForMaxPlayers(this.state.maxPlayers);
					if (
						preferredColor &&
						allowedSeats.includes(preferredColor) &&
						!this.state.players[preferredColor]
					) {
						assignedColor = preferredColor;
					} else {
						assignedColor = allowedSeats.find((c) => !this.state.players[c]);
					}

					if (assignedColor) {
						this.state.players[assignedColor] = {
							id: player.id,
							telegramId: player.telegramId,
							name: player.name,
							username: player.username,
							avatarUrl: player.avatarUrl,
							color: assignedColor,
							isBot: false,
							isConnected: true,
							isReady: true,
							tokensHome: 0,
							captures: 0,
							consecutiveSixes: 0,
							missedTurns: 0,
							finishRank: null,
						};
						if (!this.state.hostId) {
							this.state.hostId = player.id;
						}
					}
				}

				connection.setState({
					playerId: player.id,
					playerName: player.name,
					color: assignedColor,
					verifiedUser: verified,
				});
				this.updateSpectatorCount();
				this.broadcastState();
				return;
			}

			case "ADD_BOT": {
				if (this.state.status !== "waiting") return;
				const allowedSeats = getSeatColorsForMaxPlayers(this.state.maxPlayers);
				const targetColor =
					payload.color &&
					allowedSeats.includes(payload.color) &&
					!this.state.players[payload.color]
						? payload.color
						: allowedSeats.find((c) => !this.state.players[c]);

				if (!targetColor) return;
				const usedNames = new Set(
					PLAYER_COLORS.map((c) => this.state.players[c]?.name).filter(Boolean),
				);
				const profile =
					BOT_PROFILES.find((b) => !usedNames.has(b.name)) ?? BOT_PROFILES[0];

				this.state.players[targetColor] = {
					id: `bot-${targetColor}-${crypto.randomUUID().slice(0, 8)}`,
					name: profile.name,
					color: targetColor,
					isBot: true,
					botDifficulty: payload.difficulty ?? profile.difficulty,
					isConnected: true,
					isReady: true,
					tokensHome: 0,
					captures: 0,
					consecutiveSixes: 0,
					missedTurns: 0,
					finishRank: null,
				};
				this.broadcastState();
				return;
			}

			case "REMOVE_BOT": {
				if (this.state.status !== "waiting") return;
				const slot = this.state.players[payload.color];
				if (slot && slot.isBot) {
					this.state.players[payload.color] = null;
					this.broadcastState();
				}
				return;
			}

			case "TOGGLE_READY": {
				const meta = connection.state;
				if (!meta?.color) return;
				const slot = this.state.players[meta.color];
				if (slot && !slot.isBot) {
					slot.isReady = !slot.isReady;
					this.broadcastState();
				}
				return;
			}

			case "START_GAME": {
				if (this.state.status === "playing") return;

				if (payload.fillWithBots !== false) {
					fillEmptySeatsWithBots(this.state);
				}

				const seatedColors = PLAYER_COLORS.filter(
					(c) => this.state.players[c] !== null,
				);
				if (seatedColors.length < 2) {
					fillEmptySeatsWithBots(this.state);
				}

				const firstColor =
					PLAYER_COLORS.find((c) => this.state.players[c] !== null) ?? "red";
				this.state.status = "playing";
				this.state.startedAt = Date.now();
				this.state.finishedAt = null;
				this.state.turnColor = firstColor;
				this.state.turnPhase = "rolling";
				this.state.diceValue = null;
				this.state.validTokenIndexes = [];
				this.state.consecutiveSixes = 0;
				this.state.turnNumber = 1;
				this.state.winners = [];
				this.state.tokens = createInitialTokens();
				for (const c of PLAYER_COLORS) {
					if (this.state.players[c]) {
						this.state.players[c]!.tokensHome = 0;
						this.state.players[c]!.captures = 0;
						this.state.players[c]!.finishRank = null;
						this.state.players[c]!.consecutiveSixes = 0;
					}
				}
				this.state.turnDeadlineAt = Date.now() + this.state.turnDurationMs;
				this.state.chat.push({
					id: `sys-${Date.now()}`,
					senderId: "system",
					senderName: "Arena Referee",
					text: `Match started! ${this.state.players[firstColor]?.name ?? firstColor.toUpperCase()} rolls first.`,
					timestamp: Date.now(),
					isSystem: true,
				});

				this.broadcastState();
				await this.scheduleNextActionAlarm();
				return;
			}

			case "ROLL_DICE": {
				const meta = connection.state;
				if (this.state.status !== "playing") return;
				if (this.state.turnPhase !== "rolling") return;

				const currentPlayer = this.state.players[this.state.turnColor];
				if (!currentPlayer) return;
				if (!currentPlayer.isBot && meta?.playerId !== currentPlayer.id) {
					this.sendTo(connection, {
						type: "ERROR",
						message: "Wait for your turn to roll!",
					});
					return;
				}

				await this.performDiceRoll(this.state.turnColor);
				return;
			}

			case "MOVE_TOKEN": {
				const meta = connection.state;
				if (this.state.status !== "playing") return;
				if (this.state.turnPhase !== "moving") return;

				const currentPlayer = this.state.players[this.state.turnColor];
				if (!currentPlayer) return;
				if (!currentPlayer.isBot && meta?.playerId !== currentPlayer.id) {
					this.sendTo(connection, {
						type: "ERROR",
						message: "It is not your turn to move!",
					});
					return;
				}

				await this.performTokenMove(this.state.turnColor, payload.tokenIndex);
				return;
			}

			case "SEND_CHAT": {
				const meta = connection.state;
				const senderName = meta?.playerName || "Player";
				const senderColor = meta?.color;

				if (payload.emoji) {
					this.broadcastMessage({
						type: "EMOJI_BURST",
						senderId: meta?.playerId || "guest",
						senderName,
						senderColor,
						emoji: payload.emoji,
					});
				}

				if (payload.text && payload.text.trim()) {
					this.state.chat = [
						...this.state.chat.slice(-39),
						{
							id: `chat-${crypto.randomUUID().slice(0, 8)}`,
							senderId: meta?.playerId || "guest",
							senderName,
							senderColor,
							text: payload.text.trim().slice(0, 140),
							emoji: payload.emoji,
							timestamp: Date.now(),
						},
					];
					this.broadcastState();
				}
				return;
			}

			case "REMATCH": {
				this.state.status = "playing";
				this.state.startedAt = Date.now();
				this.state.finishedAt = null;
				this.state.tokens = createInitialTokens();
				this.state.winners = [];
				this.state.moveHistory = [];
				this.state.lastMove = null;
				this.state.diceValue = null;
				this.state.validTokenIndexes = [];
				this.state.consecutiveSixes = 0;
				this.state.turnNumber = 1;

				for (const c of PLAYER_COLORS) {
					if (this.state.players[c]) {
						this.state.players[c]!.tokensHome = 0;
						this.state.players[c]!.captures = 0;
						this.state.players[c]!.finishRank = null;
						this.state.players[c]!.consecutiveSixes = 0;
					}
				}

				const firstColor =
					PLAYER_COLORS.find((c) => this.state.players[c] !== null) ?? "red";
				this.state.turnColor = firstColor;
				this.state.turnPhase = "rolling";
				this.state.turnDeadlineAt = Date.now() + this.state.turnDurationMs;

				this.broadcastState();
				await this.scheduleNextActionAlarm();
				return;
			}

			case "LEAVE_SEAT": {
				const meta = connection.state;
				if (meta?.color && this.state.status === "waiting") {
					this.state.players[meta.color] = null;
					connection.setState({
						...meta,
						color: undefined,
					});
					this.broadcastState();
				}
				return;
			}
		}
	}

	private async performDiceRoll(color: PlayerColor): Promise<void> {
		const diceValue = cryptoRandomDice();
		const consecutiveSixes =
			diceValue === 6 ? this.state.consecutiveSixes + 1 : 0;

		// Tournament Three-Sixes Rule: rolling three 6s in a row forfeits the turn!
		if (consecutiveSixes >= 3) {
			this.state.diceValue = diceValue;
			this.state.consecutiveSixes = 0;
			this.state.validTokenIndexes = [];
			this.broadcastMessage({
				type: "DICE_ROLLED",
				color,
				diceValue,
				validTokenIndexes: [],
				consecutiveSixes: 3,
				forfeitedThreeSixes: true,
			});

			this.state.turnColor = getNextTurnColor(this.state, color);
			this.state.turnPhase = "rolling";
			this.state.diceValue = null;
			this.state.turnNumber += 1;
			this.state.turnDeadlineAt = Date.now() + this.state.turnDurationMs;
			this.broadcastState();
			await this.scheduleNextActionAlarm();
			return;
		}

		const validTokenIndexes = getValidTokenIndexes(
			this.state,
			color,
			diceValue,
		);
		this.state.diceValue = diceValue;
		this.state.consecutiveSixes = consecutiveSixes;
		this.state.validTokenIndexes = validTokenIndexes;

		this.broadcastMessage({
			type: "DICE_ROLLED",
			color,
			diceValue,
			validTokenIndexes,
			consecutiveSixes,
			forfeitedThreeSixes: false,
		});

		// If no legal moves exist, pass turn to the next player
		if (validTokenIndexes.length === 0) {
			this.state.turnColor = getNextTurnColor(this.state, color);
			this.state.turnPhase = "rolling";
			this.state.diceValue = null;
			this.state.validTokenIndexes = [];
			this.state.consecutiveSixes = 0;
			this.state.turnNumber += 1;
			this.state.turnDeadlineAt = Date.now() + this.state.turnDurationMs;
			this.broadcastState();
			await this.scheduleNextActionAlarm();
			return;
		}

		// If exactly 1 token can move AND all valid tokens are at the exact same step (e.g. exiting yard on a 6 when all tokens in yard, or only 1 token on board), auto-execute if bot or let human tap (or auto-move if only 1 token can move)
		this.state.turnPhase = "moving";
		this.state.turnDeadlineAt = Date.now() + this.state.turnDurationMs;
		this.broadcastState();
		await this.scheduleNextActionAlarm();
	}

	private async performTokenMove(
		color: PlayerColor,
		tokenIndex: number,
	): Promise<void> {
		try {
			const { state: nextState, move } = applyTokenMove(
				this.state,
				color,
				tokenIndex,
			);
			this.state = nextState;
			this.persistState();

			this.broadcastMessage({
				type: "TOKEN_MOVED",
				move,
				state: this.state,
			});

			if (this.state.status === "finished") {
				await this.reportFinishedMatch();
			}

			void this.syncWithCoordinator();
			await this.scheduleNextActionAlarm();
		} catch (err) {
			// Ignore invalid move race condition
			console.error("Token move error:", err);
		}
	}

	private async reportFinishedMatch(): Promise<void> {
		try {
			const winnerColor = this.state.winners[0];
			if (!winnerColor) return;
			const winnerPlayer = this.state.players[winnerColor];
			if (!winnerPlayer) return;

			const participantUserIds: string[] = [];
			const capturesByUserId: Record<string, number> = {};
			for (const c of PLAYER_COLORS) {
				const p = this.state.players[c];
				if (p) {
					participantUserIds.push(p.id);
					capturesByUserId[p.id] = p.captures;
				}
			}

			const ns = this.env.MatchmakingCoordinator;
			const stub = ns.getByName("global") as unknown as MatchmakingCoordinator;
			await stub.recordMatchResult({
				winnerUserId: winnerPlayer.id,
				participantUserIds,
				prizePoolCoins: this.state.prizePoolCoins,
				stakeCoins: this.state.stakeCoins,
				capturesByUserId,
			});
		} catch {
			// Non-fatal
		}
	}

	override async onAlarm(): Promise<void> {
		if (this.state.status !== "playing") return;
		const currentColor = this.state.turnColor;
		const currentPlayer = this.state.players[currentColor];
		if (!currentPlayer) return;

		if (this.state.turnPhase === "rolling") {
			await this.performDiceRoll(currentColor);
			return;
		}

		if (this.state.turnPhase === "moving") {
			const bestTokenIdx = chooseBestBotMove(this.state, currentColor);
			await this.performTokenMove(currentColor, bestTokenIdx);
		}
	}
}
