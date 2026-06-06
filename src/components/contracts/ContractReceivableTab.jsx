import { useState, useEffect, useCallback } from 'react'
import './ContractReceivableTab.css'

import { API } from '../../config/api'
import { fmtVND, fmtAmt, useRows } from './receivableUtils'
import ScheduleSection from './ReceivableScheduleSection'

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

  const loadContractRef = useCallback(async () => {
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
  }, [contractId])

  useEffect(() => { loadContractRef() }, [loadContractRef])

  // Tỷ giá dùng chung: sau khi 1 khoản đồng bộ tỷ giá HĐ, backend cập nhật mọi khoản
  // → tải lại tham chiếu HĐ + bảng phải thu để các dòng khác hiển thị tỷ giá mới.
  const reloadSched = sched.reload
  const handleRateSynced = useCallback(() => {
    loadContractRef()
    reloadSched()
  }, [loadContractRef, reloadSched])

  // Tổng tham chiếu: dùng BOQ nếu có, fallback về contract_out
  const refTotal = contractRef
    ? (contractRef.boqTotal > 0 ? contractRef.boqTotal : contractRef.contractTotal)
    : 0

  // ── Totals ─────────────────────────────────────────────────────────────────

  const refCur = contractRef?.currency || 'VND'

  // Mọi tính toán dựa trên GIÁ TRỊ GỐC (đồng tiền HĐ), không dựa vào giá trị quy đổi VNĐ.
  const totalExpected = sched.rows.filter(r => !r._isNew).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const totalReceived = pay.rows.filter(r => !r._isNew).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const balance       = totalExpected - totalReceived
  const pct           = totalExpected > 0 ? Math.min(100, (totalReceived / totalExpected) * 100) : 0

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
            <strong>{fmtAmt(refTotal, refCur)} {refCur === 'VND' ? 'đ' : refCur}</strong>
            {contractRef.currency !== 'VND' && (
              <span className="recv-ref-sub">
                &nbsp;≈ {fmtVND(refTotal * contractRef.exchangeRate)} đ
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

      {/* ── Phải thu theo ĐKTT HĐ (kèm tiền về liên kết) ── */}
      <ScheduleSection
        rows={sched.rows}
        setRows={sched.setRows}
        contractId={contractId}
        refTotal={refTotal}
        refCurrency={contractRef?.currency || 'VND'}
        refExRate={contractRef?.exchangeRate || 1}
        payRows={pay.rows}
        setPayRows={pay.setRows}
        onRateSynced={handleRateSynced}
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
