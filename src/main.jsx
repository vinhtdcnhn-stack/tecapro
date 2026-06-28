import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './config/fetchSetup' // phải chạy trước mọi lời gọi fetch
import { loadBrand } from './config/brand' // nạp logo/màu riêng của doanh nghiệp
import { queryClient } from './lib/queryClient' // cache dữ liệu phía client (TanStack Query)
import { AuthProvider } from './context/AuthContext'
import './index.css'
import App from './App.jsx'

// Nạp nhận diện thương hiệu (màu + logo + tên) TRƯỚC khi render để tránh chớp
// màu/logo mặc định. Lỗi/thiếu brand.json vẫn render bình thường với mặc định.
loadBrand().finally(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  )
})
