import { useState, useEffect } from 'react'
import './ContractReceivableTab.css'

import { API } from '../../config/api'
import { fmtVND, fmtAmt, calcVND, useRows } from './receivableUtils'
import ScheduleSection from './ReceivableScheduleSection'
import PaymentSection from './ReceivablePaymentSection'

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
        refTotal={refTotal}
        refCurrency={contractRef?.currency || 'VND'}
        refExRate={contractRef?.exchangeRate || 1}
      />

      {/* ── Section 2: Tiền về thực tế ── */}
      <PaymentSection
        rows={pay.rows}
        setRows={pay.setRows}
        contractId={contractId}
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
