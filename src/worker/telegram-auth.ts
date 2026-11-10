/**
 * Telegram Mini App init data validation.
 *
 * Implements both validation schemes from
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * 1. `hash`      – HMAC-SHA-256 with a secret derived from the bot token
 *                  (first-party backend; this is what the Worker uses).
 * 2. `signature` – Ed25519 signature verifiable with Telegram's public key and
 *                  only the bot id (third-party validation, no bot token needed).
 *
 * Never trust `Telegram.WebApp.initDataUnsafe` on the server: only the raw
 * `Telegram.WebApp.initData` query string, after it passes one of these checks.
 */

/** WebAppUser as sent by Telegram (snake_case, see WebAppUser in the docs). */
export interface WebAppUser {
	id: number;
	is_bot?: boolean;
	first_name: string;
	last_name?: string;
	username?: string;
	language_code?: string;
	is_premium?: true;
	added_to_attachment_menu?: true;
	allows_write_to_pm?: true;
	photo_url?: string;
}

/** WebAppChat as sent by Telegram. */
export interface WebAppChat {
	id: number;
	type: "group" | "supergroup" | "channel";
	title: string;
	username?: string;
	photo_url?: string;
}

/** Parsed WebAppInitData (only populated after successful validation). */
export interface WebAppInitData {
	query_id?: string;
	chat_join_request_query_id?: string;
	user?: WebAppUser;
	receiver?: WebAppUser;
	chat?: WebAppChat;
	chat_type?: "sender" | "private" | "group" | "supergroup" | "channel";
	chat_instance?: string;
	start_param?: string;
	can_send_after?: number;
	auth_date: number;
	hash: string;
	signature?: string;
}

export type InitDataFailureReason =
	| "MISSING"
	| "MALFORMED"
	| "NOT_CONFIGURED"
	| "INVALID_HASH"
	| "INVALID_SIGNATURE"
	| "EXPIRED"
	| "NO_USER";

export type InitDataValidationResult =
	| { ok: true; data: WebAppInitData; method: "hash" | "signature" }
	| { ok: false; reason: InitDataFailureReason };

export interface ValidateInitDataOptions {
	/** Bot API token. Enables first-party `hash` validation (preferred). */
	botToken?: string;
	/** Numeric bot id. Enables third-party Ed25519 `signature` validation. */
	botId?: string | number;
	/** Use Telegram's test-environment Ed25519 key. */
	testEnvironment?: boolean;
	/**
	 * Reject init data whose `auth_date` is older than this many seconds.
	 * Telegram recommends checking `auth_date` to prevent replay of old data.
	 * Defaults to 24 hours, matching a typical Mini App session.
	 */
	maxAgeSeconds?: number;
	/** Override "now" (unix seconds) for testing. */
	nowSeconds?: number;
}

/** Ed25519 public keys published by Telegram for third-party validation. */
export const TELEGRAM_ED25519_PUBLIC_KEYS = {
	production:
		"e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d",
	test: "40055058a4ee38156a06562e52eece92a771bcd8346a8c4615cb7376eddf72ec",
} as const;

const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60;
/** Allow small client/server clock skew for `auth_date` in the future. */
const MAX_FUTURE_SKEW_SECONDS = 60;
const encoder = new TextEncoder();

