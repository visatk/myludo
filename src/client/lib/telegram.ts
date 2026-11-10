import { retrieveLaunchParams } from "@tma.js/sdk-react";

export interface TelegramServerlessError extends Error {
	type?: string;
	status?: number;
	parameters?: Record<string, unknown>;
}

export interface SafeAreaInset {
	top: number;
	bottom: number;
	left: number;
	right: number;
}

export interface TelegramBottomButton {
	type?: "main" | "secondary";
	text?: string;
	color?: string;
	textColor?: string;
	isVisible?: boolean;
	isActive?: boolean;
	hasShineEffect?: boolean;
	position?: "left" | "right" | "top" | "bottom";
	isProgressVisible?: boolean;
	iconCustomEmojiId?: string;
	setText: (text: string) => TelegramBottomButton;
	onClick: (cb: () => void) => TelegramBottomButton;
	offClick: (cb: () => void) => TelegramBottomButton;
	show: () => TelegramBottomButton;
	hide: () => TelegramBottomButton;
	enable: () => TelegramBottomButton;
	disable: () => TelegramBottomButton;
	showProgress: (leaveActive?: boolean) => TelegramBottomButton;
	hideProgress: () => TelegramBottomButton;
	setParams: (params: {
		icon_custom_emoji_id?: string;
		text?: string;
		color?: string;
		text_color?: string;
		has_shine_effect?: boolean;
		position?: "left" | "right" | "top" | "bottom";
		is_active?: boolean;
		is_visible?: boolean;
	}) => TelegramBottomButton;
}

declare global {
	interface Window {
		Telegram?: {
			WebApp?: {
				initData?: string;
				initDataUnsafe?: {
					query_id?: string;
					chat_join_request_query_id?: string;
					user?: {
						id: number;
						first_name: string;
						last_name?: string;
						username?: string;
						language_code?: string;
						is_premium?: boolean;
						allows_write_to_pm?: boolean;
						photo_url?: string;
					};
					chat_type?: "sender" | "private" | "group" | "supergroup" | "channel";
					chat_instance?: string;
					start_param?: string;
					auth_date?: number;
				};
				platform?: string;
				version?: string;
				colorScheme?: "light" | "dark";
				isActive?: boolean;
				isExpanded?: boolean;
				isFullscreen?: boolean;
				isOrientationLocked?: boolean;
				isClosingConfirmationEnabled?: boolean;
				isVerticalSwipesEnabled?: boolean;
				viewportHeight?: number;
				viewportStableHeight?: number;
				safeAreaInset?: SafeAreaInset;
				contentSafeAreaInset?: SafeAreaInset;
				isVersionAtLeast?: (version: string) => boolean;
				ready?: () => void;
				expand?: () => void;
				close?: () => void;
				setHeaderColor?: (color: string) => void;
				setBackgroundColor?: (color: string) => void;
				setBottomBarColor?: (color: string) => void;
				enableClosingConfirmation?: () => void;
				disableClosingConfirmation?: () => void;
				enableVerticalSwipes?: () => void;
				disableVerticalSwipes?: () => void;
				requestFullscreen?: () => void;
				exitFullscreen?: () => void;
				lockOrientation?: () => void;
				unlockOrientation?: () => void;
				addToHomeScreen?: () => void;
				checkHomeScreenStatus?: (
					callback?: (
						status: "unsupported" | "unknown" | "added" | "missed",
					) => void,
				) => void;
				hideKeyboard?: () => void;
				openTelegramLink?: (url: string) => void;
				openLink?: (
					url: string,
					options?: { try_instant_view?: boolean },
				) => void;
				showPopup?: (
					params: {
						title?: string;
						message: string;
						buttons?: Array<{
							id?: string;
							type?: "default" | "ok" | "close" | "cancel" | "destructive";
							text?: string;
						}>;
					},
					callback?: (buttonId: string) => void,
				) => void;
				showConfirm?: (
					message: string,
					callback?: (confirmed: boolean) => void,
				) => void;
				onEvent?: (
					eventType: string,
					handler: (...args: unknown[]) => void,
				) => void;
				offEvent?: (
					eventType: string,
					handler: (...args: unknown[]) => void,
				) => void;
				BackButton?: {
					isVisible?: boolean;
					onClick: (cb: () => void) => void;
					offClick: (cb: () => void) => void;
					show: () => void;
					hide: () => void;
				};
				MainButton?: TelegramBottomButton;
				SecondaryButton?: TelegramBottomButton;
				SettingsButton?: {
					isVisible?: boolean;
					onClick: (cb: () => void) => void;
					offClick: (cb: () => void) => void;
					show: () => void;
					hide: () => void;
				};
				HapticFeedback?: {
					impactOccurred?: (
						style: "light" | "medium" | "heavy" | "rigid" | "soft",
					) => void;
					notificationOccurred?: (
						type: "error" | "success" | "warning",
					) => void;
					selectionChanged?: () => void;
				};
				DeviceStorage?: {
					setItem?: (
						key: string,
						value: string,
						cb?: (err: Error | null, stored?: boolean) => void,
					) => void;
					getItem?: (
						key: string,
						cb: (err: Error | null, value?: string | null) => void,
					) => void;
					removeItem?: (
						key: string,
						cb?: (err: Error | null, removed?: boolean) => void,
					) => void;
					clear?: (cb?: (err: Error | null, cleared?: boolean) => void) => void;
				};
				CloudStorage?: {
					setItem?: (
						key: string,
						value: string,
						cb?: (err: Error | null, stored?: boolean) => void,
					) => void;
					getItem?: (
						key: string,
						cb: (err: Error | null, value?: string | null) => void,
					) => void;
				};
				Serverless?: {
					call?: (
						name: string,
						inputOrCallback?:
							| Record<string, unknown>
							| ((err: TelegramServerlessError | null, result?: unknown) => void),
						callback?: (
							err: TelegramServerlessError | null,
							result?: unknown,
						) => void,
					) => void;
				};
			};
		};
	}
}

