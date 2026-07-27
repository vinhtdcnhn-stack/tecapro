import { useState, useEffect, useCallback } from 'react'
import { API } from '../../config/api'
import { withStamp, handledConflict } from './conflict'

// Shared constants, formatters, calculators & data hook for the receivable tab.

export const CURRENCIES = ['VND', 'USD', 'EUR', 'JPY', 'SGD', 'CNY', 'GBP', 'AUD', 'KRW']

export const fmtVND  = (n) => { const num = parseFloat(n) || 0; return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: num % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 }).format(num) }
export const fmtAmt  = (n, cur) => { const num = parseFloat(n) || 0; return cur === 'VND' ? fmtVND(num) : new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(num) }
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'
export const fmtNum  = (n, dec = 2) => (parseFloat(n) || 0).toLocaleString('vi-VN', { maximumFractionDigits: dec })

export function calcVND(amount, rate, currency) {
  const a = parseFloat(amount) || 0
  const r = parseFloat(rate)   || 1
  return currency === 'VND' ? a : a * r
}

export function isOverdue(dueDate) {
  if (!dueDate) return false
  return new Date(dueDate) < new Date(new Date().toDateString())
}

const addDays = (isoDate, n) => {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// Thời hạn thu hiệu lực của một khoản: tính động theo biên bản nếu có chọn mốc gốc,
// giống "Ngày dự kiến" ở tab Tiến độ theo biên bản. Ngược lại lấy ngày nhập tay (due_date).
//   - due_base_anchor='contract' → ngày ký HĐ + due_offset_days
//   - due_base_bb_type_id       → ngày biên bản gốc (bbDateMap) + due_offset_days
//   - không chọn mốc            → due_date (nhập tay)
// Trả về yyyy-mm-dd hoặc null (mốc gốc chưa có ngày / thiếu offset → null).
export function resolveDueDate(row, { bbDateMap = {}, contractDate = null } = {}) {
  const offset    = parseInt(row.due_offset_days, 10)
  const hasOffset = Number.isFinite(offset)
  if (row.due_base_anchor === 'contract') {
    return (contractDate && hasOffset) ? addDays(contractDate.slice(0, 10), offset) : null
  }
  if (row.due_base_bb_type_id != null && row.due_base_bb_type_id !== '') {
    const base = bbDateMap[String(row.due_base_bb_type_id)]
    return (base && hasOffset) ? addDays(base.slice(0, 10), offset) : null
  }
  return row.due_date ? row.due_date.slice(0, 10) : null
}

// Trạng thái + màu của một khoản phải thu, dựa vào tiến độ thu thực tế & thời hạn.
//  - Còn thiếu <= 0 (đã thu đủ): so thời hạn thu với NGÀY NHẬN gần nhất.
//  - Còn thiếu  > 0 (chưa đủ):   so thời hạn thu với NGÀY HIỆN TẠI.
// effectiveDue (yyyy-mm-dd) ghi đè row.due_date — dùng khi thời hạn tính động theo biên bản.
export function receivableStatus(row, linkedPayments = [], effectiveDue = undefined) {
  const schedAmt = parseFloat(row.amount) || 0
  if (schedAmt <= 0) return null

  const received = linkedPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const shortage = schedAmt - received
  const dueStr   = effectiveDue !== undefined ? effectiveDue : row.due_date
  const due      = dueStr ? new Date(dueStr.slice(0, 10)) : null
  const today    = new Date(new Date().toDateString())
  const daysBetween = (a, b) => Math.round((a - b) / 86400000)

  if (shortage <= 0) {
    const dates  = linkedPayments.map(p => p.payment_date).filter(Boolean).sort()
    const latest = dates.length ? new Date(dates[dates.length - 1].slice(0, 10)) : null
    if (due && latest && latest > due)
      return { key: 'paid-late', label: `Đã thu đủ · trễ ${daysBetween(latest, due)} ngày`, color: 'amber' }
    return { key: 'paid', label: 'Đã thu đủ', color: 'green' }
  }

  if (due && due < today) {
    const days = daysBetween(today, due)
    return received > 0
      ? { key: 'overdue-partial', label: `Quá hạn ${days} ngày · thu một phần`, color: 'red' }
      : { key: 'overdue', label: `Quá hạn ${days} ngày`, color: 'red' }
  }
  if (received > 0)
    return { key: 'partial', label: 'Đang thu', color: 'blue' }
  return { key: 'pending', label: 'Chưa đến hạn', color: 'gray' }
}

let _ctr = 0
export const tmpId = () => `tmp_${++_ctr}`

export const needsRate = (row) => {
  const cur = row.currency_code
  if (!cur || cur === 'VND') return false
  const rate = parseFloat(row.exchange_rate)
  return !(rate > 1)
}

// Lưu 1 đợt tiền về (dùng chung cho nút lưu từng dòng và Ctrl+S lưu hàng loạt).
// `reload` (tùy chọn): hàm tải lại danh sách đợt tiền về, dùng khi bị 409 xung đột.
export async function savePaymentRow(row, contractId, setPayRows, reload) {
  if (needsRate(row)) { alert(`Nhập tỷ giá cho ${row.currency_code}.`); return }
  setPayRows(prev => prev.map(p => p._key === row._key ? { ...p, _saving: true } : p))
  const body = {
    payment_date: row.payment_date, currency_code: row.currency_code,
    amount: row.amount, exchange_rate: row.exchange_rate,
    amount_vnd: row.amount_vnd, note: row.note, schedule_id: row.schedule_id,
  }
  try {
    const url    = row._isNew ? `${API}/contracts/${contractId}/receivable-payments` : `${API}/receivable-payments/${row.id}`
    const method = row._isNew ? 'POST' : 'PUT'
    const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(withStamp(body, row)) })
    const saved  = await res.json()
    if (await handledConflict(res, saved, reload)) return
    if (!res.ok) throw new Error(saved.error || 'Save failed')
    setPayRows(prev => prev.map(p => p._key === row._key ? { ...saved, _key: row._key, _dirty: false, _isNew: false, _saving: false } : p))
  } catch (e) {
    alert('Lỗi: ' + e.message)
    setPayRows(prev => prev.map(p => p._key === row._key ? { ...p, _saving: false } : p))
  }
}

// ── Generic inline-editable rows loader ──────────────────────────────────────

export function useRows(url, toLocal) {
  const [rows, setRows]     = useState([])
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
