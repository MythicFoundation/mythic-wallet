import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';

function chromeExtensionPlugin(): Plugin {
  return {
    name: 'chrome-extension',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');

      // Copy manifest.json
      copyFileSync(
        resolve(__dirname, 'manifest.json'),
        resolve(distDir, 'manifest.json'),
      );

      // Move public/popup.html to root of dist and fix asset paths
      const nestedPopup = resolve(distDir, 'public', 'popup.html');
      const rootPopup = resolve(distDir, 'popup.html');
      if (existsSync(nestedPopup)) {
        let html = readFileSync(nestedPopup, 'utf-8');
        // Fix relative paths: ../assets/ -> ./assets/ since we move up one level
        html = html.replace(/\.\.\/assets\//g, './assets/');
        writeFileSync(rootPopup, html);
      }

      // Copy icon SVGs to dist/icons/
      const iconsDir = resolve(distDir, 'icons');
      if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true });
      const srcIcons = resolve(__dirname, 'public', 'icons');
      if (existsSync(srcIcons)) {
        for (const file of readdirSync(srcIcons)) {
          copyFileSync(resolve(srcIcons, file), resolve(iconsDir, file));
        }
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), chromeExtensionPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'public/popup.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') return 'background.js';
          if (chunk.name === 'content') return 'content.js';
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
});
