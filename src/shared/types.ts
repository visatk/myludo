export type PlayerColor = "red" | "green" | "yellow" | "blue";

export type GameMode = "classic" | "blitz" | "high_roller";

export type RoomStatus = "waiting" | "playing" | "finished";

export type TurnPhase = "rolling" | "moving" | "animating" | "gameover";

export interface TokenState {
	id: string; // e.g. "red-0"
	color: PlayerColor;
	index: number; // 0..3
	/**
	 * -1 = In Home Yard
	 * 0..50 = Main outer 52-tile track (relative to color start offset)
	 * 51..55 = Colored Home Stretch lane
	 * 56 = Reached Center Home Triangle
	 */
	step: number;
	isSafe: boolean;
}

export interface PlayerSlot {
	id: string;
	telegramId?: number;
	name: string;
	username?: string;
	avatarUrl?: string;
	color: PlayerColor;
	isBot: boolean;
	botDifficulty?: "casual" | "tactical" | "grandmaster";
	isConnected: boolean;
	isReady: boolean;
	tokensHome: number;
	captures: number;
	consecutiveSixes: number;
	missedTurns: number;
	finishRank: number | null; // 1 = 1st, 2 = 2nd, etc.
	coinsBalance?: number;
}

export interface MoveRecord {
	id: string;
	timestamp: number;
	playerColor: PlayerColor;
	playerName: string;
	tokenIndex: number;
	diceValue: number;
	fromStep: number;
	toStep: number;
	pathCoords: Array<[number, number]>;
	capturedTokenId?: string;
	capturedPlayerColor?: PlayerColor;
	reachedHome: boolean;
	earnedBonusTurn: boolean;
	reason?: string;
}

export interface ChatMessage {
	id: string;
	senderId: string;
	senderName: string;
	senderColor?: PlayerColor;
	text: string;
	emoji?: string;
	timestamp: number;
	isSystem?: boolean;
}

export interface RoomState {
	roomId: string;
	roomCode: string;
	name: string;
	mode: GameMode;
	maxPlayers: 2 | 3 | 4;
	stakeCoins: number;
	prizePoolCoins: number;
	targetTokensHome: number; // 4 for classic, 2 for blitz
	status: RoomStatus;
	hostId: string;
	isPrivate: boolean;
	createdAt: number;
	startedAt: number | null;
	finishedAt: number | null;
	turnColor: PlayerColor;
	turnPhase: TurnPhase;
	diceValue: number | null;
	isRolling: boolean;
	consecutiveSixes: number;
	validTokenIndexes: number[];
	turnDeadlineAt: number | null;
	turnDurationMs: number;
	turnNumber: number;
	players: Record<PlayerColor, PlayerSlot | null>;
	tokens: Record<PlayerColor, TokenState[]>;
	lastMove: MoveRecord | null;
	moveHistory: MoveRecord[];
	chat: ChatMessage[];
	winners: PlayerColor[];
	spectatorCount: number;
}

export interface PublicRoomSummary {
	roomId: string;
	roomCode: string;
	name: string;
	mode: GameMode;
	maxPlayers: 2 | 3 | 4;
	currentPlayers: number;
	botCount: number;
	stakeCoins: number;
	prizePoolCoins: number;
	status: RoomStatus;
	isPrivate: boolean;
	updatedAt: number;
	hostName: string;
}

export interface TelegramUserProfile {
	id: string;
	telegramId: number;
	firstName: string;
	lastName?: string;
	username?: string;
	photoUrl?: string;
	languageCode?: string;
	isPremium?: boolean;
	allowsWriteToPm?: boolean;
	isVerifiedInitData: boolean;
	coins: number;
	gems: number;
	xp: number;
	level: number;
	gamesPlayed: number;
	gamesWon: number;
	totalCaptures: number;
	winStreak: number;
	rating: number;
	lastDailyClaim?: number;
}

// Apirone Supported Crypto Currencies per https://apirone.com/docs/currencies/index.md
export type ApironeCurrencyCode =
	| "btc"
	| "ltc"
	| "bch"
	| "doge"
	| "trx"
	| "usdt@trx"
	| "usdc@trx"
	| "eth"
	| "usdt@eth"
	| "usdc@eth"
	| "bnb"
	| "usdt@bnb"
	| "usdc@bnb"
	| "gram"
	| "usdt@ton";

export interface ApironeCurrencyMeta {
	code: ApironeCurrencyCode;
	name: string;
	symbol: string;
	network: string;
	decimals: number;
	unitName: string;
	unitsFactor: number;
	iconColor: string;
	badge: string;
	minDepositUsd: number;
}

export type ApironeInvoiceStatus =
	| "created"
	| "partpaid"
	| "paid"
	| "overpaid"
	| "completed"
	| "expired";

export interface ApironeInvoiceRecord {
	id: string;
	invoiceId: string;
	userId: string;
	account: string;
	currency: ApironeCurrencyCode;
	address: string;
	amountUnits: number;
	amountCrypto: string;
	amountUsd: number;
	coinsCredited: number;
	gemsCredited: number;
	status: ApironeInvoiceStatus;
	confirmations: number;
	txid?: string;
	createdAt: number;
	expiresAt: number;
	paymentUrl?: string;
}

export interface ApironeFeeOption {
	strategy: "normal" | "priority" | "custom";
	rate: number;
	estimatedUnits?: number;
}

// WebSocket Protocol Messages
export type ClientToServerMessage =
	| {
			type: "JOIN_ROOM";
			player: {
				id: string;
				telegramId?: number;
				name: string;
				username?: string;
				avatarUrl?: string;
			};
			preferredColor?: PlayerColor;
			roomConfig?: {
				name?: string;
				mode?: GameMode;
				maxPlayers?: 2 | 3 | 4;
				stakeCoins?: number;
				isPrivate?: boolean;
			};
	  }
	| { type: "ADD_BOT"; color?: PlayerColor; difficulty?: "casual" | "tactical" | "grandmaster" }
	| { type: "REMOVE_BOT"; color: PlayerColor }
	| { type: "TOGGLE_READY" }
	| { type: "START_GAME"; fillWithBots?: boolean }
	| { type: "ROLL_DICE" }
	| { type: "MOVE_TOKEN"; tokenIndex: number }
	| { type: "SEND_CHAT"; text?: string; emoji?: string }
	| { type: "REMATCH" }
	| { type: "LEAVE_SEAT" }
	| { type: "PING" };

export type ServerToClientMessage =
	| { type: "ROOM_STATE"; state: RoomState }
	| {
			type: "DICE_ROLLED";
			color: PlayerColor;
			diceValue: number;
			validTokenIndexes: number[];
			consecutiveSixes: number;
			forfeitedThreeSixes: boolean;
	  }
	| {
			type: "TOKEN_MOVED";
			move: MoveRecord;
			state: RoomState;
	  }
	| {
			type: "EMOJI_BURST";
			senderId: string;
			senderName: string;
			senderColor?: PlayerColor;
			emoji: string;
	  }
	| {
			type: "ERROR";
			message: string;
	  }
	| { type: "PONG"; serverTime: number };
