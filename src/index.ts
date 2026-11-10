import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { routePartykitRequest } from "partyserver";
import { z } from "zod";
import {
	APIRONE_CURRENCIES,
	COIN_BUNDLES,
	FALLBACK_USD_RATES,
} from "./shared/apirone-catalog.ts";
import type { ApironeCurrencyCode, ApironeInvoiceStatus } from "./shared/types.ts";
import {
	createApironeDepositInvoice,
	fetchApironeNetworkFees,
	fetchApironeUsdRate,
} from "./worker/apirone.ts";
import { LudoRoom } from "./worker/ludo-room.ts";
import { MatchmakingCoordinator } from "./worker/matchmaking-coordinator.ts";
import {
	type AuthenticatedUser,
	authenticate,
	initDataFromAuthorization,
	isConfiguredBotToken,
	timingSafeEqualStrings,
	VERIFIED_IDENTITY_HEADER,
} from "./worker/telegram-auth.ts";

export { LudoRoom, MatchmakingCoordinator };

const app = new Hono<{ Bindings: Cloudflare.Env }>();

app.use("/api/*", cors());

function getCoordinator(env: Cloudflare.Env): MatchmakingCoordinator {
	return env.MatchmakingCoordinator.getByName(
		"global",
	) as unknown as MatchmakingCoordinator;
}

/**
 * Extracts and verifies the caller's identity from Telegram Mini App initData
 * (in `x-telegram-init-data` or `Authorization: tma <initData>`) or, when
 * ALLOW_GUEST_MODE is enabled, from `x-ludo-guest-id` / body fallback.
 */
async function resolveCaller(
	env: Cloudflare.Env,
	req: Request,
	body?: {
		initData?: string;
		fallbackUser?: {
			id?: string;
			name?: string;
			username?: string;
			photoUrl?: string;
		};
	},
): Promise<AuthenticatedUser | null> {
	const initDataRaw =
		body?.initData ||
		req.headers.get("x-telegram-init-data") ||
		initDataFromAuthorization(req.headers.get("authorization"));
	const guestId =
		body?.fallbackUser?.id ||
		req.headers.get("x-ludo-guest-id") ||
		undefined;

	const auth = await authenticate(env, initDataRaw, guestId);
	if (!auth.ok) return null;

	// In guest mode, preserve the friendly guest display name/username if supplied
	if (!auth.user.isVerifiedInitData && body?.fallbackUser) {
		if (body.fallbackUser.name) {
			auth.user.firstName = body.fallbackUser.name.slice(0, 50);
		}
		if (body.fallbackUser.username) {
			auth.user.username = body.fallbackUser.username.slice(0, 32);
		}
		if (body.fallbackUser.photoUrl) {
			auth.user.photoUrl = body.fallbackUser.photoUrl;
		}
	}
	return auth.user;
}

/**
 * Core logic for Telegram Serverless Endpoints (`Telegram.WebApp.Serverless.call(name, input)`).
 * Reference:
 * - https://core.telegram.org/bots/serverless#endpoints
 * - https://core.telegram.org/bots/webapps#serverless
 *
 * Returns a JSON-serializable result, or throws `{ __endpointError: true, message, parameters }`
 * to surface an `ENDPOINT_ERROR` on the client.
 */
class EndpointError extends Error {
	readonly parameters?: Record<string, unknown>;
	constructor(message: string, parameters?: Record<string, unknown>) {
		super(message);
		this.name = "EndpointError";
		this.parameters = parameters;
	}
}

