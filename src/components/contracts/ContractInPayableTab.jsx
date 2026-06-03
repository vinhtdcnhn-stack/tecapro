import { useState, useEffect, useCallback } from 'react'
import './ContractReceivableTab.css'

const API = (() => (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5174').replace(/\/$/, ''))() + '/api'

const CURRENCIES       = ['VND', 'USD', 'EUR', 'JPY', 'SGD', 'CNY', 'GBP']
const PAYMENT_METHODS  = ['TT', 'L/C', 'D/P', 'D/A', 'TTR', 'Khác']

const fmtVND  = (n) => { const num = parseFloat(n) || 0; return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: num % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 }).format(num) }
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'

function calcVND(amount, rate, currency) {
  const a = parseFloat(amount) || 0
  const r = parseFloat(rate)   || 1
  return currency === 'VND' ? a : a * r
}

function isOverdue(dueDate) {
  if (!dueDate) return false
  return new Date(dueDate) < new Date(new Date().toDateString())
}

let _ctr = 0
const tmpId = () => `tmp_${++_ctr}`

function useRows(url, toLocal) {
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

// ── Main component ────────────────────────────────────────────────────────────

export default function ContractInPayableTab({ contractInId }) {
  const payableUrl = `${API}/contract-ins/${contractInId}/payables`
  const paymentUrl = `${API}/contract-ins/${contractInId}/payments`

  const toLocalRow = (r) => ({ ...r, _key: String(r.id), _dirty: false, _isNew: false, _saving: false })

  const sched = useRows(payableUrl, toLocalRow)
  const pay   = useRows(paymentUrl, toLocalRow)

  // Load contract reference (BOQ total)
  const [contractRef, setContractRef] = useState(null)

  useEffect(() => {
    async function loadRef() {
      try {
        const [boqRes, cRes] = await Promise.all([
          fetch(`${API}/contract-ins/${contractInId}/boq`),
          fetch(`${API}/contract-ins/${contractInId}`),   // không có route riêng, dùng contract-ins list
        ])
        const boqData = await boqRes.json()
        const boqTotal = Array.isArray(boqData)
          ? boqData.reduce((s, r) => s + (parseFloat(r.amount_after_vat) || 0), 0)
          : 0
        setContractRef({ boqTotal })
      } catch (e) { console.error('loadRef:', e) }
    }
    loadRef()
  }, [contractInId])

  // Totals
  const totalExpected = sched.rows.reduce((s, r) => s + calcVND(r.amount, r.exchange_rate, r.currency_code), 0)
  const totalPaid     = pay.rows.reduce((s, r) => s + calcVND(r.amount, r.exchange_rate, r.currency_code), 0)
  const balance       = totalExpected - totalPaid
  const pct           = totalExpected > 0 ? Math.min(100, (totalPaid / totalExpected) * 100) : 0

  if (sched.loading && pay.loading) return <div className="recv-loading">Đang tải...</div>

  return (
    <div className="recv-tab">

      {/* ── Summary ── */}
      <div className="recv-summary">
        <SummaryCard label="Phải trả theo HĐ"  value={fmtVND(totalExpected)}
          sub={`${sched.rows.filter(r=>!r._isNew).length} khoản`} color="blue" />
        <SummaryCard label="Đã thanh toán"      value={fmtVND(totalPaid)}
          sub={`${pay.rows.filter(r=>!r._isNew).length} đợt`} color="green" />
        <SummaryCard label="Còn phải trả"        value={fmtVND(balance)}
          sub={balance > 0 ? `Còn thiếu ${fmtVND(balance)} đ` : 'Đã thanh toán đủ'}
          color={balance > 0 ? 'orange' : 'green'} highlight={balance > 0} />
        <div className="recv-progress-card">
          <div className="recv-progress-label">
            <span>Tiến độ TT</span>
            <strong>{pct.toFixed(1)}%</strong>
          </div>
          <div className="recv-progress-bar">
            <div className="recv-progress-fill"
              style={{ width:`${pct}%`, background: pct>=100?'#15803d': pct>=60?'#2563eb':'#f59e0b' }} />
          </div>
        </div>
      </div>

      {/* ── Section 1: Lịch phải trả ── */}
      <PayableSection
        rows={sched.rows}
        setRows={sched.setRows}
        contractInId={contractInId}
        reload={sched.reload}
        refTotal={contractRef?.boqTotal || 0}
      />

      {/* ── Section 2: Thanh toán thực tế ── */}
      <PaymentSection
        rows={pay.rows}
        setRows={pay.setRows}
        contractInId={contractInId}
        reload={pay.reload}
        totalExpected={totalExpected}
      />
    </div>
  )
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color, highlight }) {
  return (
    <div className={`recv-card recv-card--${color} ${highlight?'recv-card--highlight':''}`}>
      <div className="recv-card-label">{label}</div>
      <div className="recv-card-value">{value} <span className="recv-card-unit">đ</span></div>
      <div className="recv-card-sub">{sub}</div>
    </div>
  )
}

