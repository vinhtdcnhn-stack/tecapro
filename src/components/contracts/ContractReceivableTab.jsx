import { useState, useEffect, useCallback } from 'react'
import './ContractReceivableTab.css'

const API = (() => (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5174').replace(/\/$/, ''))() + '/api'

const CURRENCIES = ['VND', 'USD', 'EUR', 'JPY', 'SGD', 'CNY', 'GBP', 'AUD', 'KRW']

const fmtVND  = (n) => { const num = parseFloat(n) || 0; return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: num % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 }).format(num) }
const fmtAmt  = (n, cur) => { const num = parseFloat(n) || 0; return cur === 'VND' ? fmtVND(num) : new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(num) }
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'
const fmtNum  = (n, dec = 2) => (parseFloat(n) || 0).toLocaleString('vi-VN', { maximumFractionDigits: dec })

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

// ── Generic inline-editable table row ────────────────────────────────────────

function useRows(url, toLocal) {
  const [rows, setRows]     = useState([])
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContractReceivableTab({ contractId }) {
  const scheduleUrl = `${API}/contracts/${contractId}/receivable`
  const paymentUrl  = `${API}/contracts/${contractId}/receivable-payments`

  const toLocalSched = (r) => ({ ...r, _key: String(r.id), _dirty: false, _isNew: false, _saving: false })
  const toLocalPay   = (r) => ({ ...r, _key: String(r.id), _dirty: false, _isNew: false, _saving: false })

  const sched = useRows(scheduleUrl, toLocalSched)
  const pay   = useRows(paymentUrl,  toLocalPay)

  // ── Giá trị hợp đồng (từ BOQ hoặc contract_out) ────────────────────────────
  const [contractRef, setContractRef] = useState(null) // { boqTotal, currency, amountAfterVat }

  useEffect(() => {
    async function loadContractRef() {
      try {
        // Lấy tổng BOQ (ưu tiên vì phản ánh bảng giá thực tế)
        const [boqRes, contractRes] = await Promise.all([
          fetch(`${API}/contracts/${contractId}/boq`),
          fetch(`${API}/contracts/${contractId}`),
        ])
        const boqData      = await boqRes.json()
        const contractData = await contractRes.json()

        const boqTotal = Array.isArray(boqData)
          ? boqData.reduce((s, r) => s + (parseFloat(r.amount_after_vat) || 0), 0)
          : 0

        setContractRef({
          boqTotal,
          contractTotal: parseFloat(contractData.amount_after_vat) || 0,
          currency: contractData.currency_code || 'VND',
          exchangeRate: parseFloat(contractData.exchange_rate) || 1,
        })
      } catch (e) { console.error('loadContractRef:', e) }
    }
    loadContractRef()
  }, [contractId])

  // Tổng tham chiếu: dùng BOQ nếu có, fallback về contract_out
  const refTotal = contractRef
    ? (contractRef.boqTotal > 0 ? contractRef.boqTotal : contractRef.contractTotal)
    : 0

  // ── Totals ─────────────────────────────────────────────────────────────────

  const refCur = contractRef?.currency || 'VND'

  // VND equivalents — dùng cho tính tỷ lệ % và truyền vào PaymentSection
  const totalExpectedVND = sched.rows.reduce((s, r) => s + (parseFloat(calcVND(r.amount, r.exchange_rate, r.currency_code)) || 0), 0)
  const totalReceivedVND = pay.rows.reduce((s, r) => s + (parseFloat(calcVND(r.amount, r.exchange_rate, r.currency_code)) || 0), 0)
  const pct              = totalExpectedVND > 0 ? Math.min(100, (totalReceivedVND / totalExpectedVND) * 100) : 0

  // Hiển thị theo đồng tiền hợp đồng
  const totalExpected = refCur === 'VND'
    ? totalExpectedVND
    : sched.rows.filter(r => !r._isNew).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const totalReceived = refCur === 'VND'
    ? totalReceivedVND
    : pay.rows.filter(r => !r._isNew).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const balance = totalExpected - totalReceived

  if (sched.loading && pay.loading) return <div className="recv-loading">Đang tải...</div>

  return (
    <div className="recv-tab">

      {/* ── Summary panel ── */}
      <div className="recv-summary">
        <SummaryCard
          label="Phải thu theo HĐ"
          value={fmtAmt(totalExpected, refCur)}
          sub={`${sched.rows.filter(r => !r._isNew).length} khoản`}
          color="blue"
          unit={refCur === 'VND' ? 'đ' : refCur}
        />
        <SummaryCard
          label="Đã thu thực tế"
          value={fmtAmt(totalReceived, refCur)}
          sub={`${pay.rows.filter(r => !r._isNew).length} đợt`}
          color="green"
          unit={refCur === 'VND' ? 'đ' : refCur}
        />
        <SummaryCard
          label="Còn phải thu"
          value={fmtAmt(balance, refCur)}
          sub={balance > 0 ? `Còn thiếu ${fmtAmt(balance, refCur)} ${refCur === 'VND' ? 'đ' : refCur}` : 'Đã thu đủ'}
          color={balance > 0 ? 'orange' : 'green'}
          highlight={balance > 0}
          unit={refCur === 'VND' ? 'đ' : refCur}
        />
        <div className="recv-progress-card">
          <div className="recv-progress-label">
            <span>Tỷ lệ thu</span>
            <strong>{pct.toFixed(1)}%</strong>
          </div>
          <div className="recv-progress-bar">
            <div className="recv-progress-fill" style={{ width: `${pct}%`, background: pct >= 100 ? '#15803d' : pct >= 60 ? '#2563eb' : '#f59e0b' }} />
          </div>
        </div>
      </div>

      {/* ── Banner tham chiếu giá trị HĐ ── */}
      {contractRef && (
        <div className="recv-ref-banner">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
          <span>
            Tổng giá trị HĐ (từ {contractRef.boqTotal > 0 ? 'bảng giá BOQ' : 'thông tin HĐ'}):&nbsp;
            <strong>{fmtVND(refTotal)} đ</strong>
            {contractRef.currency !== 'VND' && (
              <span className="recv-ref-sub">
                &nbsp;≈ {fmtVND(refTotal / contractRef.exchangeRate)} {contractRef.currency}
                &nbsp;(tỷ giá {contractRef.exchangeRate})
              </span>
            )}
            &nbsp;— Nhập <strong>% theo HĐ</strong> để tự tính giá trị phải thu từng khoản.
          </span>
          {contractRef.boqTotal === 0 && contractRef.contractTotal === 0 && (
            <span className="recv-ref-warn"> Chưa có dữ liệu bảng giá.</span>
          )}
        </div>
      )}

      {/* ── Section 1: Phải thu theo ĐKTT HĐ ── */}
      <ScheduleSection
        rows={sched.rows}
        setRows={sched.setRows}
        contractId={contractId}
        reload={sched.reload}
        totalExpected={totalExpected}
        refTotal={refTotal}
        refCurrency={contractRef?.currency || 'VND'}
        refExRate={contractRef?.exchangeRate || 1}
      />

      {/* ── Section 2: Tiền về thực tế ── */}
      <PaymentSection
        rows={pay.rows}
        setRows={pay.setRows}
        contractId={contractId}
        reload={pay.reload}
        totalExpected={totalExpectedVND}
        refCurrency={contractRef?.currency || 'VND'}
        refExRate={contractRef?.exchangeRate || 1}
      />
    </div>
  )
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color, highlight, unit = 'đ' }) {
  return (
    <div className={`recv-card recv-card--${color} ${highlight ? 'recv-card--highlight' : ''}`}>
      <div className="recv-card-label">{label}</div>
      <div className="recv-card-value">{value} <span className="recv-card-unit">{unit}</span></div>
      <div className="recv-card-sub">{sub}</div>
    </div>
  )
}