async function invokeServerlessEndpoint(
	name: string,
	input: Record<string, unknown>,
	user: AuthenticatedUser,
	env: Cloudflare.Env,
	originUrl: string,
): Promise<unknown> {
	const coordinator = getCoordinator(env);

	switch (name) {
		case "getProfile": {
			const profile = await coordinator.upsertUser({
				id: user.id,
				telegramId: user.telegramId,
				firstName: user.firstName,
				lastName: user.lastName,
				username: user.username,
				photoUrl: user.photoUrl,
				languageCode: user.languageCode,
				isPremium: user.isPremium,
				allowsWriteToPm: user.allowsWriteToPm,
				isVerifiedInitData: user.isVerifiedInitData,
			});
			return {
				profile,
				startParam: user.startParam ?? null,
				botUsername: env.TELEGRAM_BOT_USERNAME,
			};
		}

		case "claimDailyReward": {
			const res = await coordinator.claimDailyReward(user.id);
			if (!res.claimed && res.nextClaimAt) {
				throw new EndpointError("Daily reward already claimed within 24h", {
					code: "COOLDOWN_ACTIVE",
					nextClaimAt: res.nextClaimAt,
				});
			}
			return res;
		}

		case "listLobby": {
			const [rooms, leaderboard] = await Promise.all([
				coordinator.listPublicRooms(),
				coordinator.getLeaderboard(15),
			]);
			return { rooms, leaderboard };
		}

		case "matchmaking": {
			const mode =
				input.mode === "blitz" || input.mode === "high_roller"
					? input.mode
					: "classic";
			const maxPlayers =
				input.maxPlayers === 2 || input.maxPlayers === 3 ? input.maxPlayers : 4;
			const hostName =
				typeof input.hostName === "string" && input.hostName.trim()
					? input.hostName.trim().slice(0, 50)
					: user.firstName || "Royal Player";
			return coordinator.findOrCreateMatchmakingRoom({
				mode,
				maxPlayers,
				hostName,
			});
		}

		case "createInvoice": {
			const bundleId =
				typeof input.bundleId === "string" ? input.bundleId : "bundle-royal";
			const currency = (
				typeof input.currency === "string" ? input.currency : "gram"
			) as ApironeCurrencyCode;
			const invoice = await createApironeDepositInvoice({
				accountId: env.APIRONE_ACCOUNT_ID,
				transferKey: env.APIRONE_TRANSFER_KEY,
				callbackSecret: env.APIRONE_CALLBACK_SECRET || "ludo-callback-secret",
				originUrl,
				userId: user.id,
				bundleId,
				currency,
			});
			await coordinator.saveInvoice(invoice);
			const invoices = await coordinator.getUserInvoices(user.id);
			return { invoice, invoices };
		}

		default:
			throw new EndpointError(`Unknown Serverless endpoint: ${name}`, {
				code: "UNKNOWN_ENDPOINT",
			});
	}
}

app.get("/api/health", (c) => {
	return c.json({
		ok: true,
		app: c.env.APP_NAME,
		botUsername: c.env.TELEGRAM_BOT_USERNAME,
		runtime: "Cloudflare Workers + Durable Objects SQLite + PartyServer",
		botTokenConfigured: isConfiguredBotToken(c.env.TELEGRAM_BOT_TOKEN),
		guestModeAllowed: c.env.ALLOW_GUEST_MODE === "true",
		timestamp: Date.now(),
	});
});

app.post("/api/me", async (c) => {
	let body: {
		initData?: string;
		fallbackUser?: {
			id?: string;
			name?: string;
			username?: string;
			photoUrl?: string;
		};
	} = {};
	try {
		body = await c.req.json();
	} catch {
		// Empty body is fine
	}

	const user = await resolveCaller(c.env, c.req.raw, body);
	if (!user) {
		return c.json(
			{
				error: "UNAUTHORIZED",
				message: "Valid Telegram Mini App initData is required.",
			},
			401,
		);
	}

	const coordinator = getCoordinator(c.env);
	const profile = await coordinator.upsertUser({
		id: user.id,
		telegramId: user.telegramId,
		firstName: user.firstName,
		lastName: user.lastName,
		username: user.username,
		photoUrl: user.photoUrl,
		languageCode: user.languageCode,
		isPremium: user.isPremium,
		allowsWriteToPm: user.allowsWriteToPm,
		isVerifiedInitData: user.isVerifiedInitData,
	});

	return c.json({
		profile,
		startParam: user.startParam ?? null,
		botUsername: c.env.TELEGRAM_BOT_USERNAME,
	});
});

app.post(
	"/api/daily-reward",
	zValidator("json", z.object({ userId: z.string().optional() }).optional()),
	async (c) => {
		const body = c.req.valid("json");
		const user = await resolveCaller(c.env, c.req.raw, {
			fallbackUser: body?.userId ? { id: body.userId } : undefined,
		});
		if (!user) {
			return c.json({ error: "UNAUTHORIZED" }, 401);
		}
		const coordinator = getCoordinator(c.env);
		const result = await coordinator.claimDailyReward(user.id);
		return c.json(result);
	},
);

app.get("/api/rooms", async (c) => {
	const coordinator = getCoordinator(c.env);
	const [rooms, leaderboard] = await Promise.all([
		coordinator.listPublicRooms(),
		coordinator.getLeaderboard(15),
	]);
	return c.json({ rooms, leaderboard });
});

