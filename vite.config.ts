import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	// 🟢 加上这一行！注意斜杠不能少，中间填你的仓库名
  base: '/Picture-library/',
})
