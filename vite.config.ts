import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `npm run dev:phone` serves over https on your network. Card encryption uses
// Web Crypto, which browsers only expose on https:// or localhost.
export default defineConfig(({ mode }) => ({
  // Relative asset paths, so the build works from any sub-path (e.g. GitHub Pages' /finn/).
  base: "./",
  plugins: [react(), ...(mode === "phone" ? [basicSsl()] : [])],
}));
