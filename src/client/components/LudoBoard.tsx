import { motion } from "framer-motion";
import React, { useMemo } from "react";
import {
	FaCrown,
	FaRobot,
	FaShieldAlt,
	FaStar,
	FaUserPlus,
} from "react-icons/fa";
import {
	COLOR_START_OFFSET,
	getTokenBoardCoord,
	HOME_STRETCH_COORDS,
	MAIN_TRACK_COORDS,
	PLAYER_COLORS,
	SAFE_TRACK_INDICES,
	YARD_TOKEN_COORDS,
} from "../../shared/ludo-engine.ts";
import type {
	PlayerColor,
	RoomState,
	TokenState,
} from "../../shared/types.ts";
import { hapticImpact } from "../lib/telegram.ts";

interface LudoBoardProps {
	roomState: RoomState;
	myPlayerId: string;
	onSelectToken: (tokenIndex: number) => void;
	onAddBot: (color: PlayerColor) => void;
}

const COLOR_STYLES: Record<
	PlayerColor,
	{
		bg: string;
		border: string;
		glow: string;
		tokenBg: string;
		tokenRing: string;
		text: string;
		hex: string;
		darkHex: string;
		label: string;
	}
> = {
	red: {
		bg: "bg-rose-500",
		border: "border-rose-400",
		glow: "shadow-[0_0_24px_rgba(244,63,94,0.65)]",
		tokenBg: "from-rose-400 via-rose-500 to-rose-700",
		tokenRing: "ring-rose-200",
		text: "text-rose-400",
		hex: "#f43f5e",
		darkHex: "#9f1239",
		label: "Crimson",
	},
	green: {
		bg: "bg-emerald-500",
		border: "border-emerald-400",
		glow: "shadow-[0_0_24px_rgba(16,185,129,0.65)]",
		tokenBg: "from-emerald-300 via-emerald-500 to-emerald-700",
		tokenRing: "ring-emerald-200",
		text: "text-emerald-400",
		hex: "#10b981",
		darkHex: "#065f46",
		label: "Emerald",
	},
	yellow: {
		bg: "bg-amber-400",
		border: "border-amber-300",
		glow: "shadow-[0_0_24px_rgba(245,158,11,0.65)]",
		tokenBg: "from-amber-300 via-amber-500 to-amber-700",
		tokenRing: "ring-amber-100",
		text: "text-amber-400",
		hex: "#f59e0b",
		darkHex: "#92400e",
		label: "Solar",
	},
	blue: {
		bg: "bg-blue-500",
		border: "border-blue-400",
		glow: "shadow-[0_0_24px_rgba(59,130,246,0.65)]",
		tokenBg: "from-sky-300 via-blue-500 to-blue-800",
		tokenRing: "ring-sky-200",
		text: "text-sky-400",
		hex: "#3b82f6",
		darkHex: "#1e40af",
		label: "Sapphire",
	},
};

