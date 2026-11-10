import QRCode from "qrcode";
import React, { useEffect, useState } from "react";
import {
	FaCheckCircle,
	FaCoins,
	FaCopy,
	FaExchangeAlt,
	FaGem,
	FaShieldAlt,
	FaTimes,
	FaWallet,
} from "react-icons/fa";
import {
	APIRONE_CURRENCIES,
	COIN_BUNDLES,
	FALLBACK_USD_RATES,
	usdToCryptoUnits,
} from "../../shared/apirone-catalog.ts";
import type {
	ApironeCurrencyCode,
	ApironeFeeOption,
	ApironeInvoiceRecord,
	TelegramUserProfile,
} from "../../shared/types.ts";
import { soundEngine } from "../lib/sound.ts";
import { hapticImpact, hapticNotification } from "../lib/telegram.ts";
import { buildAuthHeaders, useGameStore } from "../store/useGameStore.ts";

export const WalletModal: React.FC = () => {
	const {
		tgContext,
		profile,
		setActiveModal,
		setProfile,
		showToast,
		claimDailyBonus,
	} = useGameStore();

	const [selectedCurrency, setSelectedCurrency] =
		useState<ApironeCurrencyCode>("gram");
	const [selectedBundleId, setSelectedBundleId] =
		useState<string>("royal-champion");
	const [usdRate, setUsdRate] = useState<number>(FALLBACK_USD_RATES.gram);
	const [fees, setFees] = useState<ApironeFeeOption[]>([
		{ strategy: "normal", rate: 1 },
		{ strategy: "priority", rate: 2 },
	]);
	const [selectedFeeStrategy, setSelectedFeeStrategy] = useState<
		"normal" | "priority" | "custom"
	>("normal");
	const [activeInvoice, setActiveInvoice] =
		useState<ApironeInvoiceRecord | null>(null);
	const [qrDataUrl, setQrDataUrl] = useState<string>("");
	const [invoicesHistory, setInvoicesHistory] = useState<
		ApironeInvoiceRecord[]
	>([]);
	const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
	const [isSimulatingConfirm, setIsSimulatingConfirm] = useState(false);

	// Fetch live Apirone exchange rate & network fee estimates when currency changes
	useEffect(() => {
		let cancelled = false;
		async function loadCurrencyInfo() {
			try {
				const res = await fetch(
					`/api/apirone/currencies?currency=${encodeURIComponent(selectedCurrency)}`,
				);
				if (res.ok && !cancelled) {
					const data = (await res.json()) as {
						selectedRateUsd: number;
						fees: ApironeFeeOption[];
					};
					setUsdRate(data.selectedRateUsd);
					if (Array.isArray(data.fees) && data.fees.length > 0) {
						setFees(data.fees);
					}
				}
			} catch {
				// Use fallback rate
			}
		}
		void loadCurrencyInfo();
		return () => {
			cancelled = true;
		};
	}, [selectedCurrency]);

	// Load existing user invoices
	useEffect(() => {
		if (!profile?.id) return;
		fetch(`/api/apirone/invoices/${encodeURIComponent(profile.id)}`, {
			headers: buildAuthHeaders(tgContext),
		})
			.then((r) => r.json() as Promise<{ invoices?: ApironeInvoiceRecord[] }>)
			.then((data) => {
				if (data.invoices) setInvoicesHistory(data.invoices);
			})
			.catch(() => {});
	}, [profile?.id, tgContext]);

	// Render QR code when activeInvoice is created
	useEffect(() => {
		if (!activeInvoice) {
			setQrDataUrl("");
			return;
		}
		const payload = activeInvoice.paymentUrl || activeInvoice.address;
		QRCode.toDataURL(payload, {
			width: 210,
			margin: 1,
			color: {
				dark: "#090d1a",
				light: "#ffffff",
			},
		})
			.then((url) => setQrDataUrl(url))
			.catch(() => {});
	}, [activeInvoice]);

	const selectedBundle =
		COIN_BUNDLES.find((b) => b.id === selectedBundleId) ?? COIN_BUNDLES[1];
	const selectedMeta =
		APIRONE_CURRENCIES.find((c) => c.code === selectedCurrency) ??
		APIRONE_CURRENCIES[0];
	const estimated = usdToCryptoUnits(
		selectedBundle.usdPrice,
		selectedCurrency,
		usdRate,
	);

	const handleCreateInvoice = async () => {
		if (!profile) return;
		setIsCreatingInvoice(true);
		hapticImpact("medium");
		try {
			const res = await fetch("/api/apirone/invoice", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...buildAuthHeaders(tgContext),
				},
				body: JSON.stringify({
					userId: profile.id,
					bundleId: selectedBundle.id,
					currency: selectedCurrency,
				}),
			});
			if (res.ok) {
				const data = (await res.json()) as {
					invoice: ApironeInvoiceRecord;
					invoices: ApironeInvoiceRecord[];
				};
				setActiveInvoice(data.invoice);
				setInvoicesHistory(data.invoices);
				showToast(
					`✅ Created Apirone ${selectedMeta.symbol} Deposit Invoice!`,
				);
			}
		} catch {
			showToast("Failed to create invoice");
		} finally {
			setIsCreatingInvoice(false);
		}
	};

	const handleSimulateWebhookConfirmation = async () => {
		if (!activeInvoice) return;
		setIsSimulatingConfirm(true);
		hapticImpact("heavy");
		try {
			const res = await fetch("/api/apirone/simulate-confirm", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...buildAuthHeaders(tgContext),
				},
				body: JSON.stringify({ invoiceId: activeInvoice.invoiceId }),
			});
			if (res.ok) {
				const data = (await res.json()) as {
					matched: boolean;
					creditedNow: boolean;
					invoice?: ApironeInvoiceRecord;
					profile?: TelegramUserProfile;
				};
				if (data.invoice) {
					setActiveInvoice(data.invoice);
				}
				if (data.profile) {
					setProfile(data.profile);
				}
				soundEngine.playVictory();
				hapticNotification("success");
				showToast(
					`🎉 Apirone Webhook Confirmed! +${activeInvoice.coinsCredited.toLocaleString()} Coins & +${activeInvoice.gemsCredited} Gems added!`,
				);
			}
		} catch {
			showToast("Simulation failed");
		} finally {
			setIsSimulatingConfirm(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
			<div className="w-full max-w-lg max-h-[92dvh] bg-slate-900 border border-white/15 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
				{/* Modal Header */}
				<div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-slate-950/60">
					<div className="flex items-center gap-2.5">
						<div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-md">
							<FaWallet className="text-base" />
						</div>
						<div>
							<h2 className="text-base font-extrabold text-white leading-tight">
								Royal Crypto Treasury
							</h2>
							<p className="text-[11px] text-slate-400">
								Powered by Apirone v2 Multi-Currency Gateway (15+ Chains)
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={() => setActiveModal(null)}
						className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 cursor-pointer"
					>
						<FaTimes />
					</button>
				</div>

				<div className="p-4 sm:p-5 overflow-y-auto space-y-5">
					{/* Current Balance Banner + Daily Free Faucet */}
					<div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-indigo-950/90 via-slate-900 to-amber-950/40 border border-amber-400/25">
						<div className="flex items-center gap-4">
							<div className="flex items-center gap-1.5">
								<FaCoins className="text-amber-400 text-lg" />
								<div>
									<div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
										Gold Coins
									</div>
									<div className="text-base font-black text-white">
										{(profile?.coins ?? 3000).toLocaleString()}
									</div>
								</div>
							</div>
							<div className="h-7 w-px bg-white/10" />
							<div className="flex items-center gap-1.5">
								<FaGem className="text-cyan-400 text-base" />
								<div>
									<div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
										Royal Gems
									</div>
									<div className="text-base font-black text-white">
										{(profile?.gems ?? 60).toLocaleString()}
									</div>
								</div>
							</div>
						</div>

						<button
							type="button"
							onClick={() => void claimDailyBonus()}
							className="px-3 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/50 text-amber-300 text-xs font-bold transition cursor-pointer"
						>
							🎁 Free +500 Coins
						</button>
					</div>

					{/* Step 1: Select Coin Bundle */}
					<div>
						<div className="flex items-center justify-between mb-2">
							<span className="text-xs font-bold uppercase tracking-wider text-slate-400">
								1. Choose Treasury Pack
							</span>
							<span className="text-[11px] text-emerald-400 font-semibold">
								Instant Edge Settlement
							</span>
						</div>
						<div className="grid grid-cols-2 gap-2.5">
							{COIN_BUNDLES.map((bundle) => {
								const isSelected = bundle.id === selectedBundleId;
								return (
									<button
										key={bundle.id}
										type="button"
										onClick={() => {
											setSelectedBundleId(bundle.id);
											setActiveInvoice(null);
										}}
										className={`text-left p-3 rounded-2xl border transition relative cursor-pointer ${
											isSelected
												? "bg-amber-500/15 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)]"
												: "bg-slate-950/60 border-white/10 hover:border-white/25"
										}`}
									>
										{bundle.tag && (
											<span className="inline-block text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 mb-1">
												{bundle.tag}
											</span>
										)}
										<div className="text-xs font-bold text-white">
											{bundle.title}
										</div>
										<div className="flex items-baseline gap-1.5 mt-1">
											<span className="text-sm font-black text-amber-300">
												{bundle.coins.toLocaleString()} Coins
											</span>
											<span className="text-[10px] text-cyan-300 font-semibold">
												+{bundle.bonusGems} Gems
											</span>
										</div>
										<div className="mt-1.5 text-xs font-extrabold text-white/90">
											${bundle.usdPrice.toFixed(2)} USD
										</div>
									</button>
								);
							})}
						</div>
					</div>

					{/* Step 2: Select Apirone Crypto Currency */}
					<div>
						<div className="flex items-center justify-between mb-2">
							<span className="text-xs font-bold uppercase tracking-wider text-slate-400">
								2. Select Apirone Cryptocurrency
							</span>
							<span className="text-[11px] text-slate-300 flex items-center gap-1 font-mono">
								<FaExchangeAlt className="text-amber-400 text-[10px]" /> 1{" "}
								{selectedMeta.symbol} ≈ ${usdRate.toLocaleString()}
							</span>
						</div>

						<div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 max-h-36 overflow-y-auto p-1">
							{APIRONE_CURRENCIES.map((cur) => {
								const active = cur.code === selectedCurrency;
								return (
									<button
										key={cur.code}
										type="button"
										onClick={() => {
											setSelectedCurrency(cur.code);
											setActiveInvoice(null);
										}}
										className={`p-2 rounded-xl border text-left transition cursor-pointer ${
											active
												? "bg-sky-500/20 border-sky-400 text-white"
												: "bg-slate-950/60 border-white/10 text-slate-300 hover:border-white/25"
										}`}
									>
										<div className="flex items-center justify-between">
											<span
												className="w-2 h-2 rounded-full"
												style={{ backgroundColor: cur.iconColor }}
											/>
											<span className="text-[9px] font-mono text-slate-400 uppercase">
												{cur.code}
											</span>
										</div>
										<div className="text-xs font-extrabold mt-0.5 truncate">
											{cur.symbol}
										</div>
										<div className="text-[9px] text-slate-400 truncate">
											{cur.network}
										</div>
									</button>
								);
							})}
						</div>
					</div>

					{/* Network Fee Strategy (normal / priority / custom per Apirone Fee docs) */}
					<div className="flex items-center justify-between gap-2 bg-slate-950/65 border border-white/10 rounded-xl p-2.5">
						<span className="text-[11px] font-semibold text-slate-300">
							Network Fee Strategy:
						</span>
						<div className="flex items-center gap-1.5">
							{fees.map((f) => (
								<button
									key={f.strategy}
									type="button"
									onClick={() => setSelectedFeeStrategy(f.strategy)}
									className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer ${
										selectedFeeStrategy === f.strategy
											? "bg-amber-400 text-slate-950"
											: "bg-white/5 text-slate-300 hover:bg-white/10"
									}`}
								>
									{f.strategy} ({f.rate})
								</button>
							))}
						</div>
					</div>

					{/* Step 3: Generate Invoice OR Display Active Invoice QR */}
					{!activeInvoice ? (
						<div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
							<div className="flex items-center justify-between text-xs">
								<span className="text-slate-400">Amount Due:</span>
								<span className="font-mono font-bold text-white">
									{estimated.formattedCrypto} {selectedMeta.symbol} (
									{estimated.units.toLocaleString()} {selectedMeta.unitName})
								</span>
							</div>
							<button
								type="button"
								disabled={isCreatingInvoice}
								onClick={() => void handleCreateInvoice()}
								className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-slate-950 font-black text-sm shadow-lg hover:brightness-110 transition cursor-pointer"
							>
								{isCreatingInvoice
									? "Generating Apirone Invoice..."
									: `Pay ${estimated.formattedCrypto} ${selectedMeta.symbol} ($${selectedBundle.usdPrice})`}
							</button>
						</div>
					) : (
						<div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-400/35 space-y-3">
							<div className="flex items-center justify-between">
								<span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
									<FaShieldAlt /> Apirone Invoice #{activeInvoice.invoiceId}
								</span>
								<span
									className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
										activeInvoice.status === "completed" ||
										activeInvoice.status === "paid"
											? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
											: "bg-amber-500/20 text-amber-300 border border-amber-400/40"
									}`}
								>
									{activeInvoice.status}
								</span>
							</div>

							<div className="flex flex-col sm:flex-row items-center gap-4">
								{qrDataUrl && (
									<img
										src={qrDataUrl}
										alt="Crypto Deposit QR"
										className="w-36 h-36 rounded-xl border-2 border-white shadow-md shrink-0"
									/>
								)}
								<div className="flex-1 min-w-0 space-y-2 w-full">
									<div>
										<div className="text-[10px] text-slate-400 uppercase font-semibold">
											Send Exact Amount ({selectedMeta.network})
										</div>
										<div className="text-sm font-mono font-black text-amber-300">
											{activeInvoice.amountCrypto} {selectedMeta.symbol}{" "}
											<span className="text-[10px] text-slate-400 font-normal">
												({activeInvoice.amountUnits.toLocaleString()}{" "}
												{selectedMeta.unitName})
											</span>
										</div>
									</div>

									<div>
										<div className="text-[10px] text-slate-400 uppercase font-semibold">
											Deposit Address
										</div>
										<div className="flex items-center gap-1.5 mt-0.5">
											<code className="text-[11px] font-mono bg-slate-900 px-2 py-1.5 rounded-lg border border-white/10 text-slate-200 truncate flex-1">
												{activeInvoice.address}
											</code>
											<button
												type="button"
												onClick={() => {
													void navigator.clipboard.writeText(
														activeInvoice.address,
													);
													showToast("📋 Deposit address copied!");
												}}
												className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
												title="Copy Address"
											>
												<FaCopy className="text-xs" />
											</button>
										</div>
									</div>

									{activeInvoice.status !== "completed" ? (
										<button
											type="button"
											disabled={isSimulatingConfirm}
											onClick={() => void handleSimulateWebhookConfirmation()}
											className="w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-md transition cursor-pointer"
										>
											{isSimulatingConfirm
												? "Confirming Callback..."
												: "⚡ Simulate Blockchain Confirmation (Testnet Demo)"}
										</button>
									) : (
										<div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
											<FaCheckCircle /> Confirmed! Credited +
											{activeInvoice.coinsCredited.toLocaleString()} Coins!
										</div>
									)}
								</div>
							</div>
						</div>
					)}

					{/* Recent Invoices History */}
					{invoicesHistory.length > 0 && (
						<div>
							<div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
								Recent Crypto Transactions
							</div>
							<div className="space-y-1.5">
								{invoicesHistory.slice(0, 4).map((inv) => (
									<div
										key={inv.id}
										className="flex items-center justify-between text-xs bg-slate-950/50 border border-white/5 rounded-xl px-3 py-2"
									>
										<div>
											<span className="font-bold text-white uppercase">
												{inv.amountCrypto} {inv.currency}
											</span>
											<span className="text-slate-400 ml-2">
												(+{inv.coinsCredited.toLocaleString()} Coins)
											</span>
										</div>
										<span
											className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
												inv.status === "completed" || inv.status === "paid"
													? "bg-emerald-500/20 text-emerald-300"
													: "bg-amber-500/20 text-amber-300"
											}`}
										>
											{inv.status}
										</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
