import type {
	GameMode,
	MoveRecord,
	PlayerColor,
	PlayerSlot,
	RoomState,
	TokenState,
} from "./types.ts";

export const PLAYER_COLORS: readonly PlayerColor[] = [
	"red",
	"green",
	"yellow",
	"blue",
] as const;

/**
 * 52-tile outer track on a 15x15 Ludo board ([row, col] where row,col in 0..14).
 * Index 0 starts at Red's launch square [6, 1] and proceeds clockwise.
 */
export const MAIN_TRACK_COORDS: ReadonlyArray<readonly [number, number]> = [
	// Red bottom-left arm top row moving right (0..4)
	[6, 1],
	[6, 2],
	[6, 3],
	[6, 4],
	[6, 5],
	// Top-center arm left col moving up (5..10)
	[5, 6],
	[4, 6],
	[3, 6],
	[2, 6],
	[1, 6],
	[0, 6],
	// Top turn (11)
	[0, 7],
	// Top-center arm right col moving down (12..17)
	[0, 8],
	[1, 8],
	[2, 8],
	[3, 8],
	[4, 8],
	[5, 8],
	// Right arm top row moving right (18..23)
	[6, 9],
	[6, 10],
	[6, 11],
	[6, 12],
	[6, 13],
	[6, 14],
	// Right turn (24)
	[7, 14],
	// Right arm bottom row moving left (25..30)
	[8, 14],
	[8, 13],
	[8, 12],
	[8, 11],
	[8, 10],
	[8, 9],
	// Bottom-center arm right col moving down (31..36)
	[9, 8],
	[10, 8],
	[11, 8],
	[12, 8],
	[13, 8],
	[14, 8],
	// Bottom turn (37)
	[14, 7],
	// Bottom-center arm left col moving up (38..43)
	[14, 6],
	[13, 6],
	[12, 6],
	[11, 6],
	[10, 6],
	[9, 6],
	// Left arm bottom row moving left (44..49)
	[8, 5],
	[8, 4],
	[8, 3],
	[8, 2],
	[8, 1],
	[8, 0],
	// Left turn (50..51)
	[7, 0],
	[6, 0],
];

/**
 * Starting index on MAIN_TRACK_COORDS for each color when stepping out of the Yard (step = 0).
 */
export const COLOR_START_OFFSET: Record<PlayerColor, number> = {
	red: 0,
	green: 13,
	yellow: 26,
	blue: 39,
};

/**
 * 8 Star Safe Zones on the 52-tile outer track:
 * 4 colored start squares (0, 13, 26, 39) + 4 star squares (8, 21, 34, 47).
 */
export const SAFE_TRACK_INDICES = new Set<number>([
	0, 8, 13, 21, 26, 34, 39, 47,
]);

/**
 * Home stretch coordinates (steps 51..55) for each color leading to Center Home (step 56).
 */
export const HOME_STRETCH_COORDS: Record<
	PlayerColor,
	ReadonlyArray<readonly [number, number]>
> = {
	red: [
		[7, 1],
		[7, 2],
		[7, 3],
		[7, 4],
		[7, 5],
	],
	green: [
		[1, 7],
		[2, 7],
		[3, 7],
		[4, 7],
		[5, 7],
	],
	yellow: [
		[7, 13],
		[7, 12],
		[7, 11],
		[7, 10],
		[7, 9],
	],
	blue: [
		[13, 7],
		[12, 7],
		[11, 7],
		[10, 7],
		[9, 7],
	],
};

/**
 * Final Center Home Triangle slot (step 56) for each color.
 */
export const HOME_GOAL_COORD: Record<PlayerColor, readonly [number, number]> = {
	red: [7, 6],
	green: [6, 7],
	yellow: [7, 8],
	blue: [8, 7],
};

/**
 * Yard token rest positions (step -1) inside each 6x6 corner base for token index 0..3.
 */
export const YARD_TOKEN_COORDS: Record<
	PlayerColor,
	ReadonlyArray<readonly [number, number]>
