import { useState, useEffect, useCallback } from 'react'
import { API } from '../../config/api'
import { withStamp, handledConflict } from './conflict'
import { daysUntil, daysBetween } from '../../lib/dateOnly'

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

// Trạng thái + màu của một KHOẢN PHẢI TRẢ, dựa vào tiến độ trả thực tế & thời hạn.
// Đối xứng với receivableStatus của công nợ HĐ bán:
//  - Còn thiếu <= 0 (đã trả đủ): so thời hạn trả với NGÀY TRẢ gần nhất (trả sau hạn → trễ).
//  - Còn thiếu  > 0 (chưa đủ):   so thời hạn trả với NGÀY HIỆN TẠI.
// So sánh trên GIÁ TRỊ GỐC (nguyên tệ của khoản), không dựa vào quy đổi VNĐ.
export function payableStatus(row, linkedPayments = []) {
  const dueAmt = parseFloat(row.amount) || 0
  if (dueAmt <= 0) return null

  const paid     = linkedPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const shortage = dueAmt - paid
  const dueStr   = row.due_date || null
  const left     = dueStr ? daysUntil(dueStr) : null   // âm = đã qua hạn

  if (shortage <= 0) {
    const dates  = linkedPayments.map(p => p.payment_date).filter(Boolean).sort()
    const latest = dates.length ? dates[dates.length - 1] : null
    const late   = (dueStr && latest) ? daysBetween(dueStr, latest) : 0
    if (late > 0)
      return { key: 'paid-late', label: `Đã trả đủ · trễ ${late} ngày`, color: 'amber' }
    return { key: 'paid', label: 'Đã trả đủ', color: 'green' }
  }

  if (left !== null && left < 0) {
    const days = -left
    return paid > 0
      ? { key: 'overdue-partial', label: `Quá hạn ${days} ngày · trả một phần`, color: 'red' }
      : { key: 'overdue', label: `Quá hạn ${days} ngày`, color: 'red' }
  }
  if (paid > 0) return { key: 'partial', label: 'Đang trả', color: 'blue' }
  return { key: 'pending', label: 'Chưa đến hạn', color: 'gray' }
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