export type DevicePerformanceClass = "LOW" | "AVERAGE" | "HIGH";

export interface ClientTelegramContext {
	initDataRaw: string;
	isTelegramEnv: boolean;
	platform: string;
	version: string;
	colorScheme: "light" | "dark";
	startParam: string | null;
	performanceClass: DevicePerformanceClass;
	fallbackUser: {
		id: string;
		name: string;
		username: string;
		photoUrl?: string;
	};
}

export function getTelegramWebApp(): NonNullable<Window["Telegram"]>["WebApp"] | undefined {
	return typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
}

const STORAGE_GUEST_KEY = "myludo_guest_identity_v1";

/**
 * Parses Android User-Agent performance class per:
 * https://core.telegram.org/bots/webapps#additional-data-in-user-agent
 * Format: `Telegram-Android/{app_version} ({manufacturer} {model}; Android {android_version}; SDK {sdk_version}; {performance_class})`
 */
export function detectDevicePerformanceClass(): DevicePerformanceClass {
	if (typeof navigator === "undefined") return "HIGH";
	const ua = navigator.userAgent || "";
	const match = /Telegram-Android\/[^\s]+\s*\([^)]*;\s*(LOW|AVERAGE|HIGH)\)/i.exec(
		ua,
	);
	if (match?.[1]) {
		return match[1].toUpperCase() as DevicePerformanceClass;
	}
	return "HIGH";
}

function getOrCreateBrowserGuest(): {
	id: string;
	name: string;
	username: string;
} {
	try {
		const raw = localStorage.getItem(STORAGE_GUEST_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as {
				id?: string;
				name?: string;
				username?: string;
			};
			if (parsed?.id && parsed?.name && parsed?.username) {
				// Ensure id begins with guest- for clean server guest validation
				const normalizedId = parsed.id.startsWith("guest-")
					? parsed.id
					: `guest-${parsed.id.replace(/\D/g, "") || "1001"}`;
				return {
					id: normalizedId,
					name: parsed.name,
					username: parsed.username,
				};
			}
		}
	} catch {
		// Ignore storage error
	}
	const arr = new Uint32Array(1);
	crypto.getRandomValues(arr);
	const randomNum = 1000 + (arr[0] % 9000);
	const titles = ["Commander", "Grandmaster", "Striker", "Paladin", "Monarch"];
	const title = titles[randomNum % titles.length];
	const guest = {
		id: `guest-${randomNum}`,
		name: `${title} #${randomNum}`,
		username: `ludo_${randomNum}`,
	};
	try {
		localStorage.setItem(STORAGE_GUEST_KEY, JSON.stringify(guest));
	} catch {
		// Ignore
	}
	return guest;
}

/**
 * Persistent storage helper that prefers Telegram Bot API 9.0 `DeviceStorage`
 * (up to 5 MB per user), falls back to Bot API 6.9 `CloudStorage`, and finally `localStorage`.
 */