> = {
	red: [
		[1.7, 1.7],
		[1.7, 3.3],
		[3.3, 1.7],
		[3.3, 3.3],
	],
	green: [
		[1.7, 10.7],
		[1.7, 12.3],
		[3.3, 10.7],
		[3.3, 12.3],
	],
	yellow: [
		[10.7, 10.7],
		[10.7, 12.3],
		[12.3, 10.7],
		[12.3, 12.3],
	],
	blue: [
		[10.7, 1.7],
		[10.7, 3.3],
		[12.3, 1.7],
		[12.3, 3.3],
	],
};

export const BOT_PROFILES = [
	{ name: "Viktor • Grandmaster", difficulty: "grandmaster" as const },
	{ name: "Anya • Blitz Queen", difficulty: "tactical" as const },
	{ name: "Satoshi • TON Whale", difficulty: "grandmaster" as const },
	{ name: "Zara • Lucky Six", difficulty: "casual" as const },
	{ name: "Leo • Royal Knight", difficulty: "tactical" as const },
	{ name: "Maya • Star Striker", difficulty: "tactical" as const },
];

/**
 * Converts a relative step (0..50) for a given color into the global 0..51 track index.
 * Returns null if the token is in the Yard (-1), Home Stretch (51..55), or Home Goal (56).
 */
export function getGlobalTrackIndex(
	color: PlayerColor,
	step: number,
): number | null {
	if (step < 0 || step > 50) return null;
	return (COLOR_START_OFFSET[color] + step) % 52;
}

/**
 * Returns whether a token at `step` for `color` is in a protected zone
 * (Yard, Safe Star Tile, Home Stretch, or Home Goal).
 */
export function isStepSafe(color: PlayerColor, step: number): boolean {
	if (step < 0 || step >= 51) return true;
	const globalIdx = getGlobalTrackIndex(color, step);
	return globalIdx !== null && SAFE_TRACK_INDICES.has(globalIdx);
}

/**
 * Returns the [row, col] board coordinate for any token state.
 */
export function getTokenBoardCoord(
	color: PlayerColor,
	tokenIndex: number,
	step: number,
): [number, number] {
	if (step < 0) {
		const yard = YARD_TOKEN_COORDS[color][tokenIndex] ?? YARD_TOKEN_COORDS[color][0];
		return [yard[0], yard[1]];
	}
	if (step <= 50) {
		const globalIdx = getGlobalTrackIndex(color, step)!;
		const c = MAIN_TRACK_COORDS[globalIdx];
		return [c[0], c[1]];
	}
	if (step <= 55) {
		const stretchIdx = step - 51;
		const c = HOME_STRETCH_COORDS[color][stretchIdx];
		return [c[0], c[1]];
	}
	const goal = HOME_GOAL_COORD[color];
	return [goal[0], goal[1]];
}

/**
 * Creates the initial 4 tokens for each color.
 */
export function createInitialTokens(): Record<PlayerColor, TokenState[]> {
	const result = {} as Record<PlayerColor, TokenState[]>;
	for (const color of PLAYER_COLORS) {
		result[color] = [0, 1, 2, 3].map((index) => ({
			id: `${color}-${index}`,
			color,
			index,
			step: -1,
			isSafe: true,
		}));
	}
	return result;
}

/**
 * Returns the active seating order depending on maxPlayers (for 2 players, opposite corners Red vs Yellow!).
 */
export function getSeatColorsForMaxPlayers(maxPlayers: 2 | 3 | 4): PlayerColor[] {
	if (maxPlayers === 2) return ["red", "yellow"];
	if (maxPlayers === 3) return ["red", "green", "yellow"];
	return ["red", "green", "yellow", "blue"];
}

/**
 * Creates a fresh RoomState.
 */
