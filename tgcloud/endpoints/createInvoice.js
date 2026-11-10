// Telegram Serverless Mini App Endpoint: createInvoice
// Invoked via Telegram.WebApp.Serverless.call("createInvoice", { packId, currency }, cb)
import { EndpointError, env } from "sdk";
import { db } from "sdk/db";
import { fetch } from "sdk/fetch";
import {
	APIRONE_CURRENCIES,
	COIN_PACKS,
	getOrCreateProfileFromUser,
} from "../lib/ludo.js";
import { invoices } from "../schema.js";

const APIRONE_BASE = "https://apirone.com/api/v2";

export default async function (input = {}, ctx) {
	const profile = await getOrCreateProfileFromUser(ctx.user);
	const pack = COIN_PACKS.find((p) => p.id === input.packId);
	if (!pack) {
		throw new EndpointError("INVALID_PACK: Selected coin pack does not exist");
	}

	const currencyMeta =
		APIRONE_CURRENCIES.find((c) => c.code === input.currency) ||
		APIRONE_CURRENCIES[0];

	let rateUsd = currencyMeta.fallbackRateUsd;
	try {
		const res = await fetch(
			`${APIRONE_BASE}/ticker?currency=${encodeURIComponent(currencyMeta.code)}`,
		);
		if (res.ok) {
			const data = await res.json();
			const candidate = Number(data.usd ?? data.USD);
			if (Number.isFinite(candidate) && candidate > 0) {
				rateUsd = candidate;
			}
		}
	} catch {
		// Fallback to default rate
	}

	const rawCrypto = pack.priceUsd / rateUsd;
	const factor = 10 ** currencyMeta.decimals;
	const amountUnits = Math.max(1, Math.round(rawCrypto * factor));
	const amountCrypto = (amountUnits / factor).toFixed(
		Math.min(currencyMeta.decimals, 8),
	);

	let address = `demo_${currencyMeta.code.replace("@", "_")}_${crypto.randomUUID().slice(0, 12)}`;
	const accountId = env.APIRONE_ACCOUNT_ID;
	if (accountId) {
		try {
			const res = await fetch(
				`${APIRONE_BASE}/accounts/${encodeURIComponent(accountId)}/addresses`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ currency: currencyMeta.code }),
				},
			);
			if (res.ok) {
				const data = await res.json();
				if (data.address) {
					address = data.address;
				}
			}
		} catch {
			// Fallback to deterministic demo address if Apirone is unreachable
		}
	}

	const now = Date.now();
	const invoiceId = `inv_${now}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
	const scheme =
		currencyMeta.code === "btc"
			? "bitcoin"
			: currencyMeta.code === "ltc"
				? "litecoin"
				: "tron";
	const paymentUri = `${scheme}:${address}?amount=${amountCrypto}`;

	const invoice = {
		invoiceId,
		userId: profile.id,
		packId: pack.id,
		currency: currencyMeta.code,
		address,
		amountCrypto,
		amountUnits,
		amountUsd: pack.priceUsd,
		coinsCredited: pack.coins,
		gemsCredited: pack.bonusGems,
		status: "created",
		paymentUri,
		createdAt: now,
		updatedAt: now,
	};

	await db.insert(invoices).values({
		...invoice,
		amountUsd: Math.round(pack.priceUsd * 100),
		txid: null,
	});

	return {
		ok: true,
		invoice,
	};
}
