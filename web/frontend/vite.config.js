import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const frontendHost = new URL(env.VITE_FRONTEND_DOMAIN).host
  const backendHost = new URL(env.VITE_BACKEND_DOMAIN).host

  return {
    plugins: [react()],
    server: {
      host: true,
      allowedHosts: [frontendHost, backendHost]
    }
  }
})