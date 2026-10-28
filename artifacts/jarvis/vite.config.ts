import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { transform as lightningTransform } from "lightningcss";

/**
 * Compatibilidad legacy para WebViews de Android viejos (Chromium < 99):
 * Tailwind v4 emite todo dentro de `@layer` y usa oklch()/color-mix().
 * Los WebViews antiguos descartan los bloques @layer ENTEROS, con lo que
 * la hoja completa queda muerta (HTML sin estilos). Este plugin:
 *  1. Desenrolla los bloques @layer y elimina las declaraciones de lista.
 *  2. Baja oklch()/color-mix()/nesting a sintaxis clásica con lightningcss.
 */
function legacyCssCompat(): Plugin {
  const unwrapLayerBlocks = (css: string): string => {
    // Elimina declaraciones de lista: @layer theme, base, ...;
    let out = css.replace(/@layer[^{;{}]*;/g, "");
    // Desenrolla @layer ident[, ident]* { ... } conservando el interior.
    let guard = 0;
    let changed = true;
    while (changed && guard < 64) {
      guard += 1;
      changed = false;
      const start = out.search(/@layer[\s]*[a-zA-Z][\w-]*(\s*,\s*[a-zA-Z][\w-]*)*\s*\{/);
      if (start === -1) break;
      const braceAt = out.indexOf("{", start);
      if (braceAt === -1) break;
      // Encuentra la llave de cierre equivalente
      let depth = 0;
      let end = -1;
      for (let i = braceAt; i < out.length; i++) {
        const ch = out[i];
        if (ch === "{") depth += 1;
        else if (ch === "}") {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end === -1) break;
      const inner = out.slice(braceAt + 1, end);
      out = out.slice(0, start) + inner + out.slice(end + 1);
      changed = true;
    }
    return out;
  };

  return {
    name: "legacy-css-compat",
    enforce: "post",
    generateBundle(_, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === "asset" && file.fileName.endsWith(".css")) {
          try {
            const source = file.source.toString();
            let css = unwrapLayerBlocks(source);
            // lightningcss: baja oklch/color-mix()/nesting a sintaxis clásica.
            const lowered = lightningTransform({
              code: Buffer.from(css),
              minify: false,
              errorRecovery: true,
              targets: { android: 61 << 16 },
            });
            css = lowered.code.toString();
            file.source = css;
          } catch (err) {
            console.warn("[legacy-css-compat] falló transform:", err);
          }
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    legacyCssCompat(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5173,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
