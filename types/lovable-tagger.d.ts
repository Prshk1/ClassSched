// Add this file if 'lovable-tagger' doesn't ship types. Put it in your project (e.g. /types or /src/types).
declare module "lovable-tagger" {
  import type { Plugin } from "vite";
  export function componentTagger(): Plugin;
}