// ── Payable schedule section ──────────────────────────────────────────────────

function PayableSection({ rows, setRows, contractInId, reload, refTotal }) {
  const set = (key, field, val) =>
    setRows(prev => prev.map(r => {
      if (r._key !== key) return r
      const updated = { ...r, [field]: val, _dirty: true }
      if (field === 'amount' || field === 'exchange_rate' || field === 'currency_code') {
        const cur = field === 'currency_code' ? val : updated.currency_code
        const amt = field === 'amount'        ? val : updated.amount
        const rt  = field === 'exchange_rate' ? val : updated.exchange_rate
        updated.amount_vnd = calcVND(amt, rt, cur)
        if (cur === 'VND') updated.exchange_rate = 1
      }
      return updated
    }))

  const addRow = () => setRows(prev => [...prev, {
    id: null, _key: tmpId(), _dirty: true, _isNew: true, _saving: false,
    description: '', payment_method: 'TT', currency_code: 'VND',
    amount: '', exchange_rate: 1, amount_vnd: 0, due_date: '', delay_reason: '',
  }])

  const saveRow = async (row) => {
    setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: true } : r))
    const body = {
      description: row.description, payment_method: row.payment_method,
      currency_code: row.currency_code, amount: row.amount,
      exchange_rate: row.exchange_rate, due_date: row.due_date,
      delay_reason: row.delay_reason,
    }
    try {
      const url    = row._isNew ? `${API}/contract-ins/${contractInId}/payables` : `${API}/payables/${row.id}`
      const method = row._isNew ? 'POST' : 'PUT'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const saved  = await res.json()
      if (!res.ok) throw new Error(saved.error || 'Save failed')
      setRows(prev => prev.map(r => r._key === row._key
        ? { ...saved, _key: row._key, _dirty: false, _isNew: false, _saving: false }
        : r))
    } catch (e) {
      alert('Lỗi: ' + e.message)
      setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: false } : r))
    }
  }

  const deleteRow = async (row) => {
    if (row._isNew) { setRows(prev => prev.filter(r => r._key !== row._key)); return }
    if (!confirm(`Xóa khoản phải trả "${row.description || '(trống)'}"?`)) return
    try {
      await fetch(`${API}/payables/${row.id}`, { method: 'DELETE' })
      setRows(prev => prev.filter(r => r._key !== row._key))
    } catch { alert('Không thể xóa.') }
  }

  const totalVND = rows.reduce((s, r) => s + calcVND(r.amount, r.exchange_rate, r.currency_code), 0)

  return (
    <div className="recv-section">
      <div className="recv-section-header">
        <h4 className="recv-section-title">Phải trả theo ĐKTT hợp đồng</h4>
        <button className="recv-btn recv-btn-primary" onClick={addRow}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Thêm khoản
        </button>
      </div>

      <div className="recv-table-wrapper">
        <table className="recv-table">
          <thead>
            <tr>
              <th className="th-stt">#</th>
              <th className="th-desc">Mô tả điều kiện thanh toán</th>
              <th style={{ minWidth:100 }}>Phương thức</th>
              <th className="th-cur">Đồng tiền</th>
              <th className="th-num">Giá trị</th>
              <th className="th-rate">Tỷ giá</th>
              <th className="th-vnd">Quy đổi VNĐ</th>
              <th className="th-date">Thời hạn trả</th>
              <th className="th-reason">Nguyên nhân trượt</th>
              <th className="th-act"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan="10" className="recv-empty">Chưa có khoản phải trả nào. Nhấn <strong>Thêm khoản</strong>.</td></tr>
            ) : rows.map((row, idx) => {
              const overdue = isOverdue(row.due_date) && !row._isNew
              const vnd = calcVND(row.amount, row.exchange_rate, row.currency_code)
              return (
                <tr key={row._key} className={[
                  overdue ? 'row-overdue' : '',
                  row._dirty  ? 'row-dirty'  : '',
                  row._isNew  ? 'row-new'    : '',
                  row._saving ? 'row-saving' : '',
                ].filter(Boolean).join(' ')}>
                  <td className="td-stt">
                    {row._dirty && <span className="dirty-dot" />}
                    <span>{idx + 1}</span>
                  </td>
                  <td className="td-desc">
                    <input type="text" value={row.description || ''}
                      placeholder="VD: 30% đặt cọc khi ký HĐ..."
                      onChange={e => set(row._key, 'description', e.target.value)} />
                  </td>
                  <td>
                    <select value={row.payment_method || 'TT'}
                      onChange={e => set(row._key, 'payment_method', e.target.value)}>
                      {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </td>
                  <td className="td-cur">
                    <select value={row.currency_code || 'VND'}
                      onChange={e => set(row._key, 'currency_code', e.target.value)}>
                      {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="td-num">
                    <input type="number" value={row.amount === '' ? '' : row.amount}
                      min="0" placeholder="0"
                      onChange={e => set(row._key, 'amount', e.target.value)} />
                  </td>
                  <td className="td-rate">
                    <input type="number"
                      value={row.currency_code === 'VND' ? 1 : (row.exchange_rate || '')}
                      disabled={row.currency_code === 'VND'} min="0" placeholder="1"
                      onChange={e => set(row._key, 'exchange_rate', e.target.value)} />
                  </td>
                  <td className="td-vnd computed">{fmtVND(vnd)}</td>
                  <td className="td-date">
                    <input type="date" value={row.due_date?.slice(0, 10) || ''}
                      onChange={e => set(row._key, 'due_date', e.target.value)} />
                    {overdue && <span className="overdue-tag">Quá hạn</span>}
                  </td>
                  <td className="td-reason">
                    <input type="text" value={row.delay_reason || ''}
                      placeholder={overdue ? 'Nhập nguyên nhân...' : ''}
                      className={overdue && !row.delay_reason && !row._isNew ? 'input-warn' : ''}
                      onChange={e => set(row._key, 'delay_reason', e.target.value)} />
                  </td>
                  <td className="td-act">
                    <RowActions row={row} onSave={saveRow} onDelete={deleteRow} />
                  </td>
                </tr>
              )
            })}
          </tbody>
          {rows.filter(r => !r._isNew).length > 0 && (
            <tfoot>
              <tr className="totals-row">
                <td colSpan="6" className="totals-label">TỔNG PHẢI TRẢ</td>
                <td className="td-vnd">{fmtVND(totalVND)}</td>
                <td colSpan="3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ── Actual payment section ────────────────────────────────────────────────────

function PaymentSection({ rows, setRows, contractInId, totalExpected }) {
  const set = (key, field, val) =>
    setRows(prev => prev.map(r => {
      if (r._key !== key) return r
      const updated = { ...r, [field]: val, _dirty: true }
      if (field === 'amount' || field === 'exchange_rate' || field === 'currency_code') {
        const cur = field === 'currency_code' ? val : updated.currency_code
        const amt = field === 'amount'        ? val : updated.amount
        const rt  = field === 'exchange_rate' ? val : updated.exchange_rate
        updated.amount_vnd = calcVND(amt, rt, cur)
        if (cur === 'VND') updated.exchange_rate = 1
        if (totalExpected > 0) {
          updated.payment_ratio = parseFloat(((updated.amount_vnd / totalExpected) * 100).toFixed(2))
        }
      }
      return updated
    }))

  const addRow = () => setRows(prev => [...prev, {
    id: null, _key: tmpId(), _dirty: true, _isNew: true, _saving: false,
    payment_date: new Date().toISOString().slice(0, 10),
    currency_code: 'VND', amount: '', exchange_rate: 1, amount_vnd: 0, payment_ratio: '', note: '',
  }])

  const saveRow = async (row) => {
    setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: true } : r))
    const body = {
      payment_date: row.payment_date, currency_code: row.currency_code,
      amount: row.amount, exchange_rate: row.exchange_rate,
      payment_ratio: row.payment_ratio, note: row.note,
    }
    try {
      const url    = row._isNew ? `${API}/contract-ins/${contractInId}/payments` : `${API}/payments/${row.id}`
      const method = row._isNew ? 'POST' : 'PUT'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const saved  = await res.json()
      if (!res.ok) throw new Error(saved.error || 'Save failed')
      setRows(prev => prev.map(r => r._key === row._key
        ? { ...saved, _key: row._key, _dirty: false, _isNew: false, _saving: false }
        : r))
    } catch (e) {
      alert('Lỗi: ' + e.message)
      setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: false } : r))
    }
  }

  const deleteRow = async (row) => {
    if (row._isNew) { setRows(prev => prev.filter(r => r._key !== row._key)); return }
    if (!confirm('Xóa đợt thanh toán này?')) return
    try {
      await fetch(`${API}/payments/${row.id}`, { method: 'DELETE' })
      setRows(prev => prev.filter(r => r._key !== row._key))
    } catch { alert('Không thể xóa.') }
  }

  const totalPaidVND = rows.reduce((s, r) => s + calcVND(r.amount, r.exchange_rate, r.currency_code), 0)

  return (
    <div className="recv-section">
      <div className="recv-section-header">
        <h4 className="recv-section-title">Thanh toán thực tế cho NCC</h4>
        <button className="recv-btn recv-btn-primary" onClick={addRow}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Thêm đợt TT
        </button>
      </div>

      <div className="recv-table-wrapper">
        <table className="recv-table">
          <thead>
            <tr>
              <th className="th-stt">#</th>
              <th className="th-date">Ngày thanh toán</th>
              <th className="th-cur">Đồng tiền</th>
              <th className="th-num">Giá trị</th>
              <th className="th-rate">Tỷ giá</th>
              <th className="th-vnd">Quy đổi VNĐ</th>
              <th className="th-ratio">Tỷ lệ TT (%)</th>
              <th className="th-note">Ghi chú</th>
              <th className="th-act"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan="9" className="recv-empty">Chưa có đợt thanh toán nào. Nhấn <strong>Thêm đợt TT</strong>.</td></tr>
            ) : rows.map((row, idx) => {
              const vnd = calcVND(row.amount, row.exchange_rate, row.currency_code)
              return (
                <tr key={row._key} className={[
                  row._dirty  ? 'row-dirty'  : '',
                  row._isNew  ? 'row-new'    : '',
                  row._saving ? 'row-saving' : '',
                ].filter(Boolean).join(' ')}>
                  <td className="td-stt">
                    {row._dirty && <span className="dirty-dot" />}
                    <span>{idx + 1}</span>
                  </td>
                  <td className="td-date">
                    <input type="date" value={row.payment_date?.slice(0, 10) || ''}
                      onChange={e => set(row._key, 'payment_date', e.target.value)} />
                  </td>
                  <td className="td-cur">
                    <select value={row.currency_code || 'VND'}
                      onChange={e => set(row._key, 'currency_code', e.target.value)}>
                      {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="td-num">
                    <input type="number" value={row.amount === '' ? '' : row.amount}
                      min="0" placeholder="0"
                      onChange={e => set(row._key, 'amount', e.target.value)} />
                  </td>
                  <td className="td-rate">
                    <input type="number"
                      value={row.currency_code === 'VND' ? 1 : (row.exchange_rate || '')}
                      disabled={row.currency_code === 'VND'} min="0" placeholder="1"
                      onChange={e => set(row._key, 'exchange_rate', e.target.value)} />
                  </td>
                  <td className="td-vnd computed">{fmtVND(vnd)}</td>
                  <td className="td-ratio">
                    <div className="ratio-cell">
                      <input type="number" value={row.payment_ratio === '' ? '' : row.payment_ratio}
                        min="0" max="100" step="0.01" placeholder="—"
                        onChange={e => set(row._key, 'payment_ratio', e.target.value)} />
                      {row.payment_ratio > 0 && <span className="ratio-pct">%</span>}
                    </div>
                  </td>
                  <td className="td-note">
                    <input type="text" value={row.note || ''} placeholder="Ghi chú..."
                      onChange={e => set(row._key, 'note', e.target.value)} />
                  </td>
                  <td className="td-act">
                    <RowActions row={row} onSave={saveRow} onDelete={deleteRow} />
                  </td>
                </tr>
              )
            })}
          </tbody>
          {rows.filter(r => !r._isNew).length > 0 && (
            <tfoot>
              <tr className="totals-row">
                <td colSpan="5" className="totals-label">TỔNG ĐÃ THANH TOÁN</td>
                <td className="td-vnd">{fmtVND(totalPaidVND)}</td>
                <td colSpan="3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ── Row actions ───────────────────────────────────────────────────────────────

function RowActions({ row, onSave, onDelete }) {
  return (
    <div className="action-group">
      {row._dirty && (
        <button className="act save" onClick={() => onSave(row)} disabled={row._saving} title="Lưu">
          {row._saving
            ? <span className="spin">⟳</span>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
          }
        </button>
      )}
      <button className="act delete" onClick={() => onDelete(row)} title="Xóa">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </button>
    </div>
  )
}