export function setPersistentPreference(key: string, value: string): void {
	const webApp = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
	try {
		if (webApp?.isVersionAtLeast?.("9.0") && webApp.DeviceStorage?.setItem) {
			webApp.DeviceStorage.setItem(key, value);
		} else if (
			webApp?.isVersionAtLeast?.("6.9") &&
			webApp.CloudStorage?.setItem
		) {
			webApp.CloudStorage.setItem(key, value);
		}
	} catch {
		// Ignore Telegram storage error
	}
	try {
		localStorage.setItem(key, value);
	} catch {
		// Ignore localStorage error
	}
}

export function getPersistentPreference(
	key: string,
	callback: (value: string | null) => void,
): void {
	const webApp = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
	try {
		if (webApp?.isVersionAtLeast?.("9.0") && webApp.DeviceStorage?.getItem) {
			webApp.DeviceStorage.getItem(key, (err, val) => {
				if (!err && typeof val === "string") {
					callback(val);
					return;
				}
				try {
					callback(localStorage.getItem(key));
				} catch {
					callback(null);
				}
			});
			return;
		}
	} catch {
		// Fall through
	}
	try {
		callback(localStorage.getItem(key));
	} catch {
		callback(null);
	}
}

/**
 * Calls a Telegram Serverless endpoint (`Telegram.WebApp.Serverless.call`) when hosted on
 * `*.tgcloud.ai`, or transparently invokes the Cloudflare Worker `/api/<name>` endpoint.
 */
export async function callTelegramServerless<TResult = unknown>(
	name: string,
	input: Record<string, unknown>,
	ctx: ClientTelegramContext | null,
): Promise<TResult> {
	const webApp = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
	if (
		webApp?.Serverless?.call &&
		typeof window !== "undefined" &&
		window.location.hostname.endsWith(".tgcloud.ai")
	) {
		return new Promise<TResult>((resolve, reject) => {
			webApp.Serverless!.call!(name, input, (err, result) => {
				if (err) {
					reject(err);
				} else {
					resolve(result as TResult);
				}
			});
		});
	}

	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (ctx?.initDataRaw) {
		headers["x-telegram-init-data"] = ctx.initDataRaw;
	}
	if (ctx?.fallbackUser?.id) {
		headers["x-ludo-guest-id"] = ctx.fallbackUser.id;
	}

	const res = await fetch(`/api/${encodeURIComponent(name)}`, {
		method: "POST",
		headers,
		body: JSON.stringify({
			...input,
			initData: ctx?.initDataRaw || undefined,
			fallbackUser: ctx?.fallbackUser,
		}),
	});
	if (!res.ok) {
		const errBody = (await res.json().catch(() => ({}))) as {
			message?: string;
		};
		throw new Error(errBody.message || `Endpoint ${name} failed (${res.status})`);
	}
	return (await res.json()) as TResult;
}