app.get("/api/leaderboard", async (c) => {
	const coordinator = getCoordinator(c.env);
	const leaderboard = await coordinator.getLeaderboard(25);
	return c.json({ leaderboard });
});

app.post(
	"/api/matchmaking",
	zValidator(
		"json",
		z.object({
			mode: z.enum(["classic", "blitz", "high_roller"]).default("classic"),
			maxPlayers: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(4),
			hostName: z.string().min(1).max(50).default("Royal Player"),
		}),
	),
	async (c) => {
		const params = c.req.valid("json");
		const coordinator = getCoordinator(c.env);
		const match = await coordinator.findOrCreateMatchmakingRoom(params);
		return c.json(match);
	},
);

app.get("/api/apirone/currencies", async (c) => {
	const selectedCurrency = (c.req.query("currency") ||
		"gram") as ApironeCurrencyCode;
	const [liveRate, fees] = await Promise.all([
		fetchApironeUsdRate(selectedCurrency),
		fetchApironeNetworkFees(selectedCurrency),
	]);

	return c.json({
		account: c.env.APIRONE_ACCOUNT_ID,
		currencies: APIRONE_CURRENCIES.map((cur) => ({
			...cur,
			usdRate:
				cur.code === selectedCurrency
					? liveRate
					: FALLBACK_USD_RATES[cur.code] ?? 1.0,
		})),
		selectedCurrency,
		selectedRateUsd: liveRate,
		fees,
		bundles: COIN_BUNDLES,
	});
});

app.post(
	"/api/apirone/invoice",
	zValidator(
		"json",
		z.object({
			userId: z.string().min(1).optional(),
			bundleId: z.string().min(1),
			currency: z.string().min(2),
		}),
	),
	async (c) => {
		const { userId: fallbackUserId, bundleId, currency } = c.req.valid("json");
		const user = await resolveCaller(c.env, c.req.raw, {
			fallbackUser: fallbackUserId ? { id: fallbackUserId } : undefined,
		});
		if (!user) {
			return c.json({ error: "UNAUTHORIZED" }, 401);
		}

		const url = new URL(c.req.url);
		const invoice = await createApironeDepositInvoice({
			accountId: c.env.APIRONE_ACCOUNT_ID,
			transferKey: c.env.APIRONE_TRANSFER_KEY,
			callbackSecret: c.env.APIRONE_CALLBACK_SECRET || "ludo-callback-secret",
			originUrl: url.origin,
			userId: user.id,
			bundleId,
			currency: currency as ApironeCurrencyCode,
		});

		const coordinator = getCoordinator(c.env);
		await coordinator.saveInvoice(invoice);
		const invoices = await coordinator.getUserInvoices(user.id);

		return c.json({ invoice, invoices });
	},
);

app.get("/api/apirone/invoices/:userId", async (c) => {
	const paramUserId = c.req.param("userId");
	const user = await resolveCaller(c.env, c.req.raw, {
		fallbackUser: { id: paramUserId },
	});
	if (!user) {
		return c.json({ error: "UNAUTHORIZED" }, 401);
	}
	const targetUserId = user.isVerifiedInitData ? user.id : paramUserId;
	const coordinator = getCoordinator(c.env);
	const invoices = await coordinator.getUserInvoices(targetUserId);
	return c.json({ invoices });
});

/**
 * Official Apirone Webhook Callback Handler
 * Reference: https://apirone.com/docs/callbacks/index.md
 * Must return HTTP 200 with plain text "*ok*" to acknowledge receipt.
 */
