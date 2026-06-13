import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Tách runtime React ra chunk riêng, ổn định giữa các lần deploy
        // → trình duyệt cache lại được + tải song song với code ứng dụng.
        // (Vite 8 / rolldown yêu cầu manualChunks là hàm, không phải object.)
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'react-vendor'
          }
        },
      },
    },
  },
  server: {
    historyApiFallback: true,
  },
})