export function createInitialRoomState(params: {
	roomId: string;
	roomCode?: string;
	name?: string;
	mode?: GameMode;
	maxPlayers?: 2 | 3 | 4;
	stakeCoins?: number;
	isPrivate?: boolean;
}): RoomState {
	const mode = params.mode ?? "classic";
	const maxPlayers = params.maxPlayers ?? 4;
	const stakeCoins =
		params.stakeCoins ??
		(mode === "high_roller" ? 1000 : mode === "blitz" ? 250 : 100);

	return {
		roomId: params.roomId,
		roomCode: params.roomCode ?? params.roomId.toUpperCase().slice(0, 6),
		name: params.name ?? "Royal Ludo Table",
		mode,
		maxPlayers,
		stakeCoins,
		prizePoolCoins: stakeCoins * maxPlayers,
		targetTokensHome: mode === "blitz" ? 2 : 4,
		status: "waiting",
		hostId: "",
		isPrivate: params.isPrivate ?? false,
		createdAt: Date.now(),
		startedAt: null,
		finishedAt: null,
		turnColor: "red",
		turnPhase: "rolling",
		diceValue: null,
		isRolling: false,
		consecutiveSixes: 0,
		validTokenIndexes: [],
		turnDeadlineAt: null,
		turnDurationMs: mode === "blitz" ? 15000 : 22000,
		turnNumber: 1,
		players: {
			red: null,
			green: null,
			yellow: null,
			blue: null,
		},
		tokens: createInitialTokens(),
		lastMove: null,
		moveHistory: [],
		chat: [],
		winners: [],
		spectatorCount: 0,
	};
}

/**
 * Computes which token indexes (0..3) of `color` have a legal move for `diceValue`.
 */
export function getValidTokenIndexes(
	state: RoomState,
	color: PlayerColor,
	diceValue: number,
): number[] {
	const tokens = state.tokens[color];
	if (!tokens) return [];

	const valid: number[] = [];
	for (const token of tokens) {
		if (token.step === 56) continue; // Already home
		if (token.step === -1) {
			// Can only exit yard on a 6
			if (diceValue === 6) {
				valid.push(token.index);
			}
		} else {
			// Needs exact roll to reach step 56
			if (token.step + diceValue <= 56) {
				valid.push(token.index);
			}
		}
	}
	return valid;
}

/**
 * Finds the next active player color in clockwise order who hasn't finished yet.
 */
export function getNextTurnColor(
	state: RoomState,
	currentColor: PlayerColor,
): PlayerColor {
	const idx = PLAYER_COLORS.indexOf(currentColor);
	for (let offset = 1; offset <= 4; offset++) {
		const candidate = PLAYER_COLORS[(idx + offset) % 4];
		const player = state.players[candidate];
		if (player && player.finishRank === null) {
			return candidate;
		}
	}
	return currentColor;
}

/**
 * Executes a token move on a cloned RoomState and returns the updated RoomState and MoveRecord.
 */
