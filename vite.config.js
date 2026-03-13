import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig(function (_a) {
    var mode = _a.mode;
    return ({
        // GitHub Pages (concept-book) 配下では /concept-book/ で配信される。
        base: mode === "production" ? "/concept-book/" : "/",
        plugins: [
            react(),
            VitePWA({
                registerType: "autoUpdate",
                includeAssets: ["icons/icon-192.svg", "icons/icon-512.svg"],
                manifest: {
                    name: "Concept Book App",
                    short_name: "ConceptBook",
                    description: "研究者向けの静かな概念辞典アプリ",
                    theme_color: "#1f2937",
                    background_color: "#f8fafc",
                    display: "standalone",
                    start_url: "./",
                    scope: "./",
                    icons: [
                        {
                            src: "icons/icon-192.svg",
                            sizes: "192x192",
                            type: "image/svg+xml",
                            purpose: "any"
                        },
                        {
                            src: "icons/icon-512.svg",
                            sizes: "512x512",
                            type: "image/svg+xml",
                            purpose: "any maskable"
                        }
                    ]
                },
                workbox: {
                    globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"]
                }
            })
        ]
    });
});
