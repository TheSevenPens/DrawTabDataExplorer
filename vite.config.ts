import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      "$data": path.resolve(__dirname, "data-repo"),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname)],
    },
  },
});