export function applyTokenMove(
	prevState: RoomState,
	color: PlayerColor,
	tokenIndex: number,
): { state: RoomState; move: MoveRecord } {
	const state = structuredClone(prevState);
	const diceValue = state.diceValue;
	if (!diceValue) {
		throw new Error("Dice has not been rolled yet");
	}
	const validIndexes = getValidTokenIndexes(state, color, diceValue);
	if (!validIndexes.includes(tokenIndex)) {
		throw new Error("Selected token cannot legally move with current dice roll");
	}

	const token = state.tokens[color][tokenIndex];
	const player = state.players[color];
	const fromStep = token.step;
	const toStep = fromStep === -1 ? 0 : fromStep + diceValue;

	// Build step-by-step coordinate path for smooth client animation
	const pathCoords: Array<[number, number]> = [];
	if (fromStep === -1) {
		pathCoords.push(getTokenBoardCoord(color, tokenIndex, 0));
	} else {
		for (let s = fromStep + 1; s <= toStep; s++) {
			pathCoords.push(getTokenBoardCoord(color, tokenIndex, s));
		}
	}

	token.step = toStep;
	token.isSafe = isStepSafe(color, toStep);

	let capturedTokenId: string | undefined;
	let capturedPlayerColor: PlayerColor | undefined;

	// Check for captures on main outer track (0..50) if not a safe tile
	const targetGlobalIdx = getGlobalTrackIndex(color, toStep);
	if (targetGlobalIdx !== null && !SAFE_TRACK_INDICES.has(targetGlobalIdx)) {
		// Group opponent tokens on this global track square by color:
		// If an opponent has a stack (2+ tokens of same color), they form a safe block!
		// Single opponent tokens on a non-safe square are captured and sent back to Yard (-1).
		const groupedByColor = new Map<PlayerColor, TokenState[]>();
		for (const otherColor of PLAYER_COLORS) {
			if (otherColor === color) continue;
			for (const otherToken of state.tokens[otherColor]) {
				const otherGlobalIdx = getGlobalTrackIndex(otherColor, otherToken.step);
				if (otherGlobalIdx === targetGlobalIdx) {
					const list = groupedByColor.get(otherColor) ?? [];
					list.push(otherToken);
					groupedByColor.set(otherColor, list);
				}
			}
		}

		for (const [oppColor, oppTokens] of groupedByColor.entries()) {
			if (oppTokens.length === 1) {
				const victim = oppTokens[0];
				victim.step = -1;
				victim.isSafe = true;
				capturedTokenId = victim.id;
				capturedPlayerColor = oppColor;
				if (player) {
					player.captures += 1;
				}
				break; // Capture one token per landing
			}
		}
	}

	const reachedHome = toStep === 56;
	if (player) {
		player.tokensHome = state.tokens[color].filter((t) => t.step === 56).length;
		if (
			player.tokensHome >= state.targetTokensHome &&
			player.finishRank === null
		) {
			state.winners.push(color);
			player.finishRank = state.winners.length;
		}
	}

	// Check if the game is finished (all but 1 active player finished, or 1st winner in 2-player / blitz)
	const activeRemaining = PLAYER_COLORS.filter((c) => {
		const p = state.players[c];
		return p !== null && p.finishRank === null;
	});

	if (state.winners.length > 0 && (activeRemaining.length <= 1 || state.mode === "blitz")) {
		// Assign remaining rank if 1 player left
		if (activeRemaining.length === 1) {
			const lastColor = activeRemaining[0];
			if (!state.winners.includes(lastColor)) {
				state.winners.push(lastColor);
				if (state.players[lastColor]) {
					state.players[lastColor]!.finishRank = state.winners.length;
				}
			}
		}
		state.status = "finished";
		state.turnPhase = "gameover";
		state.finishedAt = Date.now();
		state.turnDeadlineAt = null;
	}

	// Bonus turn awarded if:
	// - Player hasn't already finished the game AND
	// - (Rolled a 6 OR captured an opponent token OR brought a token into Home Goal 56)
	const playerStillPlaying = player?.finishRank === null && state.status === "playing";
	const earnedBonusTurn =
		Boolean(playerStillPlaying) &&
		(diceValue === 6 || Boolean(capturedTokenId) || reachedHome);

	const move: MoveRecord = {
		id: `${state.turnNumber}-${color}-${Date.now()}`,
		timestamp: Date.now(),
		playerColor: color,
		playerName: player?.name ?? color.toUpperCase(),
		tokenIndex,
		diceValue,
		fromStep,
		toStep,
		pathCoords,
		capturedTokenId,
		capturedPlayerColor,
		reachedHome,
		earnedBonusTurn,
	};

	state.lastMove = move;
	state.moveHistory = [...state.moveHistory.slice(-29), move];
	state.diceValue = null;
	state.validTokenIndexes = [];

	if (state.status === "playing") {
		if (earnedBonusTurn) {
			state.turnPhase = "rolling";
			state.turnDeadlineAt = Date.now() + state.turnDurationMs;
		} else {
			state.consecutiveSixes = 0;
			state.turnColor = getNextTurnColor(state, color);
			state.turnPhase = "rolling";
			state.turnNumber += 1;
			state.turnDeadlineAt = Date.now() + state.turnDurationMs;
		}
	}

	return { state, move };
}

/**
 * Cryptographically unbiased float in [0, 1) using Web Crypto API.
 */
function cryptoRandomFloat(): number {
	const arr = new Uint32Array(1);
	crypto.getRandomValues(arr);
	return arr[0] / 0x100000000;
}

