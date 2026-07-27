import { useState, useEffect } from 'react'
import './ContractReceivableTab.css'
import { API } from '../../config/api'
import { apiGet } from '../../lib/api'
import { fmtVND, calcVND, useRows } from './contractInPayableUtils'
import PayableSection from './ContractInPayableSection'
import PaymentSection from './ContractInPaymentSection'
import EditGuard from './EditGuard'
import { useContractPerm } from '../../context/ContractPermContext'

// ── Main component ────────────────────────────────────────────────────────────

export default function ContractInPayableTab({ contractInId }) {
  const { canSection } = useContractPerm()
  const showAmounts = canSection('ci.payment.amounts')
  const mVND = (n) => showAmounts ? fmtVND(n) : '•••'
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
        const boqData = await apiGet(`/contract-ins/${contractInId}/boq`, { conditional: true })
        // Tổng BOQ = SUM node GỐC (parent_id IS NULL) để tránh cộng chồng node roll-up
        // nếu BOQ phân cấp (BOQ nhập hiện phẳng nên bộ lọc là vô hại).
        const boqTotal = Array.isArray(boqData)
          ? boqData
              .filter((r) => r.parent_id == null)
              .reduce((s, r) => s + (parseFloat(r.amount_after_vat) || 0), 0)
          : 0
        setContractRef({ boqTotal })
      } catch (e) { console.error('loadRef:', e) }
    }
    loadRef()
  }, [contractInId])

  // Đợt thanh toán chưa gắn khoản nào (dữ liệu cũ trước khi có liên kết, hoặc khoản đã bị xóa)
  const orphanPayments = pay.rows.filter(p => p.payable_id == null)

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
        <SummaryCard label="Phải trả theo HĐ"  value={mVND(totalExpected)}
          sub={`${sched.rows.filter(r=>!r._isNew).length} khoản`} color="blue" />
        <SummaryCard label="Đã thanh toán"      value={mVND(totalPaid)}
          sub={`${pay.rows.filter(r=>!r._isNew).length} đợt`} color="green" />
        <SummaryCard label="Còn phải trả"        value={mVND(balance)}
          sub={balance > 0 ? `Còn thiếu ${mVND(balance)} đ` : 'Đã thanh toán đủ'}
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
      {/* ── Lịch phải trả — mỗi khoản kèm các đợt thanh toán đã gắn vào nó ── */}
      <PayableSection
        rows={sched.rows}
        setRows={sched.setRows}
        contractInId={contractInId}
        reload={sched.reload}
        refTotal={contractRef?.boqTotal || 0}
        showAmounts={showAmounts}
        payRows={pay.rows}
        setPayRows={pay.setRows}
        reloadPayments={pay.reload}
      />

      {/* ── Đợt thanh toán chưa gắn khoản (dữ liệu cũ / khoản bị xóa) — chỉ hiện khi có ── */}
      {orphanPayments.length > 0 && (
        <PaymentSection
          rows={orphanPayments}
          setRows={pay.setRows}
          contractInId={contractInId}
          reload={pay.reload}
          totalExpected={totalExpected}
          showAmounts={showAmounts}
          payables={sched.rows}
        />
      )}
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
