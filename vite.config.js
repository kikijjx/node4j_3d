import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/nodes': 'http://localhost:8000',
    }
  }
});
