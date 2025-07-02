import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default ({ mode }: { mode: string }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return defineConfig({
    build: {
      outDir: 'build',
    },
    server: {
      port: 3000,
    },
    plugins: [react()],
    define: {
      'process.env': JSON.stringify(env),
    },
  });
};