export function initTelegramMiniApp(): ClientTelegramContext {
	const webApp = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
	const performanceClass = detectDevicePerformanceClass();

	// Signal readiness and configure viewport in Telegram WebApp
	try {
		webApp?.ready?.();
		webApp?.expand?.();
		webApp?.setHeaderColor?.("#090d1a");
		webApp?.setBackgroundColor?.("#090d1a");
		if (webApp?.isVersionAtLeast?.("7.10")) {
			webApp?.setBottomBarColor?.("#090d1a");
		}
		if (webApp?.isVersionAtLeast?.("7.7")) {
			webApp?.disableVerticalSwipes?.();
		}
	} catch {
		// Safe outside Telegram
	}

	const urlParams = new URLSearchParams(window.location.search);
	const urlRoom =
		urlParams.get("tgWebAppStartParam") ||
		urlParams.get("room") ||
		urlParams.get("startapp");

	// Try @tma.js/sdk-react retrieveLaunchParams first
	try {
		const launchParams = retrieveLaunchParams() as {
			initDataRaw?: string;
			platform?: string;
			version?: string;
			initData?: {
				startParam?: string;
				user?: {
					id: number;
					firstName?: string;
					lastName?: string;
					username?: string;
					photoUrl?: string;
				};
			};
		};
		if (
			launchParams &&
			typeof launchParams.initDataRaw === "string" &&
			launchParams.initDataRaw
		) {
			const user = launchParams.initData?.user;
			const colorScheme = webApp?.colorScheme === "light" ? "light" : "dark";
			return {
				initDataRaw: launchParams.initDataRaw,
				isTelegramEnv: true,
				platform: String(
					launchParams.platform || webApp?.platform || "tdesktop",
				),
				version: String(launchParams.version || webApp?.version || "8.0"),
				colorScheme,
				startParam:
					launchParams.initData?.startParam ||
					webApp?.initDataUnsafe?.start_param ||
					urlRoom ||
					null,
				performanceClass,
				fallbackUser: {
					id: user ? `tg-${user.id}` : getOrCreateBrowserGuest().id,
					name: user
						? [user.firstName, user.lastName].filter(Boolean).join(" ")
						: getOrCreateBrowserGuest().name,
					username: user?.username || "tg_player",
					photoUrl: user?.photoUrl,
				},
			};
		}
	} catch {
		// Not launched with @tma.js URL hash params; inspect window.Telegram.WebApp next
	}

	if (webApp?.initData && webApp.initData.length > 0) {
		const u = webApp.initDataUnsafe?.user;
		return {
			initDataRaw: webApp.initData,
			isTelegramEnv: true,
			platform: webApp.platform || "telegram",
			version: webApp.version || "8.0",
			colorScheme: webApp.colorScheme === "light" ? "light" : "dark",
			startParam: webApp.initDataUnsafe?.start_param || urlRoom || null,
			performanceClass,
			fallbackUser: {
				id: u ? `tg-${u.id}` : getOrCreateBrowserGuest().id,
				name: u
					? [u.first_name, u.last_name].filter(Boolean).join(" ")
					: getOrCreateBrowserGuest().name,
				username: u?.username || "tg_player",
				photoUrl: u?.photo_url,
			},
		};
	}

	const guest = getOrCreateBrowserGuest();
	return {
		initDataRaw: "",
		isTelegramEnv: false,
		platform: "web",
		version: webApp?.version || "8.0",
		colorScheme: "dark",
		startParam: urlRoom || null,
		performanceClass,
		fallbackUser: guest,
	};
}

export function hapticImpact(
	style: "light" | "medium" | "heavy" | "rigid" | "soft" = "medium",
): void {
	try {
		window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(style);
	} catch {
		// Ignore
	}
}

export function hapticNotification(
	type: "error" | "success" | "warning",
): void {
	try {
		window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(type);
	} catch {
		// Ignore
	}
}

export function hapticSelection(): void {
	try {
		window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
	} catch {
		// Ignore
	}
}

export function toggleTelegramFullscreen(): boolean {
	const webApp = window.Telegram?.WebApp;
	try {
		if (webApp?.isVersionAtLeast?.("8.0")) {
			if (webApp.isFullscreen) {
				webApp.exitFullscreen?.();
				return false;
			}
			webApp.requestFullscreen?.();
			return true;
		}
	} catch {
		// Ignore
	}
	return false;
}

export function promptAddToHomeScreen(): void {
	const webApp = window.Telegram?.WebApp;
	try {
		if (webApp?.isVersionAtLeast?.("8.0") && webApp.addToHomeScreen) {
			webApp.addToHomeScreen();
		}
	} catch {
		// Ignore
	}
}

export function shareTelegramRoomInvite(params: {
	roomCode: string;
	roomId: string;
	botUsername?: string;
}): { sharedViaTelegram: boolean; inviteUrl: string } {
	const origin = window.location.origin;
	const startParam = `room-${params.roomCode.toLowerCase()}`;
	// Support both Main Mini App deep link (`https://t.me/<botUsername>?startapp=<room>`)
	// per https://core.telegram.org/bots/webapps#launching-the-main-mini-app and web fallback URL.
	const inviteUrl = params.botUsername
		? `https://t.me/${params.botUsername}?startapp=${encodeURIComponent(startParam)}`
		: `${origin}/?room=${encodeURIComponent(params.roomId)}`;
	const text = `🎲 Join my Royal Ludo Arena match! Room Code: ${params.roomCode} — Winner takes the prize pool! 🏆`;
	const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(text)}`;

	if (window.Telegram?.WebApp?.openTelegramLink && params.botUsername) {
		try {
			window.Telegram.WebApp.openTelegramLink(tgShareUrl);
			return { sharedViaTelegram: true, inviteUrl };
		} catch {
			// Fall back to clipboard
		}
	}

	try {
		void navigator.clipboard.writeText(`${text}\n${inviteUrl}`);
	} catch {
		// Ignore
	}
	return { sharedViaTelegram: false, inviteUrl };
}
