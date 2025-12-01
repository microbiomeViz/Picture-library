import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 🟢 核心配置：使用相对路径 './'，确保 GitHub Pages 能找到文件
  base: './', 
  build: {
    // 防止压缩过度导致报错
    minify: false, 
    // 强制输出文件名格式，避免下划线被拦截
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks: {
          vendor: ['react', 'react-dom', 'tldraw']
        }
      }
    }
  }
})