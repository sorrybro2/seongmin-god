import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages(https://sorrybro2.github.io/seongmin-god/) 하위 경로에서도 동작하도록 상대 경로로 빌드
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
});
