import confetti from "canvas-confetti";
import PartySocket from "partysocket";
import { create } from "zustand";
import type {
	ClientToServerMessage,
	GameMode,
	MoveRecord,
	PlayerColor,
	PublicRoomSummary,
	RoomState,
	ServerToClientMessage,
	TelegramUserProfile,
} from "../../shared/types.ts";
import { soundEngine } from "../lib/sound.ts";
import {
	type ClientTelegramContext,
	getPersistentPreference,
	hapticImpact,
	hapticNotification,
	hapticSelection,
	initTelegramMiniApp,
	setPersistentPreference,
} from "../lib/telegram.ts";

export interface EmojiBurstItem {
	id: string;
	senderName: string;
	senderColor?: PlayerColor;
	emoji: string;
	createdAt: number;
}

const PREF_MUTED_KEY = "myludo_pref_muted_v1";

export function buildAuthHeaders(
	tgContext: ClientTelegramContext | null,
): Record<string, string> {
	const headers: Record<string, string> = {};
	if (tgContext?.initDataRaw) {
		headers["x-telegram-init-data"] = tgContext.initDataRaw;
	}
	if (tgContext?.fallbackUser?.id) {
		headers["x-ludo-guest-id"] = tgContext.fallbackUser.id;
	}
	return headers;
}

interface GameStoreState {
	tgContext: ClientTelegramContext | null;
	profile: TelegramUserProfile | null;
	botUsername: string;
	activeView: "lobby" | "room";
	activeModal: "wallet" | "leaderboard" | "rules" | "create_room" | null;
	rooms: PublicRoomSummary[];
	leaderboard: TelegramUserProfile[];
	roomState: RoomState | null;
	socket: PartySocket | null;
	isConnectedToRoom: boolean;
	isDiceAnimating: boolean;
	lastRolledDice: number | null;
	recentMove: MoveRecord | null;
	emojiBursts: EmojiBurstItem[];
	isMuted: boolean;
	toastMessage: string | null;
	isLoadingLobby: boolean;

	// Actions
	bootstrap: () => Promise<void>;
	refreshLobby: () => Promise<void>;
	claimDailyBonus: () => Promise<void>;
	setActiveModal: (
		modal: "wallet" | "leaderboard" | "rules" | "create_room" | null,
	) => void;
	setProfile: (profile: TelegramUserProfile) => void;
	showToast: (msg: string) => void;
	toggleMute: () => void;

	quickMatch: (mode: GameMode, maxPlayers: 2 | 3 | 4) => Promise<void>;
	joinRoom: (
		roomId: string,
		options?: {
			preferredColor?: PlayerColor;
			roomConfig?: {
				name?: string;
				mode?: GameMode;
				maxPlayers?: 2 | 3 | 4;
				stakeCoins?: number;
				isPrivate?: boolean;
			};
			autoStartVsBots?: boolean;
		},
	) => void;
	leaveRoom: () => void;
	sendRoomAction: (msg: ClientToServerMessage) => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
	tgContext: null,
	profile: null,
	botUsername: "RoyalLudoArenaBot",
	activeView: "lobby",
	activeModal: null,
	rooms: [],
	leaderboard: [],
	roomState: null,
	socket: null,
	isConnectedToRoom: false,
	isDiceAnimating: false,
	lastRolledDice: null,
	recentMove: null,
	emojiBursts: [],
	isMuted: false,
	toastMessage: null,
	isLoadingLobby: false,

	showToast: (msg: string) => {
		set({ toastMessage: msg });
		setTimeout(() => {
			if (get().toastMessage === msg) {
				set({ toastMessage: null });
			}
		}, 3200);
	},

	toggleMute: () => {
		const next = !get().isMuted;
		soundEngine.muted = next;
		set({ isMuted: next });
		setPersistentPreference(PREF_MUTED_KEY, next ? "1" : "0");
		hapticSelection();
	},

	setActiveModal: (modal) => {
		hapticSelection();
		set({ activeModal: modal });
	},

	setProfile: (profile) => {
		set({ profile });
	},

	bootstrap: async () => {
		const tgContext = initTelegramMiniApp();
		set({ tgContext, isLoadingLobby: true });

		// Restore persisted sound preference via Telegram DeviceStorage / CloudStorage / localStorage
		getPersistentPreference(PREF_MUTED_KEY, (val) => {
			if (val === "1") {
				soundEngine.muted = true;
				set({ isMuted: true });
			}
		});

		try {
			const authHeaders = buildAuthHeaders(tgContext);
			const [meRes, roomsRes] = await Promise.all([
				fetch("/api/me", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...authHeaders,
					},
					body: JSON.stringify({
						initData: tgContext.initDataRaw,
						fallbackUser: tgContext.fallbackUser,
					}),
				}),
				fetch("/api/rooms", { headers: authHeaders }),
			]);

