import { DurableObject } from "cloudflare:workers";
import type {
	ApironeCurrencyCode,
	ApironeInvoiceRecord,
	ApironeInvoiceStatus,
	GameMode,
	PublicRoomSummary,
	TelegramUserProfile,
} from "../shared/types.ts";

function generateRoomCode(): string {
	const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
	const bytes = new Uint8Array(6);
	crypto.getRandomValues(bytes);
	let code = "";
	for (const b of bytes) {
		code += alphabet[b % alphabet.length];
	}
	return code;
}

const DAILY_REWARD_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export class MatchmakingCoordinator extends DurableObject<Cloudflare.Env> {
	constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
		super(ctx, env);
		ctx.blockConcurrencyWhile(async () => {
			this.initSchema();
		});
	}

	private initSchema(): void {
		const sql = this.ctx.storage.sql;

		sql.exec(`
			CREATE TABLE IF NOT EXISTS users (
				id TEXT PRIMARY KEY,
				telegram_id INTEGER NOT NULL,
				first_name TEXT NOT NULL,
				last_name TEXT,
				username TEXT,
				photo_url TEXT,
				language_code TEXT DEFAULT 'en',
				is_premium INTEGER DEFAULT 0,
				allows_write_to_pm INTEGER DEFAULT 0,
				is_verified INTEGER DEFAULT 0,
				coins INTEGER DEFAULT 2500,
				gems INTEGER DEFAULT 50,
				xp INTEGER DEFAULT 100,
				level INTEGER DEFAULT 1,
				games_played INTEGER DEFAULT 0,
				games_won INTEGER DEFAULT 0,
				total_captures INTEGER DEFAULT 0,
				win_streak INTEGER DEFAULT 0,
				rating INTEGER DEFAULT 1200,
				last_daily_claim INTEGER DEFAULT 0,
				updated_at INTEGER NOT NULL
			);

			CREATE TABLE IF NOT EXISTS rooms (
				room_id TEXT PRIMARY KEY,
				room_code TEXT NOT NULL,
				name TEXT NOT NULL,
				mode TEXT NOT NULL,
				max_players INTEGER NOT NULL,
				current_players INTEGER NOT NULL,
				bot_count INTEGER NOT NULL,
				stake_coins INTEGER NOT NULL,
				prize_pool_coins INTEGER NOT NULL,
				status TEXT NOT NULL,
				is_private INTEGER DEFAULT 0,
				host_name TEXT NOT NULL,
				updated_at INTEGER NOT NULL
			);

			CREATE TABLE IF NOT EXISTS invoices (
				id TEXT PRIMARY KEY,
				invoice_id TEXT UNIQUE NOT NULL,
				user_id TEXT NOT NULL,
				account TEXT NOT NULL,
				currency TEXT NOT NULL,
				address TEXT NOT NULL,
				amount_units INTEGER NOT NULL,
				amount_crypto TEXT NOT NULL,
				amount_usd REAL NOT NULL,
				coins_credited INTEGER NOT NULL,
				gems_credited INTEGER NOT NULL,
				status TEXT NOT NULL,
				confirmations INTEGER DEFAULT 0,
				txid TEXT,
				payment_url TEXT,
				credited INTEGER DEFAULT 0,
				created_at INTEGER NOT NULL,
				expires_at INTEGER NOT NULL
			);
		`);

		// Additive migration for existing local databases created before allows_write_to_pm
		try {
			sql.exec(
				"ALTER TABLE users ADD COLUMN allows_write_to_pm INTEGER DEFAULT 0",
			);
		} catch {
			// Column already exists
		}

		// Seed initial grandmaster leaderboard if empty
		const countRow = sql
			.exec<{ cnt: number }>("SELECT COUNT(*) as cnt FROM users")
			.toArray()[0];
		if (!countRow || countRow.cnt === 0) {
			const now = Date.now();
			const seeds = [
				{
					id: "tg-seed-101",
					tgId: 900101,
					name: "Pavel • TON King",
					username: "pavel_ludo",
					coins: 148500,
					gems: 1850,
					xp: 14200,
					level: 28,
					played: 164,
					won: 118,
					captures: 342,
					streak: 9,
					rating: 2140,
				},
				{
					id: "tg-seed-102",
					tgId: 900102,
					name: "Elena • Star Empress",
					username: "elena_stars",
					coins: 92400,
					gems: 940,
					xp: 9800,
					level: 21,
					played: 120,
					won: 84,
					captures: 265,
					streak: 5,
					rating: 1965,
				},
				{
					id: "tg-seed-103",
					tgId: 900103,
					name: "Tariq • Royal Dice",
					username: "tariq_sixes",
					coins: 68200,
					gems: 610,
					xp: 7400,
					level: 17,
					played: 95,
					won: 61,
					captures: 198,
					streak: 4,
					rating: 1820,
				},
				{
					id: "tg-seed-104",
					tgId: 900104,
					name: "Kenji • Blitz Samurai",
					username: "kenji_blitz",
					coins: 51900,
					gems: 420,
					xp: 5600,
					level: 14,
					played: 78,
					won: 47,
					captures: 154,
					streak: 3,
					rating: 1710,
				},
				{
					id: "tg-seed-105",
					tgId: 900105,
					name: "Sofia • Lucky Emerald",
					username: "sofia_tma",
					coins: 34500,
					gems: 310,
					xp: 4100,
					level: 11,
					played: 54,
					won: 32,
					captures: 112,
					streak: 2,
					rating: 1590,
				},
			];
			for (const s of seeds) {
				sql.exec(
					`INSERT INTO users (
						id, telegram_id, first_name, username, is_premium, is_verified,
						coins, gems, xp, level, games_played, games_won, total_captures, win_streak, rating, updated_at
					) VALUES (?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					s.id,
					s.tgId,
					s.name,
					s.username,
					s.coins,
					s.gems,
					s.xp,
					s.level,
					s.played,
					s.won,
					s.captures,
					s.streak,
					s.rating,
					now,
				);
			}
		}
	}

	private mapUserRow(row: Record<string, unknown>): TelegramUserProfile {
		return {
			id: String(row.id),
			telegramId: Number(row.telegram_id),
			firstName: String(row.first_name),
			lastName: row.last_name ? String(row.last_name) : undefined,
			username: row.username ? String(row.username) : undefined,
			photoUrl: row.photo_url ? String(row.photo_url) : undefined,
			languageCode: row.language_code ? String(row.language_code) : "en",
			isPremium: Boolean(row.is_premium),
			allowsWriteToPm: Boolean(row.allows_write_to_pm),
			isVerifiedInitData: Boolean(row.is_verified),
			coins: Number(row.coins),
			gems: Number(row.gems),
			xp: Number(row.xp),
			level: Number(row.level),
			gamesPlayed: Number(row.games_played),
			gamesWon: Number(row.games_won),
			totalCaptures: Number(row.total_captures),
			winStreak: Number(row.win_streak),
			rating: Number(row.rating),
			lastDailyClaim: Number(row.last_daily_claim ?? 0),
		};
	}

	async upsertUser(userInput: {
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
	}): Promise<TelegramUserProfile> {
		const sql = this.ctx.storage.sql;
		const now = Date.now();

		const existing = sql
			.exec<Record<string, SqlStorageValue>>(
				"SELECT * FROM users WHERE id = ?",
				userInput.id,
			)
			.toArray()[0];

		if (existing) {
			sql.exec(
				`UPDATE users SET
					first_name = ?,
					last_name = ?,
					username = ?,
					photo_url = ?,
					is_premium = ?,
					allows_write_to_pm = ?,
					is_verified = ?,
					updated_at = ?
				WHERE id = ?`,
				userInput.firstName,
				userInput.lastName ?? null,
				userInput.username ?? null,
				userInput.photoUrl ?? null,
				userInput.isPremium ? 1 : 0,
				userInput.allowsWriteToPm ? 1 : 0,
				userInput.isVerifiedInitData ? 1 : 0,
				now,
				userInput.id,
			);
		} else {
			sql.exec(
				`INSERT INTO users (
					id, telegram_id, first_name, last_name, username, photo_url,
					language_code, is_premium, allows_write_to_pm, is_verified, coins, gems, xp, level,
					games_played, games_won, total_captures, win_streak, rating, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 3000, 60, 100, 1, 0, 0, 0, 0, 1200, ?)`,
				userInput.id,
				userInput.telegramId,
				userInput.firstName,
				userInput.lastName ?? null,
				userInput.username ?? null,
				userInput.photoUrl ?? null,
				userInput.languageCode ?? "en",
				userInput.isPremium ? 1 : 0,
				userInput.allowsWriteToPm ? 1 : 0,
				userInput.isVerifiedInitData ? 1 : 0,
				now,
			);
		}

		const row = sql
			.exec<Record<string, SqlStorageValue>>(
				"SELECT * FROM users WHERE id = ?",
				userInput.id,
			)
			.toArray()[0];
		return this.mapUserRow(row);
	}

	async claimDailyReward(userId: string): Promise<{
		claimed: boolean;
		rewardCoins: number;
		rewardGems: number;
		nextClaimAt?: number;
		profile: TelegramUserProfile | null;
	}> {
		const sql = this.ctx.storage.sql;
		const row = sql
			.exec<Record<string, SqlStorageValue>>("SELECT * FROM users WHERE id = ?", userId)
			.toArray()[0];
		if (!row) {
			return { claimed: false, rewardCoins: 0, rewardGems: 0, profile: null };
		}

		const now = Date.now();
		const lastClaim = Number(row.last_daily_claim ?? 0);
		if (lastClaim > 0 && now - lastClaim < DAILY_REWARD_COOLDOWN_MS) {
			return {
				claimed: false,
				rewardCoins: 0,
				rewardGems: 0,
				nextClaimAt: lastClaim + DAILY_REWARD_COOLDOWN_MS,
				profile: this.mapUserRow(row),
			};
		}

		const rewardCoins = 500;
		const rewardGems = 15;
		sql.exec(
			`UPDATE users
			 SET coins = coins + ?, gems = gems + ?, xp = xp + 50, last_daily_claim = ?, updated_at = ?
			 WHERE id = ?`,
			rewardCoins,
			rewardGems,
			now,
			now,
			userId,
		);
		const updated = sql
			.exec<Record<string, SqlStorageValue>>("SELECT * FROM users WHERE id = ?", userId)
			.toArray()[0];
		return {
			claimed: true,
			rewardCoins,
			rewardGems,
			nextClaimAt: now + DAILY_REWARD_COOLDOWN_MS,
			profile: this.mapUserRow(updated),
		};
	}

	async getLeaderboard(limit = 20): Promise<TelegramUserProfile[]> {
		const rows = this.ctx.storage.sql
			.exec<Record<string, SqlStorageValue>>(
				"SELECT * FROM users ORDER BY rating DESC, coins DESC LIMIT ?",
				limit,
			)
			.toArray();
		return rows.map((r) => this.mapUserRow(r));
	}

	async upsertRoomSummary(summary: PublicRoomSummary): Promise<void> {
		const sql = this.ctx.storage.sql;
		// Prune stale rooms older than 2 hours
		const cutoff = Date.now() - 2 * 3600 * 1000;
		sql.exec("DELETE FROM rooms WHERE updated_at < ?", cutoff);

		if (summary.currentPlayers === 0 && summary.status === "waiting") {
			sql.exec("DELETE FROM rooms WHERE room_id = ?", summary.roomId);
			return;
		}

		sql.exec(
			`INSERT INTO rooms (
				room_id, room_code, name, mode, max_players, current_players,
				bot_count, stake_coins, prize_pool_coins, status, is_private, host_name, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(room_id) DO UPDATE SET
				name = excluded.name,
				mode = excluded.mode,
				max_players = excluded.max_players,
				current_players = excluded.current_players,
				bot_count = excluded.bot_count,
				stake_coins = excluded.stake_coins,
				prize_pool_coins = excluded.prize_pool_coins,
				status = excluded.status,
				is_private = excluded.is_private,
				host_name = excluded.host_name,
				updated_at = excluded.updated_at`,
			summary.roomId,
			summary.roomCode,
			summary.name,
			summary.mode,
			summary.maxPlayers,
			summary.currentPlayers,
			summary.botCount,
			summary.stakeCoins,
			summary.prizePoolCoins,
			summary.status,
			summary.isPrivate ? 1 : 0,
			summary.hostName,
			Date.now(),
		);
	}

	async listPublicRooms(): Promise<PublicRoomSummary[]> {
		const cutoff = Date.now() - 30 * 60 * 1000;
		const rows = this.ctx.storage.sql
			.exec<Record<string, SqlStorageValue>>(
				`SELECT * FROM rooms
				 WHERE is_private = 0 AND status != 'finished' AND updated_at >= ?
				 ORDER BY status ASC, updated_at DESC LIMIT 25`,
				cutoff,
			)
			.toArray();

		return rows.map((r) => ({
			roomId: String(r.room_id),
			roomCode: String(r.room_code),
			name: String(r.name),
			mode: String(r.mode) as GameMode,
			maxPlayers: Number(r.max_players) as 2 | 3 | 4,
			currentPlayers: Number(r.current_players),
			botCount: Number(r.bot_count),
			stakeCoins: Number(r.stake_coins),
			prizePoolCoins: Number(r.prize_pool_coins),
			status: String(r.status) as "waiting" | "playing" | "finished",
			isPrivate: Boolean(r.is_private),
			updatedAt: Number(r.updated_at),
			hostName: String(r.host_name),
		}));
	}

	async findOrCreateMatchmakingRoom(params: {
		mode: GameMode;
		maxPlayers: 2 | 3 | 4;
		hostName: string;
	}): Promise<{ roomId: string; roomCode: string; created: boolean }> {
		const sql = this.ctx.storage.sql;
		const cutoff = Date.now() - 10 * 60 * 1000;

		const openRoom = sql
			.exec<Record<string, SqlStorageValue>>(
				`SELECT * FROM rooms
				 WHERE is_private = 0
				   AND status = 'waiting'
				   AND mode = ?
				   AND max_players = ?
				   AND current_players < max_players
				   AND updated_at >= ?
				 ORDER BY current_players DESC, updated_at DESC
				 LIMIT 1`,
				params.mode,
				params.maxPlayers,
				cutoff,
			)
			.toArray()[0];

		if (openRoom) {
			return {
				roomId: String(openRoom.room_id),
				roomCode: String(openRoom.room_code),
				created: false,
			};
		}

		const code = generateRoomCode();
		const roomId = `room-${code.toLowerCase()}`;
		const stakeCoins =
			params.mode === "high_roller"
				? 1000
				: params.mode === "blitz"
					? 250
					: 100;

		await this.upsertRoomSummary({
			roomId,
			roomCode: code,
			name: `${params.hostName}'s ${params.mode.toUpperCase()} Arena`,
			mode: params.mode,
			maxPlayers: params.maxPlayers,
			currentPlayers: 1,
			botCount: 0,
			stakeCoins,
			prizePoolCoins: stakeCoins * params.maxPlayers,
			status: "waiting",
			isPrivate: false,
			updatedAt: Date.now(),
			hostName: params.hostName,
		});

		return { roomId, roomCode: code, created: true };
	}

	async recordMatchResult(params: {
		winnerUserId: string;
		participantUserIds: string[];
		prizePoolCoins: number;
		stakeCoins: number;
		capturesByUserId: Record<string, number>;
	}): Promise<void> {
		const sql = this.ctx.storage.sql;
		const now = Date.now();

		for (const uid of params.participantUserIds) {
			if (uid.startsWith("bot-")) continue;
			const isWinner = uid === params.winnerUserId;
			const captures = params.capturesByUserId[uid] ?? 0;
			const coinDelta = isWinner
				? params.prizePoolCoins - params.stakeCoins
				: -params.stakeCoins;
			const xpDelta = (isWinner ? 150 : 40) + captures * 20;
			const ratingDelta = isWinner ? 28 : -12;

			sql.exec(
				`UPDATE users SET
					coins = MAX(100, coins + ?),
					xp = xp + ?,
					level = MAX(1, CAST((xp + ?) / 500 AS INTEGER) + 1),
					games_played = games_played + 1,
					games_won = games_won + ?,
					total_captures = total_captures + ?,
					win_streak = CASE WHEN ? = 1 THEN win_streak + 1 ELSE 0 END,
					rating = MAX(800, rating + ?),
					updated_at = ?
				WHERE id = ?`,
				coinDelta,
				xpDelta,
				xpDelta,
				isWinner ? 1 : 0,
				captures,
				isWinner ? 1 : 0,
				ratingDelta,
				now,
				uid,
			);
		}
	}

	async saveInvoice(invoice: ApironeInvoiceRecord): Promise<void> {
		this.ctx.storage.sql.exec(
			`INSERT INTO invoices (
				id, invoice_id, user_id, account, currency, address,
				amount_units, amount_crypto, amount_usd, coins_credited, gems_credited,
				status, confirmations, txid, payment_url, credited, created_at, expires_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
			invoice.id,
			invoice.invoiceId,
			invoice.userId,
			invoice.account,
			invoice.currency,
			invoice.address,
			invoice.amountUnits,
			invoice.amountCrypto,
			invoice.amountUsd,
			invoice.coinsCredited,
			invoice.gemsCredited,
			invoice.status,
			invoice.confirmations,
			invoice.txid ?? null,
			invoice.paymentUrl ?? null,
			invoice.createdAt,
			invoice.expiresAt,
		);
	}

	async getUserInvoices(userId: string): Promise<ApironeInvoiceRecord[]> {
		const rows = this.ctx.storage.sql
			.exec<Record<string, SqlStorageValue>>(
				"SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
				userId,
			)
			.toArray();

		return rows.map((r) => ({
			id: String(r.id),
			invoiceId: String(r.invoice_id),
			userId: String(r.user_id),
			account: String(r.account),
			currency: String(r.currency) as ApironeCurrencyCode,
			address: String(r.address),
			amountUnits: Number(r.amount_units),
			amountCrypto: String(r.amount_crypto),
			amountUsd: Number(r.amount_usd),
			coinsCredited: Number(r.coins_credited),
			gemsCredited: Number(r.gems_credited),
			status: String(r.status) as ApironeInvoiceStatus,
			confirmations: Number(r.confirmations),
			txid: r.txid ? String(r.txid) : undefined,
			paymentUrl: r.payment_url ? String(r.payment_url) : undefined,
			createdAt: Number(r.created_at),
			expiresAt: Number(r.expires_at),
		}));
	}

	/**
	 * Processes an Apirone callback or simulated payment confirmation atomically.
	 * Credits the user's Coins & Gems once status is 'paid', 'overpaid', or 'completed' (or confirmations >= 1).
	 * If expectedUserId is provided, verifies that the invoice belongs to that user.
	 */
	async processApironeCallback(payload: {
		invoice?: string;
		input_address?: string;
		status?: ApironeInvoiceStatus;
		confirmations?: number;
		txid?: string;
		expectedUserId?: string;
	}): Promise<{
		matched: boolean;
		creditedNow: boolean;
		invoice?: ApironeInvoiceRecord;
		profile?: TelegramUserProfile;
	}> {
		const sql = this.ctx.storage.sql;

		let row: Record<string, unknown> | undefined;
		if (payload.invoice) {
			row = sql
				.exec<Record<string, SqlStorageValue>>(
					"SELECT * FROM invoices WHERE invoice_id = ? OR id = ?",
					payload.invoice,
					payload.invoice,
				)
				.toArray()[0];
		}
		if (!row && payload.input_address) {
			row = sql
				.exec<Record<string, SqlStorageValue>>(
					"SELECT * FROM invoices WHERE address = ? ORDER BY created_at DESC LIMIT 1",
					payload.input_address,
				)
				.toArray()[0];
		}

		if (!row) {
			return { matched: false, creditedNow: false };
		}

		if (
			payload.expectedUserId &&
			String(row.user_id) !== payload.expectedUserId
		) {
			return { matched: false, creditedNow: false };
		}

		const confirmations =
			payload.confirmations ?? Math.max(1, Number(row.confirmations));
		const newStatus: ApironeInvoiceStatus =
			payload.status ?? (confirmations >= 1 ? "completed" : "paid");
		const txid =
			payload.txid ??
			(row.txid ? String(row.txid) : `0x${Date.now().toString(16)}apirone`);

		const shouldCredit =
			Number(row.credited) === 0 &&
			(newStatus === "paid" ||
				newStatus === "overpaid" ||
				newStatus === "completed" ||
				confirmations >= 1);

		sql.exec(
			`UPDATE invoices SET
				status = ?,
				confirmations = ?,
				txid = ?,
				credited = CASE WHEN ? = 1 THEN 1 ELSE credited END
			WHERE id = ?`,
			newStatus,
			confirmations,
			txid,
			shouldCredit ? 1 : 0,
			row.id,
		);

		if (shouldCredit) {
			sql.exec(
				`UPDATE users SET
					coins = coins + ?,
					gems = gems + ?,
					xp = xp + 250,
					updated_at = ?
				WHERE id = ?`,
				Number(row.coins_credited),
				Number(row.gems_credited),
				Date.now(),
				String(row.user_id),
			);
		}

		const updatedInvoiceRow = sql
			.exec<Record<string, SqlStorageValue>>(
				"SELECT * FROM invoices WHERE id = ?",
				row.id,
			)
			.toArray()[0];
		const userRow = sql
			.exec<Record<string, SqlStorageValue>>(
				"SELECT * FROM users WHERE id = ?",
				String(row.user_id),
			)
			.toArray()[0];

		const updatedInvoice: ApironeInvoiceRecord = {
			id: String(updatedInvoiceRow.id),
			invoiceId: String(updatedInvoiceRow.invoice_id),
			userId: String(updatedInvoiceRow.user_id),
			account: String(updatedInvoiceRow.account),
			currency: String(updatedInvoiceRow.currency) as ApironeCurrencyCode,
			address: String(updatedInvoiceRow.address),
			amountUnits: Number(updatedInvoiceRow.amount_units),
			amountCrypto: String(updatedInvoiceRow.amount_crypto),
			amountUsd: Number(updatedInvoiceRow.amount_usd),
			coinsCredited: Number(updatedInvoiceRow.coins_credited),
			gemsCredited: Number(updatedInvoiceRow.gems_credited),
			status: String(updatedInvoiceRow.status) as ApironeInvoiceStatus,
			confirmations: Number(updatedInvoiceRow.confirmations),
			txid: updatedInvoiceRow.txid ? String(updatedInvoiceRow.txid) : undefined,
			paymentUrl: updatedInvoiceRow.payment_url
				? String(updatedInvoiceRow.payment_url)
				: undefined,
			createdAt: Number(updatedInvoiceRow.created_at),
			expiresAt: Number(updatedInvoiceRow.expires_at),
		};

		return {
			matched: true,
			creditedNow: shouldCredit,
			invoice: updatedInvoice,
			profile: userRow ? this.mapUserRow(userRow) : undefined,
		};
	}
}
