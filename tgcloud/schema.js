// Telegram Serverless Database Schema (sdk/db)
// Docs: https://core.telegram.org/bots/serverless#sdk-db
// Note: Foreign keys are not supported in Telegram Serverless SQLite; index all query columns.
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "sdk/db";

export const users = sqliteTable(
	"users",
	{
		id: text("id").primaryKey(),
		username: text("username").notNull().default("commander"),
		firstName: text("first_name").notNull().default("Commander"),
		lastName: text("last_name"),
		photoUrl: text("photo_url"),
		isPremium: integer("is_premium").notNull().default(0),
		coins: integer("coins").notNull().default(2500),
		gems: integer("gems").notNull().default(50),
		xp: integer("xp").notNull().default(100),
		level: integer("level").notNull().default(1),
		rating: integer("rating").notNull().default(1200),
		gamesPlayed: integer("games_played").notNull().default(0),
		gamesWon: integer("games_won").notNull().default(0),
		winStreak: integer("win_streak").notNull().default(0),
		tokensCaptured: integer("tokens_captured").notNull().default(0),
		lastDailyClaim: integer("last_daily_claim").notNull().default(0),
		createdAt: integer("created_at").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
	(t) => [
		index("users_rating_idx").on(t.rating),
		index("users_games_won_idx").on(t.gamesWon),
	],
);

export const rooms = sqliteTable(
	"rooms",
	{
		roomId: text("room_id").primaryKey(),
		roomCode: text("room_code").notNull(),
		name: text("name").notNull(),
		mode: text("mode").notNull().default("classic"),
		status: text("status").notNull().default("waiting"),
		stakeCoins: integer("stake_coins").notNull().default(100),
		prizePoolCoins: integer("prize_pool_coins").notNull().default(400),
		playerCount: integer("player_count").notNull().default(1),
		maxPlayers: integer("max_players").notNull().default(4),
		isPrivate: integer("is_private").notNull().default(0),
		updatedAt: integer("updated_at").notNull(),
	},
	(t) => [
		uniqueIndex("rooms_code_idx").on(t.roomCode),
		index("rooms_lobby_idx").on(t.isPrivate, t.status, t.updatedAt),
	],
);

export const invoices = sqliteTable(
	"invoices",
	{
		invoiceId: text("invoice_id").primaryKey(),
		userId: text("user_id").notNull(),
		packId: text("pack_id").notNull(),
		currency: text("currency").notNull(),
		address: text("address").notNull(),
		amountCrypto: text("amount_crypto").notNull(),
		amountUnits: integer("amount_units").notNull(),
		amountUsd: integer("amount_usd_cents").notNull(),
		coinsCredited: integer("coins_credited").notNull(),
		gemsCredited: integer("gems_credited").notNull(),
		status: text("status").notNull().default("created"),
		paymentUri: text("payment_uri").notNull(),
		txid: text("txid"),
		createdAt: integer("created_at").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
	(t) => [
		index("invoices_user_created_idx").on(t.userId, t.createdAt),
		index("invoices_status_idx").on(t.status),
	],
);
