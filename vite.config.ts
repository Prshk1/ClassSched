import { defineConfig, type ConfigEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import * as path from "path";
import { fileURLToPath } from "url";
import { componentTagger } from "lovable-tagger";

// create __dirname in ESM (Node + TS using import.meta.url)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig((env: ConfigEnv) => {
  const { mode } = env;

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      // only include the tagger during development
      mode === "development" ? componentTagger() : undefined,
    ].filter(Boolean) as any[], // cast to any[] to satisfy TS plugin typing
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});