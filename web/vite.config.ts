import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Phaser works best if you don't minify the assets excessively
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: 3000,
  },
});
