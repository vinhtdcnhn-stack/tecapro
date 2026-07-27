import { useState, useEffect, useCallback } from 'react'
import { API } from '../../config/api'
import { withStamp, handledConflict } from './conflict'

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

// Các đợt thanh toán đã gắn vào một khoản phải trả (dòng mới bám theo _payKey vì khoản
// có thể chưa có id thật khi vừa thêm).
export const paymentsOf = (payRows, payableRow) => payRows.filter(p =>
  p._isNew ? p._payableKey === payableRow._key : String(p.payable_id ?? '') === String(payableRow.id)
)

// Lưu 1 đợt thanh toán (thêm mới hoặc sửa). Dùng chung cho bảng lồng, mục "chưa gắn" và mobile.
export async function savePaymentRow(row, contractInId, setPayRows, reload) {
  setPayRows(prev => prev.map(p => p._key === row._key ? { ...p, _saving: true } : p))
  const body = {
    payment_date: row.payment_date, currency_code: row.currency_code,
    amount: row.amount, exchange_rate: row.exchange_rate,
    payment_ratio: row.payment_ratio, note: row.note,
    payable_id: row.payable_id ?? null,
  }
  try {
    const url    = row._isNew ? `${API}/contract-ins/${contractInId}/payments` : `${API}/payments/${row.id}`
    const method = row._isNew ? 'POST' : 'PUT'
    const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(withStamp(body, row)) })
    const saved  = await res.json()
    if (await handledConflict(res, saved, reload)) return
    if (!res.ok) throw new Error(saved.error || 'Save failed')
    setPayRows(prev => prev.map(p => p._key === row._key
      ? { ...saved, _key: row._key, _dirty: false, _isNew: false, _saving: false } : p))
  } catch (e) {
    alert('Lỗi: ' + e.message)
    setPayRows(prev => prev.map(p => p._key === row._key ? { ...p, _saving: false } : p))
  }
}

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toLocal là mapper thuần (tạo mới mỗi render); cố ý ngoài deps để load chỉ chạy lại khi url đổi
  }, [url])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() là async: setState xảy ra SAU await, không phải cascade đồng bộ
  useEffect(() => { load() }, [load])
  return { rows, setRows, loading, reload: load }
}
