import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: '../src/http',
    emptyOutDir: false,
  },
  server: {
    proxy: {
      '/debug/events': 'http://localhost:3142',
    },
  },
});