export function chooseBestBotMove(
	state: RoomState,
	color: PlayerColor,
): number {
	const diceValue = state.diceValue;
	if (!diceValue) return 0;
	const valid = getValidTokenIndexes(state, color, diceValue);
	if (valid.length <= 1) return valid[0] ?? 0;

	const player = state.players[color];
	const difficulty = player?.botDifficulty ?? "tactical";

	if (difficulty === "casual" && cryptoRandomFloat() < 0.35) {
		const idx = Math.floor(cryptoRandomFloat() * valid.length);
		return valid[idx] ?? valid[0];
	}

	// Score each candidate token move
	const scored = valid.map((tokenIdx) => {
		const token = state.tokens[color][tokenIdx];
		const fromStep = token.step;
		const toStep = fromStep === -1 ? 0 : fromStep + diceValue;
		let score = 0;

		// 1. Entering Home Goal (56) is massive priority
		if (toStep === 56) {
			score += 120;
		}

		// 2. Capturing an opponent token on a non-safe square is top priority
		const targetGlobalIdx = getGlobalTrackIndex(color, toStep);
		if (targetGlobalIdx !== null && !SAFE_TRACK_INDICES.has(targetGlobalIdx)) {
			for (const oppColor of PLAYER_COLORS) {
				if (oppColor === color) continue;
				const oppAtTarget = state.tokens[oppColor].filter(
					(t) => getGlobalTrackIndex(oppColor, t.step) === targetGlobalIdx,
				);
				if (oppAtTarget.length === 1) {
					// Extra reward if the opponent token was far along its path!
					score += 140 + oppAtTarget[0].step;
				}
			}
		}

		// 3. Deploying a token out of the Yard on a 6
		if (fromStep === -1 && toStep === 0) {
			score += 85;
		}

		// 4. Moving into Safe Home Stretch (51..55) or landing on a Star Safe Zone
		if (toStep >= 51 && toStep <= 55) {
			score += 65;
		} else if (isStepSafe(color, toStep)) {
			score += 50;
		}

		// 5. Escaping danger if currently on an unsafe square with an opponent 1..6 tiles behind
		const currentGlobalIdx = getGlobalTrackIndex(color, fromStep);
		if (currentGlobalIdx !== null && !SAFE_TRACK_INDICES.has(currentGlobalIdx)) {
			for (const oppColor of PLAYER_COLORS) {
				if (oppColor === color) continue;
				for (const oppToken of state.tokens[oppColor]) {
					const oppGlobal = getGlobalTrackIndex(oppColor, oppToken.step);
					if (oppGlobal !== null) {
						const distBehind = (currentGlobalIdx - oppGlobal + 52) % 52;
						if (distBehind >= 1 && distBehind <= 6) {
							score += 45;
						}
					}
				}
			}
		}

		// 6. Penalize leaving a safe star tile to land right in front of an opponent
		if (fromStep >= 0 && isStepSafe(color, fromStep) && !isStepSafe(color, toStep)) {
			score -= 20;
		}

		// 7. Prefer advancing the furthest-ahead token slightly
		score += Math.min(Math.max(fromStep, 0), 50) * 0.4;

		return { tokenIdx, score };
	});

	scored.sort((a, b) => b.score - a.score);
	return scored[0].tokenIdx;
}

/**
 * Helper to populate empty seats for a room with bots.
 */
export function fillEmptySeatsWithBots(state: RoomState): void {
	const seats = getSeatColorsForMaxPlayers(state.maxPlayers);
	let botCounter = 0;
	for (const color of seats) {
		if (!state.players[color]) {
			const profile = BOT_PROFILES[botCounter % BOT_PROFILES.length];
			botCounter++;
			const botSlot: PlayerSlot = {
				id: `bot-${color}-${crypto.randomUUID().slice(0, 8)}`,
				name: profile.name,
				color,
				isBot: true,
				botDifficulty: profile.difficulty,
				isConnected: true,
				isReady: true,
				tokensHome: 0,
				captures: 0,
				consecutiveSixes: 0,
				missedTurns: 0,
				finishRank: null,
			};
			state.players[color] = botSlot;
		}
	}
}