			if (meRes.ok) {
				const meData = (await meRes.json()) as {
					profile: TelegramUserProfile;
					startParam: string | null;
					botUsername: string;
				};
				set({
					profile: meData.profile,
					botUsername: meData.botUsername || "RoyalLudoArenaBot",
				});

				// If launched with deep link ?room=..., tgWebAppStartParam, or start_param, auto-join!
				const deepLinkRoom = tgContext.startParam || meData.startParam;
				if (deepLinkRoom) {
					const normalizedRoom = deepLinkRoom.startsWith("room-")
						? deepLinkRoom.toLowerCase()
						: `room-${deepLinkRoom.toLowerCase()}`;
					get().joinRoom(normalizedRoom);
				}
			}

			if (roomsRes.ok) {
				const roomsData = (await roomsRes.json()) as {
					rooms: PublicRoomSummary[];
					leaderboard: TelegramUserProfile[];
				};
				set({
					rooms: roomsData.rooms || [],
					leaderboard: roomsData.leaderboard || [],
				});
			}
		} catch (err) {
			console.error("Bootstrap error:", err);
		} finally {
			set({ isLoadingLobby: false });
		}
	},

	refreshLobby: async () => {
		try {
			const tgContext = get().tgContext;
			const authHeaders = buildAuthHeaders(tgContext);
			const [roomsRes, meRes] = await Promise.all([
				fetch("/api/rooms", { headers: authHeaders }),
				fetch("/api/me", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...authHeaders,
					},
					body: JSON.stringify({
						initData: tgContext?.initDataRaw,
						fallbackUser: tgContext?.fallbackUser,
					}),
				}),
			]);
			if (roomsRes.ok) {
				const data = (await roomsRes.json()) as {
					rooms: PublicRoomSummary[];
					leaderboard: TelegramUserProfile[];
				};
				set({ rooms: data.rooms, leaderboard: data.leaderboard });
			}
			if (meRes.ok) {
				const meData = (await meRes.json()) as {
					profile: TelegramUserProfile;
				};
				set({ profile: meData.profile });
			}
		} catch {
			// Ignore transient error
		}
	},

	claimDailyBonus: async () => {
		const profile = get().profile;
		if (!profile) return;
		try {
			const tgContext = get().tgContext;
			const res = await fetch("/api/daily-reward", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...buildAuthHeaders(tgContext),
				},
				body: JSON.stringify({ userId: profile.id }),
			});
			if (res.ok) {
				const data = (await res.json()) as {
					claimed: boolean;
					rewardCoins: number;
					rewardGems: number;
					nextClaimAt?: number;
					profile: TelegramUserProfile | null;
				};
				if (data.profile) {
					set({ profile: data.profile });
				}
				if (data.claimed) {
					hapticNotification("success");
					soundEngine.playBonusSix();
					get().showToast(
						`🎁 Claimed +${data.rewardCoins} Coins & +${data.rewardGems} Gems!`,
					);
				} else if (data.nextClaimAt) {
					hapticNotification("warning");
					const hoursLeft = Math.max(
						1,
						Math.ceil((data.nextClaimAt - Date.now()) / (3600 * 1000)),
					);
					get().showToast(
						`⏳ Daily bonus already claimed! Next claim in ~${hoursLeft}h.`,
					);
				}
			}
		} catch {
			get().showToast("Could not claim reward right now");
		}
	},

	quickMatch: async (mode, maxPlayers) => {
		const profile = get().profile;
		const tgContext = get().tgContext;
		hapticImpact("medium");
		try {
			const res = await fetch("/api/matchmaking", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...buildAuthHeaders(tgContext),
				},
				body: JSON.stringify({
					mode,
					maxPlayers,
					hostName: profile?.firstName || "Royal Player",
				}),
			});
			if (res.ok) {
				const data = (await res.json()) as {
					roomId: string;
					roomCode: string;
				};
				get().joinRoom(data.roomId, {
					roomConfig: {
						mode,
						maxPlayers,
						name: `${profile?.firstName || "Royal"}'s ${mode.toUpperCase()} Arena`,
					},
				});
			}
		} catch {
			const fallbackCode = crypto.randomUUID().slice(0, 6).toUpperCase();
			get().joinRoom(`room-${fallbackCode.toLowerCase()}`, {
				roomConfig: { mode, maxPlayers },
			});
		}
	},

	joinRoom: (roomId, options) => {
		const prevSocket = get().socket;
		if (prevSocket) {
			prevSocket.close();
		}

		const normalizedId = roomId.startsWith("room-")
			? roomId.toLowerCase()
			: `room-${roomId.toLowerCase()}`;

		const tgContext = get().tgContext;
		const queryParams: Record<string, string> = {};
		if (tgContext?.initDataRaw) {
			queryParams.initData = tgContext.initDataRaw;
		} else if (tgContext?.fallbackUser?.id) {
			queryParams.guestId = tgContext.fallbackUser.id;
		}

		const socket = new PartySocket({
			host: window.location.host,
			party: "ludo-room",
			room: normalizedId,
			query: queryParams,
		});

		set({
			socket,
			activeView: "room",
			activeModal: null,
			isConnectedToRoom: false,
		});

		let autoStarted = false;

		socket.addEventListener("open", () => {
			set({ isConnectedToRoom: true });
			const profile = get().profile;
			const fallback = get().tgContext?.fallbackUser;

			const joinMsg: ClientToServerMessage = {
				type: "JOIN_ROOM",
				player: {
					id: profile?.id || fallback?.id || "guest-1001",
					telegramId: profile?.telegramId,
					name: profile?.firstName || fallback?.name || "Royal Commander",
					username: profile?.username || fallback?.username,
					avatarUrl: profile?.photoUrl || fallback?.photoUrl,
				},
				preferredColor: options?.preferredColor,
				roomConfig: options?.roomConfig,
			};
			socket.send(JSON.stringify(joinMsg));

			if (options?.autoStartVsBots && !autoStarted) {
				autoStarted = true;
				setTimeout(() => {
					socket.send(
						JSON.stringify({
							type: "START_GAME",
							fillWithBots: true,
						} satisfies ClientToServerMessage),
					);
				}, 350);
			}
		});

		socket.addEventListener("message", (evt) => {
			if (typeof evt.data !== "string") return;
			try {
				const msg = JSON.parse(evt.data) as ServerToClientMessage;
				const isLowPerf = get().tgContext?.performanceClass === "LOW";

				switch (msg.type) {
					case "ROOM_STATE": {
						const prevStatus = get().roomState?.status;
						set({ roomState: msg.state });
						if (prevStatus !== "finished" && msg.state.status === "finished") {
							soundEngine.playVictory();
							hapticNotification("success");
							void confetti({
								particleCount: isLowPerf ? 35 : 95,
								spread: 75,
								origin: { y: 0.6 },
							});
							void get().refreshLobby();
						}
						break;
					}
					case "DICE_ROLLED": {
						soundEngine.playDiceRoll();
						hapticImpact(msg.diceValue === 6 ? "heavy" : "light");
						if (msg.diceValue === 6 && !msg.forfeitedThreeSixes) {
							setTimeout(() => soundEngine.playBonusSix(), 180);
						}
						if (msg.forfeitedThreeSixes) {
							get().showToast("⚠️ Three 6s in a row! Turn forfeited!");
						}
						set({
							isDiceAnimating: true,
							lastRolledDice: msg.diceValue,
						});
						setTimeout(() => {
							set({ isDiceAnimating: false });
						}, 420);
						break;
					}
					case "TOKEN_MOVED": {
						const move = msg.move;
						const stepsCount = Math.max(1, move.pathCoords.length);
						for (let i = 0; i < Math.min(stepsCount, 6); i++) {
							setTimeout(() => {
								soundEngine.playTokenHop(i);
							}, i * 55);
						}
						if (move.capturedTokenId) {
							setTimeout(() => {
								soundEngine.playCapture();
								hapticNotification("warning");
							}, 180);
							get().showToast(
								`⚔️ ${move.playerName} captured ${move.capturedPlayerColor?.toUpperCase()}'s token! Bonus Turn!`,
							);
						} else if (move.reachedHome) {
							soundEngine.playBonusSix();
							hapticNotification("success");
							get().showToast(
								`👑 ${move.playerName} brought a token HOME! Bonus Turn!`,
							);
						}
						const prevStatus = get().roomState?.status;
						set({
							roomState: msg.state,
							recentMove: move,
						});
						if (prevStatus !== "finished" && msg.state.status === "finished") {
							soundEngine.playVictory();
							hapticNotification("success");
							void confetti({
								particleCount: isLowPerf ? 40 : 110,
								spread: 80,
								origin: { y: 0.55 },
							});
							void get().refreshLobby();
						}
						break;
					}
					case "EMOJI_BURST": {
						const item: EmojiBurstItem = {
							id: `${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
							senderName: msg.senderName,
							senderColor: msg.senderColor,
							emoji: msg.emoji,
							createdAt: Date.now(),
						};
						set((s) => ({
							emojiBursts: [...s.emojiBursts.slice(-6), item],
						}));
						setTimeout(() => {
							set((s) => ({
								emojiBursts: s.emojiBursts.filter((e) => e.id !== item.id),
							}));
						}, 2600);
						break;
					}
					case "ERROR": {
						hapticNotification("error");
						get().showToast(msg.message);
						break;
					}
				}
			} catch {
				// Ignore malformed frame
			}
		});

		socket.addEventListener("close", () => {
			set({ isConnectedToRoom: false });
		});
	},

	leaveRoom: () => {
		const socket = get().socket;
		if (socket) {
			try {
				socket.send(
					JSON.stringify({
						type: "LEAVE_SEAT",
					} satisfies ClientToServerMessage),
				);
			} catch {
				// Ignore
			}
			socket.close();
		}
		set({
			socket: null,
			roomState: null,
			activeView: "lobby",
			isConnectedToRoom: false,
		});
		void get().refreshLobby();
	},

	sendRoomAction: (msg) => {
		const socket = get().socket;
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			get().showToast("Reconnecting to arena...");
			return;
		}
		socket.send(JSON.stringify(msg));
	},
}));
