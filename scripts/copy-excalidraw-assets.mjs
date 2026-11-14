// Self-host Excalidraw's fonts so diagrams never depend on a public CDN at runtime.
// Runs automatically before `npm run dev` and `npm run build`.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const src = join(process.cwd(), "node_modules/@excalidraw/excalidraw/dist/prod/fonts");
const dest = join(process.cwd(), "public/excalidraw-assets/fonts");

if (!existsSync(src)) {
  console.warn("[excalidraw-assets] fonts not found, skipping (is @excalidraw/excalidraw installed?)");
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log("[excalidraw-assets] copied fonts to public/excalidraw-assets/fonts");
