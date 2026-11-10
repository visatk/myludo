import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	build: {
		chunkSizeWarningLimit: 700,
	},
	plugins: [
		react(),
		tailwindcss(),
		cloudflare(),
	],
});
