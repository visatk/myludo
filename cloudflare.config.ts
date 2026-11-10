import { bindings, defineConfig } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig({
	worker: {
		name: "myludo",
		compatibilityDate: "2026-11-04",
		entrypoint,
		env: {
			WORLD: bindings.text("World"),
		},
	},
});
