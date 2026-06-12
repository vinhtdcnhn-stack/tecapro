import { useState, useEffect, useCallback } from 'react'

// Hằng số & helper dùng chung cho tab "Phải trả / Thanh toán" của hợp đồng nhập.

export const CURRENCIES      = ['VND', 'USD', 'EUR', 'JPY', 'SGD', 'CNY', 'GBP']
export const PAYMENT_METHODS = ['TT', 'L/C', 'D/P', 'D/A', 'TTR', 'Khác']

export const fmtVND = (n) => {
  const num = parseFloat(n) || 0
  return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: num % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 }).format(num)
}

// Quy đổi VNĐ: nguyên tệ × tỷ giá (VND giữ nguyên). Chỉ để hiển thị/tổng VNĐ.
export function calcVND(amount, rate, currency) {
  const a = parseFloat(amount) || 0
  const r = parseFloat(rate)   || 1
  return currency === 'VND' ? a : a * r
}

export function isOverdue(dueDate) {
  if (!dueDate) return false
  return new Date(dueDate) < new Date(new Date().toDateString())
}

let _ctr = 0
export const tmpId = () => `tmp_${++_ctr}`

// Loader cho bảng inline-edit: fetch URL → map về dạng local row.
export function useRows(url, toLocal) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    try {
      const res  = await fetch(url)
      const data = await res.json()
      setRows((Array.isArray(data) ? data : []).map(toLocal))
    } catch (e) { console.error('load:', e) }
    finally { setLoading(false) }
  }, [url])
  useEffect(() => { load() }, [load])
  return { rows, setRows, loading, reload: load }
}