app.post("/api/apirone/callback", async (c) => {
	const secretQuery = c.req.query("secret");
	let payload: {
		invoice?: string;
		input_address?: string;
		status?: ApironeInvoiceStatus;
		confirmations?: number;
		txid?: string;
		data?: { secret?: string };
	};
	try {
		payload = await c.req.json();
	} catch {
		return c.json({ message: "Invalid JSON payload" }, 400);
	}

	const expectedSecret = c.env.APIRONE_CALLBACK_SECRET;
	const providedSecret = secretQuery || payload.data?.secret || "";
	if (expectedSecret) {
		const isSecretValid =
			providedSecret.length > 0 &&
			(await timingSafeEqualStrings(providedSecret, expectedSecret));
		if (!isSecretValid) {
			return c.json({ message: "Unauthorized callback secret" }, 401);
		}
	}

	const coordinator = getCoordinator(c.env);
	await coordinator.processApironeCallback({
		invoice: payload.invoice,
		input_address: payload.input_address,
		status: payload.status,
		confirmations: payload.confirmations,
		txid: payload.txid,
	});

	return new Response("*ok*", {
		status: 200,
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
});

app.post(
	"/api/apirone/simulate-confirm",
	zValidator(
		"json",
		z.object({
			invoiceId: z.string().min(1),
		}),
	),
	async (c) => {
		if (c.env.ALLOW_GUEST_MODE !== "true") {
			return c.json(
				{ error: "FORBIDDEN", message: "Simulation disabled in production." },
				403,
			);
		}
		const user = await resolveCaller(c.env, c.req.raw);
		if (!user) {
			return c.json({ error: "UNAUTHORIZED" }, 401);
		}
		const { invoiceId } = c.req.valid("json");
		const coordinator = getCoordinator(c.env);
		const result = await coordinator.processApironeCallback({
			invoice: invoiceId,
			status: "completed",
			confirmations: 2,
			txid: `0x${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
			expectedUserId: user.id,
		});
		return c.json(result);
	},
);

/**
 * Telegram Serverless Endpoint Compatibility Route: `POST /api/:endpointName`
 * Supports `Telegram.WebApp.Serverless.call(name, input, callback)` per:
 * - https://core.telegram.org/bots/serverless#endpoints
 * - https://core.telegram.org/bots/webapps#serverless
 */
app.post("/api/:endpointName", async (c) => {
	const endpointName = c.req.param("endpointName");
	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(endpointName)) {
		return c.json({ type: "NOT_FOUND", message: "Invalid endpoint name" }, 404);
	}

	let rawBody: Record<string, unknown> = {};
	try {
		rawBody = (await c.req.json()) as Record<string, unknown>;
	} catch {
		// Empty input object is valid
	}

	const initDataInBody =
		typeof rawBody.initData === "string" ? rawBody.initData : undefined;
	const input =
		rawBody.input && typeof rawBody.input === "object"
			? (rawBody.input as Record<string, unknown>)
			: rawBody;

	const user = await resolveCaller(c.env, c.req.raw, {
		initData: initDataInBody,
	});
	if (!user) {
		return c.json(
			{
				type: "UNAUTHORIZED",
				message: "Missing or invalid Telegram Mini App initData",
			},
			401,
		);
	}

	try {
		const url = new URL(c.req.url);
		const result = await invokeServerlessEndpoint(
			endpointName,
			input,
			user,
			c.env,
			url.origin,
		);
		return c.json(result);
	} catch (err) {
		if (err instanceof EndpointError) {
			return c.json(
				{
					type: "ENDPOINT_ERROR",
					message: err.message,
					parameters: err.parameters,
				},
				400,
			);
		}
		console.error(`Serverless endpoint ${endpointName} error:`, err);
		return c.json(
			{
				type: "INTERNAL_ERROR",
				message: "Internal server error",
			},
			500,
		);
	}
});

export default {
	async fetch(
		request: Request,
		env: Cloudflare.Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Route real-time multiplayer WebSocket & HTTP requests to LudoRoom via PartyServer
		// Authenticate or resolve guest identity before forwarding to the Durable Object
		if (url.pathname.startsWith("/parties/")) {
			const initDataQuery = url.searchParams.get("initData");
			const guestIdQuery = url.searchParams.get("guestId");
			const caller = await authenticate(
				env,
				initDataQuery ||
					request.headers.get("x-telegram-init-data") ||
					initDataFromAuthorization(request.headers.get("authorization")),
				guestIdQuery || request.headers.get("x-ludo-guest-id"),
			);

			const headers = new Headers(request.headers);
			headers.delete(VERIFIED_IDENTITY_HEADER);
			if (caller.ok) {
				headers.set(VERIFIED_IDENTITY_HEADER, JSON.stringify(caller.user));
			}

			const authedRequest = new Request(request.url, {
				method: request.method,
				headers,
				body: request.body,
			});

			const partyResponse = await routePartykitRequest(authedRequest, env, {
				cors: true,
			});
			if (partyResponse) {
				return partyResponse;
			}
		}

		// Route API requests through Hono
		if (url.pathname.startsWith("/api/")) {
			return app.fetch(request, env, ctx);
		}

		// Fallback to static assets binding
		if (env.ASSETS) {
			return env.ASSETS.fetch(request);
		}

		return new Response("Royal Ludo Arena Worker Running", { status: 200 });
	},
} satisfies ExportedHandler<Cloudflare.Env>;
