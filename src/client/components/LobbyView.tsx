import { motion } from "framer-motion";
import React, { useState } from "react";
import {
	FaBolt,
	FaCoins,
	FaCrown,
	FaDice,
	FaFire,
	FaGem,
	FaPlay,
	FaPlus,
	FaRobot,
	FaSyncAlt,
	FaTrophy,
	FaUsers,
	FaWallet,
} from "react-icons/fa";
import type { GameMode } from "../../shared/types.ts";
import { hapticImpact, hapticSelection } from "../lib/telegram.ts";
import { useGameStore } from "../store/useGameStore.ts";

export const LobbyView: React.FC = () => {
	const {
		profile,
		rooms,
		leaderboard,
		isLoadingLobby,
		quickMatch,
		joinRoom,
		refreshLobby,
		setActiveModal,
		claimDailyBonus,
	} = useGameStore();

	const [selectedMode, setSelectedMode] = useState<GameMode>("classic");
	const [selectedPlayers, setSelectedPlayers] = useState<2 | 3 | 4>(4);
	const [joinCodeInput, setJoinCodeInput] = useState("");
	const [activeTab, setActiveTab] = useState<"arenas" | "leaderboard">("arenas");

	const handleInstantBotMatch = () => {
		hapticImpact("heavy");
		const code = crypto.randomUUID().slice(0, 6).toUpperCase();
		joinRoom(`room-${code.toLowerCase()}`, {
			roomConfig: {
				name: `${profile?.firstName || "Commander"}'s Royal Table`,
				mode: selectedMode,
				maxPlayers: selectedPlayers,
				stakeCoins:
					selectedMode === "high_roller"
						? 1000
						: selectedMode === "blitz"
							? 250
							: 100,
			},
			autoStartVsBots: true,
		});
	};

	const handleCreateCustomRoom = () => {
		hapticImpact("medium");
		const code = crypto.randomUUID().slice(0, 6).toUpperCase();
		joinRoom(`room-${code.toLowerCase()}`, {
			roomConfig: {
				name: `${profile?.firstName || "Royal"}'s Squad Room`,
				mode: selectedMode,
				maxPlayers: selectedPlayers,
				stakeCoins:
					selectedMode === "high_roller"
						? 1000
						: selectedMode === "blitz"
							? 250
							: 100,
			},
		});
	};

	const handleJoinByCode = (e: React.FormEvent) => {
		e.preventDefault();
		const cleaned = joinCodeInput.trim().replace(/^room-/i, "").toLowerCase();
		if (!cleaned) return;
		hapticImpact("medium");
		joinRoom(`room-${cleaned}`);
	};

	return (
		<div className="max-w-xl mx-auto px-3.5 pb-10 pt-2 space-y-4">
			{/* Hero Royal Banner */}
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				className="relative overflow-hidden rounded-3xl p-4 sm:p-5 border border-white/15 bg-gradient-to-br from-rose-950/75 via-slate-900/95 to-indigo-950/85 shadow-2xl"
			>
				<div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-amber-400/15 blur-2xl pointer-events-none" />
				<div className="flex items-start justify-between gap-3">
					<div>
						<div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-extrabold uppercase tracking-wider mb-2">
							<FaCrown className="text-[10px]" /> Telegram Mini App • Multiplayer
						</div>
						<h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
							Royal Ludo Arena
						</h1>
						<p className="text-xs text-slate-300 mt-0.5 max-w-xs">
							Real-time edge multiplayer on Cloudflare Durable Objects + Apirone
							Crypto Treasury.
						</p>
					</div>

					<button
						type="button"
						onClick={() => void claimDailyBonus()}
						className="shrink-0 px-3 py-2 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 font-black text-xs shadow-lg hover:brightness-110 transition cursor-pointer flex items-center gap-1.5"
					>
						<FaCoins /> +500 Free
					</button>
				</div>

				{/* Mode & Player Count Selector */}
				<div className="mt-4 pt-3.5 border-t border-white/10 space-y-3">
					<div className="grid grid-cols-3 gap-2">
						{(
							[
								{
									id: "classic",
									title: "Classic",
									sub: "4 Tokens • 100 Coins",
									icon: <FaDice className="text-emerald-400" />,
								},
								{
									id: "blitz",
									title: "Blitz Rush",
									sub: "2 Tokens • 250 Coins",
									icon: <FaBolt className="text-amber-400" />,
								},
								{
									id: "high_roller",
									title: "High Roller",
									sub: "VIP • 1,000 Coins",
									icon: <FaFire className="text-rose-400" />,
								},
							] as const
						).map((m) => {
							const active = selectedMode === m.id;
							return (
								<button
									key={m.id}
									type="button"
									onClick={() => {
										hapticSelection();
										setSelectedMode(m.id);
									}}
									className={`p-2.5 rounded-2xl border text-left transition cursor-pointer ${
										active
											? "bg-white/15 border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.25)]"
											: "bg-slate-950/55 border-white/10 hover:border-white/25"
									}`}
								>
									<div className="flex items-center justify-between">
										<span className="text-xs font-extrabold text-white">
											{m.title}
										</span>
										{m.icon}
									</div>
									<div className="text-[10px] text-slate-400 mt-0.5 truncate">
										{m.sub}
									</div>
								</button>
							);
						})}
					</div>

					{/* Player Seat Count (2P / 3P / 4P) */}
					<div className="flex items-center justify-between gap-2 bg-slate-950/60 p-1.5 rounded-2xl border border-white/10">
						<span className="text-xs font-bold text-slate-300 pl-2 flex items-center gap-1.5">
							<FaUsers className="text-sky-400" /> Table Size:
						</span>
						<div className="flex items-center gap-1.5">
							{([2, 3, 4] as const).map((cnt) => (
								<button
									key={cnt}
									type="button"
									onClick={() => {
										hapticSelection();
										setSelectedPlayers(cnt);
									}}
									className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
										selectedPlayers === cnt
											? "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow"
											: "text-slate-300 hover:bg-white/10"
									}`}
								>
									{cnt} Players
								</button>
							))}
						</div>
					</div>

					{/* Primary Action Buttons */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
						<button
							type="button"
							onClick={handleInstantBotMatch}
							className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 font-black text-sm shadow-[0_8px_25px_rgba(16,185,129,0.4)] hover:brightness-105 active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer"
						>
							<FaPlay className="text-xs" /> Instant Play vs AI Bots
						</button>

						<button
							type="button"
							onClick={() => void quickMatch(selectedMode, selectedPlayers)}
							className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500 text-slate-950 font-black text-sm shadow-[0_8px_25px_rgba(245,158,11,0.4)] hover:brightness-105 active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer"
						>
							<FaUsers className="text-sm" /> Online Matchmaking
						</button>
					</div>
				</div>
			</motion.div>

			{/* Private Room Code Bar & Create Squad Room */}
			<div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
				<form
					onSubmit={handleJoinByCode}
					className="sm:col-span-7 flex items-center gap-2 bg-slate-900/85 border border-white/15 rounded-2xl p-1.5 pl-3"
				>
					<input
						type="text"
						value={joinCodeInput}
						onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
						placeholder="Enter Room Code (e.g. A7K9P2)"
						maxLength={12}
						className="bg-transparent text-xs font-mono font-bold text-white placeholder:text-slate-500 focus:outline-none flex-1 min-w-0 uppercase"
					/>
					<button
						type="submit"
						className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-extrabold text-amber-300 transition cursor-pointer shrink-0"
					>
						Join Code
					</button>
				</form>

				<button
					type="button"
					onClick={handleCreateCustomRoom}
					className="sm:col-span-5 py-2.5 px-4 rounded-2xl bg-indigo-600/30 hover:bg-indigo-600/45 border border-indigo-400/40 text-indigo-200 font-extrabold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
				>
					<FaPlus className="text-[10px]" /> Create Private Room
				</button>
			</div>

			{/* Segmented Tabs: Live Arenas vs Global Leaderboard */}
			<div className="flex items-center justify-between border-b border-white/10 pb-2">
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setActiveTab("arenas")}
						className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
							activeTab === "arenas"
								? "bg-white/15 text-white border border-white/20"
								: "text-slate-400 hover:text-white"
						}`}
					>
						<FaDice className="text-amber-400" /> Live Rooms ({rooms.length})
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("leaderboard")}
						className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
							activeTab === "leaderboard"
								? "bg-white/15 text-white border border-white/20"
								: "text-slate-400 hover:text-white"
						}`}
					>
						<FaTrophy className="text-amber-400" /> Top Grandmasters
					</button>
				</div>

				<button
					type="button"
					onClick={() => void refreshLobby()}
					className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 text-xs transition cursor-pointer"
					title="Refresh Lobby"
				>
					<FaSyncAlt className={isLoadingLobby ? "animate-spin" : ""} />
				</button>
			</div>

			{activeTab === "arenas" ? (
				<div className="space-y-2.5">
					{rooms.length === 0 ? (
						<div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-center space-y-2">
							<FaRobot className="text-2xl text-amber-400 mx-auto" />
							<div className="text-sm font-bold text-white">
								No Waiting Public Rooms Yet
							</div>
							<p className="text-xs text-slate-400 max-w-xs mx-auto">
								Tap &ldquo;Instant Play vs AI Bots&rdquo; or &ldquo;Online
								Matchmaking&rdquo; above to launch a live table immediately!
							</p>
						</div>
					) : (
						rooms.map((room) => (
							<div
								key={room.roomId}
								className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900/80 border border-white/10 hover:border-white/25 transition"
							>
								<div className="min-w-0">
									<div className="flex items-center gap-2">
										<span className="text-xs font-extrabold text-white truncate">
											{room.name}
										</span>
										<span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/10 text-amber-300 font-bold">
											#{room.roomCode}
										</span>
									</div>
									<div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
										<span className="uppercase font-bold text-sky-400">
											{room.mode}
										</span>
										<span>
											👥 {room.currentPlayers}/{room.maxPlayers} Seated
										</span>
										<span className="text-amber-300 font-semibold">
											🏆 Pool: {room.prizePoolCoins.toLocaleString()}
										</span>
									</div>
								</div>

								<button
									type="button"
									onClick={() => joinRoom(room.roomId)}
									className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shrink-0 transition cursor-pointer"
								>
									{room.status === "waiting" ? "Join Table" : "Spectate"}
								</button>
							</div>
						))
					)}
				</div>
			) : (
				<div className="space-y-2">
					{leaderboard.map((entry, idx) => {
						const isMe = entry.id === profile?.id;
						return (
							<div
								key={entry.id}
								className={`flex items-center justify-between gap-3 p-3 rounded-2xl border ${
									isMe
										? "bg-amber-500/15 border-amber-400/50"
										: "bg-slate-900/75 border-white/10"
								}`}
							>
								<div className="flex items-center gap-3 min-w-0">
									<div
										className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${
											idx === 0
												? "bg-amber-400 text-slate-950"
												: idx === 1
													? "bg-slate-300 text-slate-950"
													: idx === 2
														? "bg-amber-700 text-white"
														: "bg-white/10 text-slate-300"
										}`}
									>
										{idx + 1}
									</div>
									<div className="min-w-0">
										<div className="text-xs font-extrabold text-white truncate flex items-center gap-1.5">
											{entry.firstName}
											{isMe && (
												<span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black">
													YOU
												</span>
											)}
										</div>
										<div className="text-[10px] text-slate-400">
											Rating: <strong className="text-sky-300">{entry.rating}</strong>{" "}
											• Wins: {entry.gamesWon}/{entry.gamesPlayed} • Captures:{" "}
											{entry.totalCaptures}
										</div>
									</div>
								</div>

								<div className="text-right shrink-0">
									<div className="text-xs font-black text-amber-300 flex items-center justify-end gap-1">
										<FaCoins className="text-[10px]" />{" "}
										{entry.coins.toLocaleString()}
									</div>
									<div className="text-[10px] text-cyan-300 flex items-center justify-end gap-1">
										<FaGem className="text-[9px]" /> {entry.gems} Gems
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}

			{/* Apirone Crypto Deposit Callout Card */}
			<div className="rounded-2xl p-3.5 bg-gradient-to-r from-sky-950/70 via-slate-900 to-indigo-950/70 border border-sky-400/25 flex items-center justify-between gap-3">
				<div>
					<div className="text-xs font-extrabold text-white flex items-center gap-1.5">
						<FaWallet className="text-sky-400" /> Top-Up with TON, USDT, BTC,
						ETH, TRX & More
					</div>
					<p className="text-[11px] text-slate-400 mt-0.5">
						Instant Apirone v2 invoices with live ticker rates & QR codes.
					</p>
				</div>
				<button
					type="button"
					onClick={() => setActiveModal("wallet")}
					className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs shrink-0 transition cursor-pointer"
				>
					Open Treasury
				</button>
			</div>
		</div>
	);
};
