import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import {
	FaArrowLeft,
	FaComments,
	FaCrown,
	FaPlay,
	FaRedo,
	FaRobot,
	FaShareAlt,
	FaTrophy,
} from "react-icons/fa";
import { PLAYER_COLORS } from "../../shared/ludo-engine.ts";
import type { PlayerColor } from "../../shared/types.ts";
import {
	getTelegramWebApp,
	hapticImpact,
	shareTelegramRoomInvite,
} from "../lib/telegram.ts";
import { useGameStore } from "../store/useGameStore.ts";
import { DiceWidget } from "./DiceWidget.tsx";
import { LudoBoard } from "./LudoBoard.tsx";

const QUICK_EMOJIS = ["🎲", "🔥", "👑", "⚔️", "😂", "💎"];

export const GameRoomView: React.FC = () => {
	const {
		profile,
		botUsername,
		roomState,
		isConnectedToRoom,
		isDiceAnimating,
		emojiBursts,
		leaveRoom,
		sendRoomAction,
		showToast,
	} = useGameStore();

	const [chatOpen, setChatOpen] = useState(false);
	const [chatInput, setChatInput] = useState("");

	const myPlayerId = profile?.id || "tg-guest-1001";
	const activeTurnPlayer = roomState
		? roomState.players[roomState.turnColor]
		: null;
	const isMyTurnToRoll = Boolean(
		roomState &&
			roomState.status === "playing" &&
			roomState.turnPhase === "rolling" &&
			activeTurnPlayer &&
			!activeTurnPlayer.isBot &&
			activeTurnPlayer.id === myPlayerId,
	);

	// Synchronize Telegram Native MainButton (BottomButton) with turn/waiting state
	useEffect(() => {
		const wa = getTelegramWebApp();
		const mainButton = wa?.MainButton;
		if (!mainButton) return;

		const handleMainButtonClick = () => {
			const current = useGameStore.getState();
			const rs = current.roomState;
			if (!rs) return;
			if (rs.status === "waiting") {
				hapticImpact("heavy");
				current.sendRoomAction({ type: "START_GAME", fillWithBots: true });
			} else if (rs.status === "playing" && rs.turnPhase === "rolling") {
				hapticImpact("medium");
				current.sendRoomAction({ type: "ROLL_DICE" });
			} else if (rs.status === "finished") {
				hapticImpact("medium");
				current.sendRoomAction({ type: "REMATCH" });
			}
		};

		mainButton.onClick(handleMainButtonClick);

		if (!roomState) {
			mainButton.hide();
		} else if (roomState.status === "waiting") {
			mainButton.setParams({
				text: "⚔️ START MATCH NOW",
				color: "#10b981",
				text_color: "#020617",
				is_active: true,
				is_visible: true,
				has_shine_effect: true,
			});
		} else if (isMyTurnToRoll && !isDiceAnimating) {
			mainButton.setParams({
				text: "🎲 ROLL DICE NOW",
				color: "#f59e0b",
				text_color: "#020617",
				is_active: true,
				is_visible: true,
				has_shine_effect: true,
			});
		} else if (roomState.status === "finished") {
			mainButton.setParams({
				text: "🔄 PLAY REMATCH",
				color: "#f59e0b",
				text_color: "#020617",
				is_active: true,
				is_visible: true,
				has_shine_effect: true,
			});
		} else {
			mainButton.hide();
		}

		return () => {
			mainButton.offClick(handleMainButtonClick);
			mainButton.hide();
		};
	}, [roomState?.status, isMyTurnToRoll, isDiceAnimating]);

	if (!roomState) {
		return (
			<div className="max-w-md mx-auto px-4 py-16 text-center space-y-3">
				<div className="w-10 h-10 rounded-full border-3 border-amber-400 border-t-transparent animate-spin mx-auto" />
				<div className="text-sm font-bold text-white">
					Connecting to Cloudflare Durable Object Arena...
				</div>
				<button
					type="button"
					onClick={leaveRoom}
					className="px-4 py-2 rounded-xl bg-white/10 text-xs font-bold text-slate-300 cursor-pointer"
				>
					Back to Lobby
				</button>
			</div>
		);
	}

	const handleInviteFriends = () => {
		hapticImpact("light");
		const res = shareTelegramRoomInvite({
			roomCode: roomState.roomCode,
			roomId: roomState.roomId,
			botUsername,
		});
		if (!res.sharedViaTelegram) {
			showToast(`🔗 Invite link copied! Code: ${roomState.roomCode}`);
		}
	};

	const handleSendChat = (e: React.FormEvent) => {
		e.preventDefault();
		if (!chatInput.trim()) return;
		sendRoomAction({ type: "SEND_CHAT", text: chatInput.trim() });
		setChatInput("");
	};

	return (
		<div className="max-w-lg mx-auto px-2.5 sm:px-4 pb-6 pt-1 space-y-2.5 relative">
			{/* Top Room Info Bar */}
			<div className="flex items-center justify-between gap-2 bg-slate-900/85 border border-white/10 rounded-2xl px-3 py-2">
				<button
					type="button"
					onClick={leaveRoom}
					className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition cursor-pointer"
				>
					<FaArrowLeft className="text-[10px]" /> Lobby
				</button>

				<div className="text-center min-w-0">
					<div className="flex items-center justify-center gap-1.5">
						<span className="text-xs font-extrabold text-white truncate">
							{roomState.name}
						</span>
						<span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold">
							#{roomState.roomCode}
						</span>
					</div>
					<div className="text-[10px] text-slate-400 flex items-center justify-center gap-2">
						<span className="uppercase font-bold text-sky-400">
							{roomState.mode} ({roomState.targetTokensHome} Home)
						</span>
						<span>•</span>
						<span className="text-amber-300 font-bold">
							🏆 {roomState.prizePoolCoins.toLocaleString()} Coins
						</span>
						{!isConnectedToRoom && (
							<span className="text-rose-400 animate-pulse">• Reconnecting</span>
						)}
					</div>
				</div>

				<button
					type="button"
					onClick={handleInviteFriends}
					className="flex items-center gap-1 text-xs font-bold text-sky-300 hover:text-sky-200 px-2.5 py-1.5 rounded-xl bg-sky-500/15 border border-sky-400/30 transition cursor-pointer shrink-0"
				>
					<FaShareAlt className="text-[10px]" /> Invite
				</button>
			</div>

			{/* Waiting Room Pre-Game Banner */}
			{roomState.status === "waiting" && (
				<motion.div
					initial={{ opacity: 0, scale: 0.97 }}
					animate={{ opacity: 1, scale: 1 }}
					className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-slate-900 to-indigo-950/90 border border-emerald-400/40 flex flex-wrap items-center justify-between gap-2.5 shadow-lg"
				>
					<div>
						<div className="text-xs font-extrabold text-white flex items-center gap-1.5">
							<FaCrown className="text-amber-400" /> Table Ready to Launch
						</div>
						<p className="text-[11px] text-slate-300">
							Invite friends with code{" "}
							<strong className="text-amber-300 font-mono">
								{roomState.roomCode}
							</strong>{" "}
							or start immediately with AI Bots!
						</p>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => sendRoomAction({ type: "ADD_BOT" })}
							className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white flex items-center gap-1 transition cursor-pointer"
						>
							<FaRobot /> +AI Bot
						</button>
						<button
							type="button"
							onClick={() => {
								hapticImpact("heavy");
								sendRoomAction({ type: "START_GAME", fillWithBots: true });
							}}
							className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-black text-xs shadow-md flex items-center gap-1.5 transition cursor-pointer"
						>
							<FaPlay className="text-[10px]" /> Start Match Now
						</button>
					</div>
				</motion.div>
			)}

			{/* Compact 4-Color Score Strip */}
			<div className="grid grid-cols-4 gap-1.5">
				{PLAYER_COLORS.map((color) => {
					const p = roomState.players[color];
					const isTurn =
						roomState.status === "playing" && roomState.turnColor === color;
					const borderMap: Record<PlayerColor, string> = {
						red: isTurn
							? "border-rose-400 bg-rose-500/20"
							: "border-white/10 bg-slate-900/70",
						green: isTurn
							? "border-emerald-400 bg-emerald-500/20"
							: "border-white/10 bg-slate-900/70",
						yellow: isTurn
							? "border-amber-400 bg-amber-500/20"
							: "border-white/10 bg-slate-900/70",
						blue: isTurn
							? "border-blue-400 bg-blue-500/20"
							: "border-white/10 bg-slate-900/70",
					};
					return (
						<div
							key={color}
							className={`px-2 py-1.5 rounded-xl border transition ${borderMap[color]}`}
						>
							<div className="text-[10px] font-extrabold text-white truncate">
								{p ? p.name : "Open"}
							</div>
							<div className="flex items-center justify-between text-[10px] text-slate-300 mt-0.5">
								<span>
									🏠 {p?.tokensHome ?? 0}/{roomState.targetTokensHome}
								</span>
								<span>⚔️ {p?.captures ?? 0}</span>
							</div>
						</div>
					);
				})}
			</div>

			{/* The 15x15 Interactive Ludo Board */}
			<div className="relative">
				<LudoBoard
					roomState={roomState}
					myPlayerId={myPlayerId}
					onSelectToken={(tokenIndex) =>
						sendRoomAction({ type: "MOVE_TOKEN", tokenIndex })
					}
					onAddBot={(color) => sendRoomAction({ type: "ADD_BOT", color })}
				/>

				{/* Floating Emoji Bursts Overlay */}
				<div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-1.5 z-40">
					<AnimatePresence>
						{emojiBursts.map((burst) => (
							<motion.div
								key={burst.id}
								initial={{ opacity: 0, y: 20, scale: 0.6 }}
								animate={{ opacity: 1, y: -25, scale: 1.15 }}
								exit={{ opacity: 0, y: -55, scale: 0.8 }}
								className="px-3 py-1 rounded-full bg-slate-950/90 border border-white/20 shadow-xl flex items-center gap-1.5"
							>
								<span className="text-xl">{burst.emoji}</span>
								<span className="text-[11px] font-bold text-white">
									{burst.senderName}
								</span>
							</motion.div>
						))}
					</AnimatePresence>
				</div>
			</div>

			{/* Interactive 3D Dice & Turn Controller */}
			<DiceWidget
				value={roomState.diceValue}
				isRolling={isDiceAnimating}
				canRoll={isMyTurnToRoll}
				turnColor={roomState.turnColor}
				turnPlayerName={
					activeTurnPlayer?.name ?? roomState.turnColor.toUpperCase()
				}
				turnPhase={roomState.turnPhase}
				onRoll={() => sendRoomAction({ type: "ROLL_DICE" })}
			/>

			{/* Quick Emoji Reactions + Chat Drawer Toggle */}
			<div className="flex items-center justify-between gap-2 bg-slate-900/75 border border-white/10 rounded-2xl px-3 py-2">
				<div className="flex items-center gap-1.5 overflow-x-auto">
					{QUICK_EMOJIS.map((emoji) => (
						<button
							key={emoji}
							type="button"
							onClick={() => {
								hapticImpact("light");
								sendRoomAction({ type: "SEND_CHAT", emoji });
							}}
							className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 flex items-center justify-center text-base transition active:scale-90 cursor-pointer shrink-0"
						>
							{emoji}
						</button>
					))}
				</div>

				<button
					type="button"
					onClick={() => setChatOpen((v) => !v)}
					className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-200 flex items-center gap-1.5 shrink-0 cursor-pointer"
				>
					<FaComments className="text-amber-400" /> Chat (
					{roomState.chat.length})
				</button>
			</div>

			{/* Collapsible Match Chat & Move Log */}
			{chatOpen && (
				<div className="rounded-2xl bg-slate-900/95 border border-white/15 p-3 space-y-2">
					<div className="max-h-32 overflow-y-auto space-y-1 text-xs">
						{roomState.chat.length === 0 ? (
							<div className="text-slate-500 text-center py-2">
								No messages yet — say hello!
							</div>
						) : (
							roomState.chat.slice(-15).map((m) => (
								<div key={m.id} className="leading-snug">
									<span className="font-bold text-amber-300">
										{m.senderName}:{" "}
									</span>
									<span className="text-slate-200">{m.text}</span>
								</div>
							))
						)}
					</div>
					<form onSubmit={handleSendChat} className="flex gap-2">
						<input
							type="text"
							value={chatInput}
							onChange={(e) => setChatInput(e.target.value)}
							placeholder="Send message to table..."
							maxLength={120}
							className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
						/>
						<button
							type="submit"
							className="px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-extrabold text-xs cursor-pointer"
						>
							Send
						</button>
					</form>
				</div>
			)}

			{/* Victory Podium Overlay when game finishes */}
			{roomState.status === "finished" && (
				<div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
					<motion.div
						initial={{ scale: 0.9, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						className="w-full max-w-sm rounded-3xl bg-slate-900 border border-amber-400/50 p-6 text-center space-y-4 shadow-[0_0_50px_rgba(245,158,11,0.35)]"
					>
						<div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-500 to-orange-600 flex items-center justify-center mx-auto shadow-lg">
							<FaTrophy className="text-3xl text-slate-950" />
						</div>
						<div>
							<div className="text-xs font-extrabold uppercase tracking-widest text-amber-400">
								Royal Arena Victory
							</div>
							<h3 className="text-2xl font-black text-white mt-0.5">
								{roomState.players[roomState.winners[0]]?.name ??
									roomState.winners[0]?.toUpperCase()}{" "}
								Wins!
							</h3>
							<p className="text-xs text-slate-300 mt-1">
								Claimed the{" "}
								<strong className="text-amber-300">
									{roomState.prizePoolCoins.toLocaleString()} Gold Coins
								</strong>{" "}
								prize pool!
							</p>
						</div>

						<div className="space-y-1.5 text-left bg-slate-950/80 p-3 rounded-2xl border border-white/10">
							{roomState.winners.map((color, idx) => {
								const p = roomState.players[color];
								return (
									<div
										key={color}
										className="flex items-center justify-between text-xs py-1"
									>
										<span className="font-bold text-white">
											#{idx + 1} {p?.name ?? color.toUpperCase()}
										</span>
										<span className="text-amber-300 font-semibold">
											⚔️ {p?.captures ?? 0} Captures
										</span>
									</div>
								);
							})}
						</div>

						<div className="grid grid-cols-2 gap-2.5">
							<button
								type="button"
								onClick={leaveRoom}
								className="py-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-extrabold text-white transition cursor-pointer"
							>
								Lobby
							</button>
							<button
								type="button"
								onClick={() => sendRoomAction({ type: "REMATCH" })}
								className="py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 shadow-lg transition cursor-pointer"
							>
								<FaRedo /> Rematch
							</button>
						</div>
					</motion.div>
				</div>
			)}
		</div>
	);
};