// ── Schedule section ──────────────────────────────────────────────────────────

function ScheduleSection({ rows, setRows, contractId, reload, totalExpected, refTotal, refCurrency, refExRate }) {
  const set = (key, field, val) =>
    setRows(prev => prev.map(r => {
      if (r._key !== key) return r
      const updated = { ...r, [field]: val, _dirty: true }

      // Nếu nhập % theo HĐ → tự tính amount và amount_vnd
      if (field === 'hd_ratio' && refTotal > 0) {
        const ratio = parseFloat(val) || 0
        const vndAmt = refTotal * ratio / 100
        updated.amount_vnd = vndAmt
        // Tính ngược amount theo đồng tiền HĐ
        if (updated.currency_code === 'VND') {
          updated.amount = vndAmt
        } else {
          const rate = parseFloat(updated.exchange_rate) || refExRate || 1
          updated.amount = vndAmt / rate
        }
      }

      if (field === 'amount' || field === 'exchange_rate' || field === 'currency_code') {
        const cur = field === 'currency_code' ? val : updated.currency_code
        const amt = field === 'amount'        ? val : updated.amount
        const rt  = field === 'exchange_rate' ? val : updated.exchange_rate
        updated.amount_vnd = calcVND(amt, rt, cur)
        if (cur === 'VND') updated.exchange_rate = 1
        // Tính ngược % theo HĐ
        if (refTotal > 0) {
          updated.hd_ratio = parseFloat(((updated.amount_vnd / refTotal) * 100).toFixed(2))
        }
      }
      return updated
    }))

  const addRow = () => setRows(prev => [...prev, {
    id: null, _key: tmpId(), _dirty: true, _isNew: true, _saving: false,
    description: '', currency_code: refCurrency || 'VND', amount: '', exchange_rate: refCurrency !== 'VND' ? (refExRate || '') : 1,
    amount_vnd: 0, due_date: '', delay_reason: '',
  }])

  const saveRow = async (row) => {
    setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: true } : r))
    const body = {
      description: row.description, currency_code: row.currency_code,
      amount: row.amount, exchange_rate: row.exchange_rate,
      due_date: row.due_date, delay_reason: row.delay_reason,
    }
    try {
      const url    = row._isNew ? `${API}/contracts/${contractId}/receivable` : `${API}/receivable/${row.id}`
      const method = row._isNew ? 'POST' : 'PUT'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const saved  = await res.json()
      if (!res.ok) throw new Error(saved.error || 'Save failed')
      setRows(prev => prev.map(r => r._key === row._key ? { ...saved, _key: row._key, _dirty: false, _isNew: false, _saving: false } : r))
    } catch (e) {
      alert('Lỗi: ' + e.message)
      setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: false } : r))
    }
  }

  const deleteRow = async (row) => {
    if (row._isNew) { setRows(prev => prev.filter(r => r._key !== row._key)); return }
    if (!confirm(`Xóa khoản phải thu "${row.description || '(trống)'}"?`)) return
    try {
      await fetch(`${API}/receivable/${row.id}`, { method: 'DELETE' })
      setRows(prev => prev.filter(r => r._key !== row._key))
    } catch { alert('Không thể xóa.') }
  }

  const totalVND = rows.reduce((s, r) => s + (parseFloat(calcVND(r.amount, r.exchange_rate, r.currency_code)) || 0), 0)

  return (
    <div className="recv-section">
      <div className="recv-section-header">
        <h4 className="recv-section-title">Phải thu theo ĐKTT hợp đồng</h4>
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
              <th className="th-ratio2">% theo HĐ</th>
              <th className="th-cur">Đồng tiền</th>
              <th className="th-num">Giá trị</th>
              <th className="th-rate">Tỷ giá</th>
              <th className="th-vnd">Quy đổi VNĐ</th>
              <th className="th-date">Thời hạn thu</th>
              <th className="th-reason">Nguyên nhân trượt</th>
              <th className="th-act"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan="10" className="recv-empty">Chưa có khoản phải thu nào. Nhấn <strong>Thêm khoản</strong>.</td></tr>
            ) : rows.map((row, idx) => {
              const overdue = isOverdue(row.due_date)
              const vnd = calcVND(row.amount, row.exchange_rate, row.currency_code)
              const hdRatio = row.hd_ratio != null ? row.hd_ratio : (refTotal > 0 ? parseFloat(((vnd / refTotal) * 100).toFixed(2)) : '')
              return (
                <tr key={row._key} className={[
                  overdue && !row._isNew ? 'row-overdue' : '',
                  row._dirty  ? 'row-dirty'  : '',
                  row._isNew  ? 'row-new'    : '',
                  row._saving ? 'row-saving' : '',
                ].filter(Boolean).join(' ')}>
                  <td className="td-stt">
                    {row._dirty && <span className="dirty-dot" />}
                    <span>{idx + 1}</span>
                  </td>
                  <td className="td-desc">
                    <input type="text" value={row.description || ''} placeholder="VD: 30% đặt cọc khi ký HĐ..."
                      onChange={e => set(row._key, 'description', e.target.value)} />
                  </td>
                  <td className="td-ratio2">
                    <div className="ratio-cell">
                      <input type="number" value={hdRatio === '' ? '' : hdRatio}
                        min="0" max="100" step="0.01"
                        placeholder={refTotal > 0 ? '30' : '—'}
                        title={refTotal > 0 ? `Nhập % → tự tính giá trị từ tổng HĐ (${fmtVND(refTotal)} đ)` : 'Chưa có dữ liệu BOQ'}
                        disabled={refTotal === 0}
                        onChange={e => set(row._key, 'hd_ratio', e.target.value)} />
                      <span className="ratio-pct">%</span>
                    </div>
                  </td>
                  <td className="td-cur">
                    <span className="currency-badge">{row.currency_code || refCurrency || 'VND'}</span>
                  </td>
                  <td className="td-num">
                    <input type="number" value={row.amount === '' ? '' : (typeof row.amount === 'number' ? row.amount.toFixed(2) : row.amount)}
                      min="0" placeholder="0" onChange={e => set(row._key, 'amount', e.target.value)} />
                  </td>
                  <td className="td-rate">
                    <input type="number" value={(row.currency_code || refCurrency) === 'VND' ? 1 : (row.exchange_rate || '')}
                      disabled={(row.currency_code || refCurrency) === 'VND'} min="0" placeholder="1"
                      onChange={e => set(row._key, 'exchange_rate', e.target.value)} />
                  </td>
                  <td className="td-vnd computed">{fmtVND(vnd)}</td>
                  <td className="td-date">
                    <input type="date" value={row.due_date?.slice(0, 10) || ''}
                      onChange={e => set(row._key, 'due_date', e.target.value)} />
                    {overdue && !row._isNew && <span className="overdue-tag">Quá hạn</span>}
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
                <td colSpan="6" className="totals-label">TỔNG PHẢI THU</td>
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

// ── Payment section ───────────────────────────────────────────────────────────

function PaymentSection({ rows, setRows, contractId, totalExpected, refCurrency, refExRate }) {
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
        // Auto-compute ratio
        if (totalExpected > 0) {
          updated.payment_ratio = parseFloat(((updated.amount_vnd / totalExpected) * 100).toFixed(2))
        }
      }
      return updated
    }))

  const addRow = () => setRows(prev => [...prev, {
    id: null, _key: tmpId(), _dirty: true, _isNew: true, _saving: false,
    payment_date: new Date().toISOString().slice(0, 10),
    currency_code: refCurrency || 'VND', amount: '', exchange_rate: refCurrency !== 'VND' ? (refExRate || '') : 1,
    amount_vnd: 0, payment_ratio: '', note: '',
  }])

  const saveRow = async (row) => {
    setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: true } : r))
    const body = {
      payment_date: row.payment_date, currency_code: row.currency_code,
      amount: row.amount, exchange_rate: row.exchange_rate,
      payment_ratio: row.payment_ratio, note: row.note,
    }
    try {
      const url    = row._isNew ? `${API}/contracts/${contractId}/receivable-payments` : `${API}/receivable-payments/${row.id}`
      const method = row._isNew ? 'POST' : 'PUT'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const saved  = await res.json()
      if (!res.ok) throw new Error(saved.error || 'Save failed')
      setRows(prev => prev.map(r => r._key === row._key ? { ...saved, _key: row._key, _dirty: false, _isNew: false, _saving: false } : r))
    } catch (e) {
      alert('Lỗi: ' + e.message)
      setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: false } : r))
    }
  }

  const deleteRow = async (row) => {
    if (row._isNew) { setRows(prev => prev.filter(r => r._key !== row._key)); return }
    if (!confirm('Xóa đợt thanh toán này?')) return
    try {
      await fetch(`${API}/receivable-payments/${row.id}`, { method: 'DELETE' })
      setRows(prev => prev.filter(r => r._key !== row._key))
    } catch { alert('Không thể xóa.') }
  }

  const totalPaidVND = rows.reduce((s, r) => s + (parseFloat(calcVND(r.amount, r.exchange_rate, r.currency_code)) || 0), 0)

  return (
    <div className="recv-section">
      <div className="recv-section-header">
        <h4 className="recv-section-title">Tiền về thực tế</h4>
        <button className="recv-btn recv-btn-primary" onClick={addRow}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Thêm đợt
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
              <tr><td colSpan="9" className="recv-empty">Chưa có đợt thanh toán nào. Nhấn <strong>Thêm đợt</strong>.</td></tr>
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
                    <span className="currency-badge">{row.currency_code || refCurrency || 'VND'}</span>
                  </td>
                  <td className="td-num">
                    <input type="number" value={row.amount === '' ? '' : row.amount} min="0"
                      placeholder="0" onChange={e => set(row._key, 'amount', e.target.value)} />
                  </td>
                  <td className="td-rate">
                    <input type="number" value={(row.currency_code || refCurrency) === 'VND' ? 1 : (row.exchange_rate || '')}
                      disabled={(row.currency_code || refCurrency) === 'VND'} min="0" placeholder="1"
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
                <td colSpan="5" className="totals-label">TỔNG ĐÃ THU</td>
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

// ── Shared row action buttons ─────────────────────────────────────────────────

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
