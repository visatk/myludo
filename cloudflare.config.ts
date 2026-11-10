import { bindings, defineConfig, exports } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig((ctx) => ({
	worker: {
		name: "myludo",
		compatibilityDate: "2026-11-10",
		entrypoint,
		placement: {
			mode: "smart",
		},
		observability: {
			enabled: true,
			logs: {
				enabled: true,
				invocationLogs: true,
			},
			traces: {
				enabled: true,
			},
		},
		assets: {
			htmlHandling: "auto-trailing-slash",
			notFoundHandling: "single-page-application",
			runWorkerFirst: ["/api/*", "/parties/*"],
		},
		exports: {
			LudoRoom: exports.durableObject({ storage: "sqlite" }),
			MatchmakingCoordinator: exports.durableObject({ storage: "sqlite" }),
		},
		env: {
			ASSETS: bindings.assets(),
			LudoRoom: bindings.durableObject({
				worker: "myludo",
				exportName: "LudoRoom",
			}),
			MatchmakingCoordinator: bindings.durableObject({
				worker: "myludo",
				exportName: "MatchmakingCoordinator",
			}),
			APP_NAME: bindings.text("Royal Ludo Arena • TMA"),
			TELEGRAM_BOT_USERNAME: bindings.text("RoyalLudoArenaBot"),
			APIRONE_ACCOUNT_ID: bindings.text("apr-f9e1211f4b52a50bcf3c36819fdc4ad3"),
			ALLOW_GUEST_MODE: bindings.text(ctx.mode === "production" ? "false" : "true"),
			TELEGRAM_BOT_TOKEN: bindings.secret(),
			APIRONE_TRANSFER_KEY: bindings.secret(),
			APIRONE_CALLBACK_SECRET: bindings.secret(),
		},
	},
}));
