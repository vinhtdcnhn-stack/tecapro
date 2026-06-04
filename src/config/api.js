export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5174').replace(/\/$/, '')
export const API = API_BASE + '/api'
