import { motion } from "framer-motion";
import React from "react";
import type { PlayerColor } from "../../shared/types.ts";

interface DiceWidgetProps {
	value: number | null;
	isRolling: boolean;
	canRoll: boolean;
	turnColor: PlayerColor;
	turnPlayerName: string;
	turnPhase: "rolling" | "moving" | "animating" | "gameover";
	onRoll: () => void;
}

const PIP_LAYOUTS: Record<number, number[]> = {
	1: [4],
	2: [0, 8],
	3: [0, 4, 8],
	4: [0, 2, 6, 8],
	5: [0, 2, 4, 6, 8],
	6: [0, 2, 3, 5, 6, 8],
};

const COLOR_BADGE: Record<PlayerColor, string> = {
	red: "from-rose-500 to-rose-700 border-rose-400 shadow-rose-500/35",
	green: "from-emerald-500 to-emerald-700 border-emerald-400 shadow-emerald-500/35",
	yellow: "from-amber-400 to-amber-600 border-amber-300 shadow-amber-500/35",
	blue: "from-blue-500 to-blue-700 border-blue-400 shadow-blue-500/35",
};

export const DiceWidget: React.FC<DiceWidgetProps> = ({
	value,
	isRolling,
	canRoll,
	turnColor,
	turnPlayerName,
	turnPhase,
	onRoll,
}) => {
	const displayVal = value ?? 6;
	const activePips = PIP_LAYOUTS[displayVal] ?? PIP_LAYOUTS[6];

	return (
		<div className="flex items-center justify-between gap-3 bg-slate-900/90 border border-white/15 rounded-2xl px-3.5 py-2.5 shadow-xl backdrop-blur-md">
			{/* Active Turn Indicator */}
			<div className="flex items-center gap-2.5 min-w-0">
				<div
					className={`w-10 h-10 rounded-xl bg-gradient-to-br ${COLOR_BADGE[turnColor]} border flex items-center justify-center font-black text-white text-sm uppercase shrink-0 shadow-lg`}
				>
					{turnColor.slice(0, 1)}
				</div>
				<div className="min-w-0">
					<div className="flex items-center gap-1.5">
						<span className="text-xs font-extrabold text-white truncate">
							{turnPlayerName}
						</span>
						{canRoll && (
							<span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 animate-pulse">
								YOUR TURN
							</span>
						)}
					</div>
					<p className="text-[11px] text-slate-400 truncate">
						{turnPhase === "rolling"
							? canRoll
								? "Tap the 3D dice to roll!"
								: "Waiting for dice roll..."
							: turnPhase === "moving"
								? "Select a glowing token on the board"
								: "Match finished"}
					</p>
				</div>
			</div>

			{/* Interactive 3D Dice Button */}
			<motion.button
				type="button"
				disabled={!canRoll}
				onClick={onRoll}
				whileTap={canRoll ? { scale: 0.9 } : undefined}
				animate={
					isRolling
						? {
								rotate: [0, 90, 180, 270, 360],
								scale: [1, 1.16, 0.95, 1.08, 1],
							}
						: canRoll
							? { scale: [1, 1.06, 1] }
							: { scale: 1 }
				}
				transition={
					isRolling
						? { duration: 0.38 }
						: canRoll
							? { duration: 1.2, repeat: Number.POSITIVE_INFINITY }
							: { duration: 0.2 }
				}
				className={`relative w-14 h-14 rounded-2xl p-2 grid grid-cols-3 grid-rows-3 place-items-center transition-all border-2 ${
					canRoll
						? "bg-gradient-to-br from-white via-slate-100 to-slate-300 border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.65)] cursor-pointer"
						: "bg-gradient-to-br from-slate-200 to-slate-400 border-white/20 opacity-80 cursor-not-allowed"
				}`}
				aria-label="Roll Dice"
			>
				{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((cellIdx) => {
					const hasPip = activePips.includes(cellIdx);
					return (
						<span
							key={cellIdx}
							className={`w-2.5 h-2.5 rounded-full transition-transform ${
								hasPip
									? displayVal === 6
										? "bg-rose-600 scale-100 shadow-sm"
										: "bg-slate-900 scale-100 shadow-sm"
									: "scale-0"
							}`}
						/>
					);
				})}
			</motion.button>
		</div>
	);
};
