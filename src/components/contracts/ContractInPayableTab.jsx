import { useState, useEffect } from 'react'
import './ContractReceivableTab.css'
import { API } from '../../config/api'
import { fmtVND, calcVND, useRows } from './contractInPayableUtils'
import PayableSection from './ContractInPayableSection'
import PaymentSection from './ContractInPaymentSection'
import EditGuard from './EditGuard'

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
        const boqRes  = await fetch(`${API}/contract-ins/${contractInId}/boq`)
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

      {/* ── Khóa nhập/sửa khi không phải PM ── */}
      <EditGuard>
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
      </EditGuard>
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
