import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/margo-dashboard/', // podmień, jeśli repo będzie się nazywać inaczej
});
