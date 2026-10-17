import { defineConfig } from 'vite';

export default defineConfig({
  build: { target: 'esnext' },           // onnxruntime-web memakai top-level await / WASM modern
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  server: { port: 5173,
    host: true,          // supaya bisa diakses dari luar localhost
       allowedHosts: true  // untuk pengujian; batasi ke host tertentu saat dipakai sungguhan
   },
});


