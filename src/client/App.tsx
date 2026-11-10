import "@telegram-apps/telegram-ui/dist/styles.css";
import { AppRoot } from "@telegram-apps/telegram-ui";
import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import {
	FaBookOpen,
	FaCoins,
	FaCompress,
	FaCrown,
	FaExpand,
	FaGem,
	FaMobileAlt,
	FaPlusCircle,
	FaVolumeMute,
	FaVolumeUp,
} from "react-icons/fa";
import { GameRoomView } from "./components/GameRoomView.tsx";
import { LobbyView } from "./components/LobbyView.tsx";
import { WalletModal } from "./components/WalletModal.tsx";
import {
	getTelegramWebApp,
	promptAddToHomeScreen,
	toggleTelegramFullscreen,
} from "./lib/telegram.ts";
import { useGameStore } from "./store/useGameStore.ts";

export const App: React.FC = () => {
	const {
		tgContext,
		profile,
		roomState,
		activeView,
		activeModal,
		isMuted,
		toastMessage,
		bootstrap,
		leaveRoom,
		setActiveModal,
		toggleMute,
		showToast,
	} = useGameStore();

	const [isFullscreen, setIsFullscreen] = useState(false);

	useEffect(() => {
		void bootstrap();
	}, [bootstrap]);

	// Wire up Telegram Mini App BackButton, SettingsButton, Fullscreen events, and Closing Confirmation
	useEffect(() => {
		const wa = getTelegramWebApp();
		if (!wa) return;

		setIsFullscreen(Boolean(wa.isFullscreen));

		const handleBackButton = () => {
			const state = useGameStore.getState();
			if (state.activeModal !== null) {
				state.setActiveModal(null);
			} else if (state.activeView === "room") {
				state.leaveRoom();
			}
		};

		const handleSettingsButton = () => {
			const state = useGameStore.getState();
			state.setActiveModal(state.activeModal === "rules" ? null : "rules");
		};

		const handleFullscreenChanged = () => {
			setIsFullscreen(Boolean(wa.isFullscreen));
		};

		const handleHomeScreenAdded = () => {
			useGameStore
				.getState()
				.showToast("📲 Royal Ludo Arena added to your Home Screen!");
		};

		wa.BackButton?.onClick(handleBackButton);
		wa.SettingsButton?.show();
		wa.SettingsButton?.onClick(handleSettingsButton);
		wa.onEvent?.("fullscreenChanged", handleFullscreenChanged);
		wa.onEvent?.("homeScreenAdded", handleHomeScreenAdded);

		return () => {
			wa.BackButton?.offClick(handleBackButton);
			wa.SettingsButton?.offClick(handleSettingsButton);
			wa.offEvent?.("fullscreenChanged", handleFullscreenChanged);
			wa.offEvent?.("homeScreenAdded", handleHomeScreenAdded);
		};
	}, []);

	// Synchronize Telegram BackButton visibility & Closing Confirmation with app navigation state
	useEffect(() => {
		const wa = getTelegramWebApp();
		if (!wa) return;

		if (activeModal !== null || activeView === "room") {
			wa.BackButton?.show();
		} else {
			wa.BackButton?.hide();
		}

		if (activeView === "room" && roomState?.status === "playing") {
			wa.enableClosingConfirmation?.();
		} else {
			wa.disableClosingConfirmation?.();
		}
	}, [activeModal, activeView, roomState?.status]);

	const appPlatform =
		tgContext?.platform === "ios" || tgContext?.platform === "macos"
			? "ios"
			: "base";

	return (
		<AppRoot appearance={tgContext?.colorScheme ?? "dark"} platform={appPlatform}>
			<div className="min-h-dvh flex flex-col text-slate-100">
				{/* Sticky Top Telegram Mini App Header */}
				<header className="sticky top-0 z-30 backdrop-blur-xl bg-slate-950/75 border-b border-white/10 px-3.5 py-2.5">
					<div className="max-w-xl mx-auto flex items-center justify-between gap-2">
						{/* User Profile Pill */}
						<div className="flex items-center gap-2.5 min-w-0">
							<div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 via-rose-500 to-indigo-600 p-0.5 shrink-0 shadow">
								<div className="w-full h-full rounded-[10px] bg-slate-950 flex items-center justify-center font-black text-xs text-amber-300">
									{(profile?.firstName || "R").slice(0, 1).toUpperCase()}
								</div>
								<span className="absolute -bottom-1 -right-1 px-1 rounded bg-amber-400 text-slate-950 font-black text-[9px] leading-tight">
									Lv.{profile?.level ?? 1}
								</span>
							</div>

							<div className="min-w-0">
								<div className="flex items-center gap-1">
									<span className="text-xs font-extrabold text-white truncate">
										{profile?.firstName || "Royal Commander"}
									</span>
									{profile?.isPremium && (
										<FaCrown className="text-amber-400 text-[10px] shrink-0" />
									)}
								</div>
								<div className="text-[10px] text-slate-400 font-semibold">
									ELO <span className="text-sky-400">{profile?.rating ?? 1200}</span>{" "}
									• Wins <span className="text-emerald-400">{profile?.gamesWon ?? 0}</span>
								</div>
							</div>
						</div>

						{/* Balances & Utility Controls */}
						<div className="flex items-center gap-1.5 shrink-0">
							<button
								type="button"
								onClick={() => setActiveModal("wallet")}
								className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-400/35 transition cursor-pointer"
								title="Open Apirone Crypto Wallet"
							>
								<span className="flex items-center gap-1 text-xs font-black text-amber-300">
									<FaCoins className="text-amber-400 text-[11px]" />
									{(profile?.coins ?? 3000).toLocaleString()}
								</span>
								<span className="w-px h-3.5 bg-white/15" />
								<span className="flex items-center gap-1 text-xs font-black text-cyan-300">
									<FaGem className="text-cyan-400 text-[10px]" />
									{profile?.gems ?? 60}
								</span>
								<FaPlusCircle className="text-emerald-400 text-xs" />
							</button>

							{tgContext?.isTelegramEnv && (
								<>
									<button
										type="button"
										onClick={() => {
											const next = toggleTelegramFullscreen();
											setIsFullscreen(next);
										}}
										className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-slate-300 text-xs transition cursor-pointer"
										title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
									>
										{isFullscreen ? <FaCompress /> : <FaExpand />}
									</button>

									<button
										type="button"
										onClick={() => {
											promptAddToHomeScreen();
											showToast("📲 Check Telegram prompt to add shortcut!");
										}}
										className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-slate-300 text-xs transition cursor-pointer"
										title="Add Shortcut to Home Screen"
									>
										<FaMobileAlt />
									</button>
								</>
							)}

							<button
								type="button"
								onClick={() =>
									setActiveModal(activeModal === "rules" ? null : "rules")
								}
								className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-slate-300 text-xs transition cursor-pointer"
								title="Ludo Tournament Rules"
							>
								<FaBookOpen />
							</button>

							<button
								type="button"
								onClick={toggleMute}
								className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-slate-300 text-xs transition cursor-pointer"
								title={isMuted ? "Unmute Sound" : "Mute Sound"}
							>
								{isMuted ? (
									<FaVolumeMute className="text-rose-400" />
								) : (
									<FaVolumeUp className="text-emerald-400" />
								)}
							</button>
						</div>
					</div>
				</header>

				{/* Main View Area */}
				<main className="flex-1">
					{activeView === "room" ? <GameRoomView /> : <LobbyView />}
				</main>

				{/* Apirone Multi-Currency Crypto Treasury Modal */}
				{activeModal === "wallet" && <WalletModal />}

				{/* Rules Modal */}
				{activeModal === "rules" && (
					<div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
						<div className="w-full max-w-md rounded-3xl bg-slate-900 border border-white/15 p-5 space-y-3.5 shadow-2xl">
							<div className="flex items-center justify-between">
								<h3 className="text-base font-black text-white flex items-center gap-2">
									<FaCrown className="text-amber-400" /> Royal Ludo Arena Rules
								</h3>
								<button
									type="button"
									onClick={() => setActiveModal(null)}
									className="text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
								>
									Close
								</button>
							</div>
							<ul className="space-y-2 text-xs text-slate-300 leading-relaxed list-disc pl-4">
								<li>
									<strong className="text-white">Deploy on 6:</strong> Roll a{" "}
									<strong className="text-amber-300">6</strong> to deploy a
									token from your corner Yard onto your colored start square,
									earning a bonus roll! (Rolling three consecutive 6s forfeits
									the turn).
								</li>
								<li>
									<strong className="text-white">Safe Star Zones (★/🛡️):</strong>{" "}
									The 4 colored launch squares and 4 Shield squares are safe —
									no token can be captured on them. Stacked tokens of the same
									color also form a safe block.
								</li>
								<li>
									<strong className="text-white">Captures & Bonus Turns:</strong>{" "}
									Landing on a single opponent token on an unprotected square
									sends it back to their Yard and grants you an immediate{" "}
									<strong className="text-emerald-300">Bonus Roll</strong>!
								</li>
								<li>
									<strong className="text-white">Home Crown Goal:</strong> Guide{" "}
									4 tokens (Classic) or 2 tokens (Blitz Rush) into the center
									Crown triangle with an exact roll to claim the Prize Pool!
								</li>
							</ul>
							<div className="flex items-center gap-2">
								{activeView === "room" && (
									<button
										type="button"
										onClick={() => {
											setActiveModal(null);
											leaveRoom();
										}}
										className="flex-1 py-2.5 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-300 font-black text-xs cursor-pointer"
									>
										Leave Match
									</button>
								)}
								<button
									type="button"
									onClick={() => setActiveModal(null)}
									className="flex-1 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs cursor-pointer"
								>
									Got It, Let&apos;s Roll!
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Global Toast Notification */}
				<AnimatePresence>
					{toastMessage && (
						<motion.div
							initial={{ opacity: 0, y: 30 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 30 }}
							className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-amber-400/50 text-xs font-extrabold text-white shadow-2xl whitespace-nowrap"
						>
							{toastMessage}
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</AppRoot>
	);
};