export const LudoBoard: React.FC<LudoBoardProps> = ({
	roomState,
	myPlayerId,
	onSelectToken,
	onAddBot,
}) => {
	// Lookup maps for O(1) cell rendering on the 15x15 grid
	const boardMeta = useMemo(() => {
		const trackByCell = new Map<string, number>();
		MAIN_TRACK_COORDS.forEach(([r, c], idx) => {
			trackByCell.set(`${r},${c}`, idx);
		});

		const stretchByCell = new Map<
			string,
			{ color: PlayerColor; stepIdx: number }
		>();
		for (const color of PLAYER_COLORS) {
			HOME_STRETCH_COORDS[color].forEach(([r, c], idx) => {
				stretchByCell.set(`${r},${c}`, { color, stepIdx: idx });
			});
		}

		const startColorByTrackIdx = new Map<number, PlayerColor>();
		for (const color of PLAYER_COLORS) {
			startColorByTrackIdx.set(COLOR_START_OFFSET[color], color);
		}

		return { trackByCell, stretchByCell, startColorByTrackIdx };
	}, []);

	// Flatten all tokens and compute their exact [row, col] + stack offsets when multiple tokens share a cell
	const positionedTokens = useMemo(() => {
		const all: Array<{
			token: TokenState;
			coord: [number, number];
			coordKey: string;
			isMovable: boolean;
		}> = [];

		const activeTurnPlayer = roomState.players[roomState.turnColor];
		const canCurrentTurnMove =
			roomState.status === "playing" &&
			roomState.turnPhase === "moving" &&
			activeTurnPlayer &&
			!activeTurnPlayer.isBot &&
			activeTurnPlayer.id === myPlayerId;

		for (const color of PLAYER_COLORS) {
			if (!roomState.players[color]) continue;
			for (const token of roomState.tokens[color]) {
				const coord = getTokenBoardCoord(color, token.index, token.step);
				const coordKey =
					token.step === -1
						? `yard-${color}-${token.index}`
						: `${coord[0].toFixed(1)},${coord[1].toFixed(1)}`;
				const isMovable =
					Boolean(canCurrentTurnMove) &&
					color === roomState.turnColor &&
					roomState.validTokenIndexes.includes(token.index);

				all.push({ token, coord, coordKey, isMovable });
			}
		}

		const groups = new Map<string, typeof all>();
		for (const item of all) {
			const list = groups.get(item.coordKey) ?? [];
			list.push(item);
			groups.set(item.coordKey, list);
		}

		return all.map((item) => {
			const siblings = groups.get(item.coordKey) ?? [item];
			const count = siblings.length;
			const idxInGroup = siblings.indexOf(item);
			let offsetRow = 0;
			let offsetCol = 0;
			if (count > 1 && item.token.step >= 0) {
				const angle = (idxInGroup / count) * Math.PI * 2;
				offsetRow = Math.sin(angle) * 0.19;
				offsetCol = Math.cos(angle) * 0.19;
			}
			return {
				...item,
				displayRow: item.coord[0] + offsetRow,
				displayCol: item.coord[1] + offsetCol,
				stackCount: count,
			};
		});
	}, [roomState, myPlayerId]);

	const renderYardCorner = (
		color: PlayerColor,
		positionClass: string,
	) => {
		const style = COLOR_STYLES[color];
		const player = roomState.players[color];
		const isTurn =
			roomState.status === "playing" && roomState.turnColor === color;
		const yardCoords = YARD_TOKEN_COORDS[color];

		return (
			<div
				key={`yard-${color}`}
				className={`col-span-6 row-span-6 relative p-2 sm:p-2.5 rounded-2xl border transition-all duration-300 ${positionClass} ${
					isTurn
						? `${style.border} ${style.glow} bg-slate-900/95`
						: "border-white/10 bg-slate-900/75"
				}`}
				style={{
					background: isTurn
						? `radial-gradient(circle at 50% 30%, ${style.hex}33, rgba(15,23,42,0.95))`
						: `radial-gradient(circle at 50% 30%, ${style.hex}18, rgba(15,23,42,0.88))`,
				}}
			>
				{/* Player header bar inside the corner base */}
				<div className="flex items-center justify-between gap-1 mb-1.5 px-1">
					<div className="flex items-center gap-1.5 min-w-0">
						<span
							className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.bg} ${
								isTurn ? "animate-ping" : ""
							}`}
						/>
						<span className="text-[11px] sm:text-xs font-bold text-white truncate">
							{player ? player.name : "Empty Seat"}
						</span>
					</div>
					{player?.isBot && (
						<span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300 font-semibold flex items-center gap-0.5 shrink-0">
							<FaRobot className="text-[9px]" /> AI
						</span>
					)}
					{!player && roomState.status === "waiting" && (
						<button
							type="button"
							onClick={() => {
								hapticImpact("light");
								onAddBot(color);
							}}
							className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-amber-300 font-semibold flex items-center gap-1 transition cursor-pointer"
							title="Add AI Bot to this seat"
						>
							<FaUserPlus className="text-[8px]" /> +Bot
						</button>
					)}
				</div>

				{/* Inner 2x2 token launch pad */}
				<div className="w-full h-[calc(100%-26px)] rounded-xl bg-slate-950/75 border border-white/10 grid grid-cols-2 grid-rows-2 place-items-center p-2 gap-2 relative overflow-hidden">
					{[0, 1, 2, 3].map((slotIdx) => {
						const _c = yardCoords[slotIdx];
						return (
							<div
								key={`pad-${color}-${slotIdx}`}
								className="w-7 h-7 sm:w-9 sm:h-9 rounded-full border border-white/15 flex items-center justify-center shadow-inner"
								style={{
									background: `radial-gradient(circle, ${style.hex}28 0%, rgba(15,23,42,0.9) 80%)`,
								}}
							>
								<div
									className="w-2.5 h-2.5 rounded-full opacity-40"
									style={{ backgroundColor: style.hex }}
								/>
							</div>
						);
					})}

					{/* Rank overlay if player finished */}
					{player?.finishRank && (
						<div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] flex flex-col items-center justify-center z-20">
							<FaCrown className="text-amber-400 text-xl sm:text-2xl mb-0.5 drop-shadow" />
							<span className="text-xs font-extrabold text-amber-300">
								#{player.finishRank} Place
							</span>
						</div>
					)}
				</div>
			</div>
		);
	};

	// Build individual track/stretch cells for the 15x15 grid (skipping the 4 6x6 corners and 3x3 center)
	const trackCells: React.ReactNode[] = [];
	for (let r = 0; r < 15; r++) {
		for (let c = 0; c < 15; c++) {
			// Skip 4 6x6 corners
			if (r < 6 && c < 6) continue;
			if (r < 6 && c >= 9) continue;
			if (r >= 9 && c >= 9) continue;
			if (r >= 9 && c < 6) continue;
			// Skip 3x3 center home goal
			if (r >= 6 && r <= 8 && c >= 6 && c <= 8) continue;

			const key = `${r},${c}`;
			const trackIdx = boardMeta.trackByCell.get(key);
			const stretchInfo = boardMeta.stretchByCell.get(key);
			const startColor =
				trackIdx !== undefined
					? boardMeta.startColorByTrackIdx.get(trackIdx)
					: undefined;
			const isSafeStar =
				trackIdx !== undefined && SAFE_TRACK_INDICES.has(trackIdx);

			let cellBg = "bg-slate-900/85 border-white/10";
			let accentHex: string | undefined;

			if (startColor) {
				accentHex = COLOR_STYLES[startColor].hex;
				cellBg = "border-white/25";
			} else if (stretchInfo) {
				accentHex = COLOR_STYLES[stretchInfo.color].hex;
				cellBg = "border-white/20";
			} else if (isSafeStar) {
				cellBg = "bg-amber-500/15 border-amber-400/35";
			}

			trackCells.push(
				<div
					key={`cell-${r}-${c}`}
					style={{
						gridRowStart: r + 1,
						gridColumnStart: c + 1,
						...(accentHex
							? {
									background: startColor
										? `linear-gradient(135deg, ${accentHex}cc, ${COLOR_STYLES[startColor].darkHex}ee)`
										: `linear-gradient(135deg, ${accentHex}66, ${accentHex}33)`,
								}
							: {}),
					}}
					className={`relative border rounded-[5px] flex items-center justify-center transition-colors ${cellBg}`}
				>
					{startColor && (
						<FaStar className="text-white/95 text-[10px] sm:text-xs drop-shadow" />
					)}
					{!startColor && isSafeStar && (
						<FaShieldAlt className="text-amber-300/85 text-[10px] sm:text-xs drop-shadow" />
					)}
					{stretchInfo && stretchInfo.stepIdx === 4 && (
						<span className="w-1.5 h-1.5 rounded-full bg-white/70" />
					)}
				</div>,
			);
		}
	}

	return (
		<div className="relative w-full max-w-[440px] aspect-square mx-auto select-none p-1.5 sm:p-2 rounded-3xl bg-gradient-to-b from-slate-800/90 via-slate-900/95 to-slate-950 border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.75)]">
			{/* 15x15 CSS Grid Board */}
			<div className="relative w-full h-full grid grid-cols-15 grid-rows-15 gap-[2px]">
				{/* Top-Left Red Yard (rows 1..6, cols 1..6) */}
				{renderYardCorner("red", "col-start-1 row-start-1")}

				{/* Top-Right Green Yard (rows 1..6, cols 10..15) */}
				{renderYardCorner("green", "col-start-10 row-start-1")}

				{/* Bottom-Right Yellow Yard (rows 10..15, cols 10..15) */}
				{renderYardCorner("yellow", "col-start-10 row-start-10")}

				{/* Bottom-Left Blue Yard (rows 10..15, cols 1..6) */}
				{renderYardCorner("blue", "col-start-1 row-start-10")}

				{/* 3x3 Center Home Goal (rows 7..9, cols 7..9) */}
				<div className="col-start-7 col-span-3 row-start-7 row-span-3 relative rounded-xl overflow-hidden border border-amber-400/40 shadow-[inset_0_0_20px_rgba(0,0,0,0.7)]">
					<svg
						viewBox="0 0 100 100"
						className="w-full h-full block"
						preserveAspectRatio="none"
					>
						{/* Left Triangle: Red */}
						<polygon
							points="0,0 50,50 0,100"
							fill="#e11d48"
							stroke="rgba(255,255,255,0.2)"
							strokeWidth="1"
						/>
						{/* Top Triangle: Green */}
						<polygon
							points="0,0 100,0 50,50"
							fill="#059669"
							stroke="rgba(255,255,255,0.2)"
							strokeWidth="1"
						/>
						{/* Right Triangle: Yellow */}
						<polygon
							points="100,0 100,100 50,50"
							fill="#d97706"
							stroke="rgba(255,255,255,0.2)"
							strokeWidth="1"
						/>
						{/* Bottom Triangle: Blue */}
						<polygon
							points="0,100 100,100 50,50"
							fill="#2563eb"
							stroke="rgba(255,255,255,0.2)"
							strokeWidth="1"
						/>
					</svg>
					<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
						<div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-950/90 border border-amber-400/60 flex items-center justify-center shadow-lg">
							<FaCrown className="text-amber-400 text-xs sm:text-sm drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
						</div>
					</div>
				</div>

				{/* Outer Track & Home Stretch Cells */}
				{trackCells}
			</div>

			{/* Animated Floating Token Layer mapped across the 15x15 coordinate space */}
			<div className="absolute inset-1.5 sm:inset-2 pointer-events-none">
				{positionedTokens.map(
					({
						token,
						displayRow,
						displayCol,
						isMovable,
						stackCount,
					}) => {
						const style = COLOR_STYLES[token.color];
						const topPct = ((displayRow + 0.5) / 15) * 100;
						const leftPct = ((displayCol + 0.5) / 15) * 100;

						return (
							<motion.button
								key={token.id}
								type="button"
								initial={false}
								animate={{
									top: `${topPct}%`,
									left: `${leftPct}%`,
									scale: isMovable ? [1, 1.22, 1] : token.step === 56 ? 0.78 : 1,
									zIndex: isMovable ? 40 : token.step >= 0 ? 25 : 15,
								}}
								transition={{
									top: { type: "spring", stiffness: 320, damping: 26 },
									left: { type: "spring", stiffness: 320, damping: 26 },
									scale: isMovable
										? { duration: 0.9, repeat: Number.POSITIVE_INFINITY }
										: { duration: 0.2 },
								}}
								onClick={() => {
									if (isMovable) {
										hapticImpact("medium");
										onSelectToken(token.index);
									}
								}}
								style={{
									transform: "translate(-50%, -50%)",
								}}
								className={`absolute -translate-x-1/2 -translate-y-1/2 w-[5.8%] h-[5.8%] rounded-full flex items-center justify-center transition-shadow ${
									isMovable
										? "pointer-events-auto cursor-pointer"
										: "pointer-events-none"
								}`}
								aria-label={`${token.color} token ${token.index + 1}`}
							>
								{/* Pulsing Halo when this token can be moved */}
								{isMovable && (
									<span className="absolute -inset-1.5 rounded-full border-2 border-amber-300 bg-amber-400/25 animate-pulse-ring" />
								)}

								{/* 3D Pawn Disc */}
								<span
									className={`w-full h-full rounded-full bg-gradient-to-b ${style.tokenBg} ring-2 ${
										isMovable
											? "ring-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.95)]"
											: `${style.tokenRing} shadow-[0_3px_8px_rgba(0,0,0,0.85)]`
									} flex items-center justify-center relative`}
								>
									<span className="w-[52%] h-[52%] rounded-full bg-white/85 shadow-inner flex items-center justify-center">
										{stackCount > 1 && token.step >= 0 ? (
											<span className="text-[8px] font-black text-slate-950 leading-none">
												{stackCount}
											</span>
										) : null}
									</span>
								</span>
							</motion.button>
						);
					},
				)}
			</div>
		</div>
	);
};