/** Returns true when a bot token looks like a real Bot API token. */
export function isConfiguredBotToken(token: string | undefined): token is string {
	return typeof token === "string" && /^\d+:[\w-]{30,}$/.test(token.trim());
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
	if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) return null;
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) {
		out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return out;
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> | null {
	try {
		const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
		const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
		const bin = atob(padded);
		const out = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
		return out;
	} catch {
		return null;
	}
}

async function hmacSha256(
	key: BufferSource,
	message: BufferSource,
): Promise<ArrayBuffer> {
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		key,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	return crypto.subtle.sign("HMAC", cryptoKey, message);
}

/**
 * Constant-time comparison of two byte sequences. Both inputs are hashed to a
 * fixed size first so that a length mismatch does not leak through timing.
 */
export async function timingSafeEqualBytes(
	a: BufferSource,
	b: BufferSource,
): Promise<boolean> {
	const [ha, hb] = await Promise.all([
		crypto.subtle.digest("SHA-256", a),
		crypto.subtle.digest("SHA-256", b),
	]);
	const subtle = crypto.subtle as SubtleCrypto & {
		timingSafeEqual?: (left: ArrayBuffer, right: ArrayBuffer) => boolean;
	};
	if (typeof subtle.timingSafeEqual === "function") {
		return subtle.timingSafeEqual(ha, hb);
	}
	const va = new Uint8Array(ha);
	const vb = new Uint8Array(hb);
	if (va.byteLength !== vb.byteLength) return false;
	let diff = 0;
	for (let i = 0; i < va.byteLength; i++) {
		diff |= va[i] ^ vb[i];
	}
	return diff === 0;
}

/** Constant-time string comparison for secrets (API keys, webhook secrets). */
export function timingSafeEqualStrings(a: string, b: string): Promise<boolean> {
	return timingSafeEqualBytes(encoder.encode(a), encoder.encode(b));
}

/** Build the alphabetically sorted `key=value\n…` data-check-string. */
function buildDataCheckString(
	params: URLSearchParams,
	exclude: ReadonlySet<string>,
): string {
	const pairs: string[] = [];
	for (const [key, value] of params) {
		if (!exclude.has(key)) pairs.push(`${key}=${value}`);
	}
	pairs.sort();
	return pairs.join("\n");
}

function parseInitData(params: URLSearchParams): WebAppInitData | null {
	const authDate = Number(params.get("auth_date"));
	const hash = params.get("hash");
	if (!Number.isFinite(authDate) || authDate <= 0 || !hash) return null;

	const data: WebAppInitData = { auth_date: authDate, hash };
	for (const [key, value] of params) {
		switch (key) {
			case "user":
			case "receiver":
			case "chat":
				// Complex types are JSON-serialized objects.
				(data as unknown as Record<string, unknown>)[key] = JSON.parse(value);
				break;
			case "can_send_after":
				data.can_send_after = Number(value);
				break;
			case "auth_date":
			case "hash":
				break;
			default:
				(data as unknown as Record<string, unknown>)[key] = value;
		}
	}
	return data;
}

async function verifyHash(
	params: URLSearchParams,
	receivedHash: string,
	botToken: string,
): Promise<boolean> {
	const received = hexToBytes(receivedHash);
	if (!received) return false;
	// secret_key = HMAC_SHA256(<bot_token>, "WebAppData")  (key = "WebAppData")
	const secretKey = await hmacSha256(
		encoder.encode("WebAppData"),
		encoder.encode(botToken.trim()),
	);
	// hash = hex(HMAC_SHA256(data_check_string, secret_key)); all fields but `hash`.
	const dataCheckString = buildDataCheckString(params, new Set(["hash"]));
	const computed = await hmacSha256(secretKey, encoder.encode(dataCheckString));
	return timingSafeEqualBytes(computed, received);
}

async function verifySignature(
	params: URLSearchParams,
	signature: string,
	botId: string | number,
	testEnvironment: boolean,
): Promise<boolean> {
	const sig = base64UrlToBytes(signature);
	const publicKey = hexToBytes(
		testEnvironment
			? TELEGRAM_ED25519_PUBLIC_KEYS.test
			: TELEGRAM_ED25519_PUBLIC_KEYS.production,
	);
	if (!sig || !publicKey) return false;
	// "<bot_id>:WebAppData\n" + sorted fields except `hash` and `signature`.
	const dataCheckString = `${botId}:WebAppData\n${buildDataCheckString(
		params,
		new Set(["hash", "signature"]),
	)}`;
	try {
		const key = await crypto.subtle.importKey(
			"raw",
			publicKey,
			{ name: "Ed25519" },
			false,
			["verify"],
		);
		return await crypto.subtle.verify(
			{ name: "Ed25519" },
			key,
			sig,
			encoder.encode(dataCheckString),
		);
	} catch {
		return false;
	}
}

/**
 * Validate a raw `Telegram.WebApp.initData` string.
 *
 * Uses `hash` validation when a bot token is available, otherwise falls back
 * to Ed25519 `signature` validation when a bot id is provided.
 */
export async function validateInitData(
	initDataRaw: string | null | undefined,
	options: ValidateInitDataOptions,
): Promise<InitDataValidationResult> {
	if (!initDataRaw || !initDataRaw.trim()) return { ok: false, reason: "MISSING" };

	let params: URLSearchParams;
	let data: WebAppInitData | null;
	try {
		params = new URLSearchParams(initDataRaw.trim());
		data = parseInitData(params);
	} catch {
		return { ok: false, reason: "MALFORMED" };
	}
	if (!data) return { ok: false, reason: "MALFORMED" };

	let method: "hash" | "signature";
	if (isConfiguredBotToken(options.botToken)) {
		method = "hash";
		if (!(await verifyHash(params, data.hash, options.botToken))) {
			return { ok: false, reason: "INVALID_HASH" };
		}
	} else if (options.botId !== undefined && data.signature) {
		method = "signature";
		const valid = await verifySignature(
			params,
			data.signature,
			options.botId,
			options.testEnvironment ?? false,
		);
		if (!valid) return { ok: false, reason: "INVALID_SIGNATURE" };
	} else {
		return { ok: false, reason: "NOT_CONFIGURED" };
	}

	// Prevent replay of outdated init data.
	const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
	const maxAge = options.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;
	if (
		now - data.auth_date > maxAge ||
		data.auth_date - now > MAX_FUTURE_SKEW_SECONDS
	) {
		return { ok: false, reason: "EXPIRED" };
	}

	return { ok: true, data, method };
}

/** Identity the rest of the backend works with (camelCase, string ids). */
export interface AuthenticatedUser {
	id: string;
	telegramId: number;
	firstName: string;
	lastName?: string;
	username?: string;
	photoUrl?: string;
	languageCode?: string;
	isPremium: boolean;
	allowsWriteToPm: boolean;
	startParam?: string;
	chatType?: WebAppInitData["chat_type"];
	chatInstance?: string;
	/** True only when the identity came from Telegram-verified init data. */
	isVerifiedInitData: boolean;
}

export function userFromInitData(data: WebAppInitData): AuthenticatedUser | null {
	const u = data.user;
	if (!u || typeof u.id !== "number") return null;
	return {
		id: `tg-${u.id}`,
		telegramId: u.id,
		firstName: (u.first_name || "Telegram Player").slice(0, 64),
		lastName: u.last_name?.slice(0, 64),
		username: u.username,
		photoUrl: u.photo_url,
		languageCode: u.language_code,
		isPremium: Boolean(u.is_premium),
		allowsWriteToPm: Boolean(u.allows_write_to_pm),
		startParam: data.start_param,
		chatType: data.chat_type,
		chatInstance: data.chat_instance,
		isVerifiedInitData: true,
	};
}

/**
 * Deterministic guest identity for local browser development (outside
 * Telegram). Only ever used when guest mode is explicitly enabled.
 */
export function guestUser(guestId: string | null | undefined): AuthenticatedUser {
	const clean = (guestId ?? "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40);
	const id = clean.startsWith("guest-") ? clean : "guest-local";
	const numeric = Number.parseInt(id.replace(/\D/g, ""), 10) || 1;
	return {
		id,
		telegramId: -numeric, // negative: never collides with a real Telegram id
		firstName: `Guest ${String(numeric).slice(-4)}`,
		username: undefined,
		isPremium: false,
		allowsWriteToPm: false,
		isVerifiedInitData: false,
	};
}

/** Header the Worker uses to pass a verified identity to Durable Objects. */
export const VERIFIED_IDENTITY_HEADER = "x-ludo-verified-identity";

export interface AuthEnv {
	TELEGRAM_BOT_TOKEN?: string;
	ALLOW_GUEST_MODE?: string;
}

export type AuthResult =
	| { ok: true; user: AuthenticatedUser }
	| { ok: false; reason: InitDataFailureReason };

/**
 * Resolve the caller from raw init data (and, in guest mode only, a client
 * guest id). This is the single place the backend decides who a caller is.
 */
export async function authenticate(
	env: AuthEnv,
	initDataRaw: string | null | undefined,
	guestId?: string | null,
): Promise<AuthResult> {
	const result = await validateInitData(initDataRaw, {
		botToken: env.TELEGRAM_BOT_TOKEN,
	});
	if (result.ok) {
		const user = userFromInitData(result.data);
		return user ? { ok: true, user } : { ok: false, reason: "NO_USER" };
	}
	if (env.ALLOW_GUEST_MODE === "true") {
		return { ok: true, user: guestUser(guestId) };
	}
	return { ok: false, reason: result.reason };
}

/** Extract init data from `Authorization: tma <initData>`. */
export function initDataFromAuthorization(header: string | null | undefined): string | null {
	if (!header) return null;
	const match = /^tma\s+(.+)$/i.exec(header.trim());
	return match ? match[1] : null;
}
