import { useState, useEffect, useCallback } from 'react'
import './ContractReceivableTab.css'

import { API } from '../../config/api'
import { apiGet } from '../../lib/api'
import { fmtVND, fmtAmt, useRows } from './receivableUtils'
import { computeForecasts } from './progressUtils'
import ScheduleSection from './ReceivableScheduleSection'
import EditGuard from './EditGuard'
import { useContractPerm } from '../../context/ContractPermContext'

// "Xem một phần": che số tiền (•••) khi thiếu quyền section co.receivable.amounts.
const MASK = '•••'

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContractReceivableTab({ contractId }) {
  const { canSection } = useContractPerm()
  const showAmounts = canSection('co.receivable.amounts')
  const mAmt = (v, cur) => showAmounts ? fmtAmt(v, cur) : MASK
  const mVND = (v) => showAmounts ? fmtVND(v) : MASK
  const scheduleUrl = `${API}/contracts/${contractId}/receivable`
  const paymentUrl  = `${API}/contracts/${contractId}/receivable-payments`

  const toLocalSched = (r) => ({ ...r, _key: String(r.id), _dirty: false, _isNew: false, _saving: false })
  const toLocalPay   = (r) => ({ ...r, _key: String(r.id), _dirty: false, _isNew: false, _saving: false })

  const sched = useRows(scheduleUrl, toLocalSched)
  const pay   = useRows(paymentUrl,  toLocalPay)

  // ── Giá trị hợp đồng (từ BOQ hoặc contract_out) ────────────────────────────
  const [contractRef, setContractRef] = useState(null) // { boqTotal, currency, amountAfterVat }

  // Mốc biên bản để tính "Thời hạn thu" động (giống Ngày dự kiến ở tab Tiến độ)
  const [contractDate, setContractDate] = useState(null)
  const [bbDateMap, setBBDateMap]   = useState({})  // bb_type_id → ngày hiệu lực (yyyy-mm-dd)
  const [baseOptions, setBaseOptions] = useState([]) // [{ bb_type_id, code }]

  const loadContractRef = useCallback(async () => {
    try {
      // Lấy tổng BOQ (ưu tiên vì phản ánh bảng giá thực tế) + tiến độ biên bản (mốc thời hạn thu)
      const [boqData, contractData, progData, bbData] = await Promise.all([
        apiGet(`/contracts/${contractId}/boq`, { conditional: true }),
        apiGet(`/contracts/${contractId}`, { conditional: true }),
        apiGet(`/contracts/${contractId}/progress`, { conditional: true }),
        apiGet(`/bb-types`, { conditional: true }),
      ])

      // Tổng BOQ = SUM số tiền các node GỐC (parent_id IS NULL) — khớp cách backend
      // đồng bộ contract_out.amount_after_vat. Nếu cộng MỌI dòng thì các node group/zone
      // (đã roll-up con) bị cộng chồng lên con → tổng bị thổi phồng với BOQ phân cấp.
      const boqTotal = Array.isArray(boqData)
        ? boqData
            .filter((r) => r.parent_id == null)
            .reduce((s, r) => s + (parseFloat(r.amount_after_vat) || 0), 0)
        : 0

      setContractRef({
        boqTotal,
        contractTotal: parseFloat(contractData.amount_after_vat) || 0,
        currency: contractData.currency_code || 'VND',
        exchangeRate: parseFloat(contractData.exchange_rate) || 1,
      })

      // Tính ngày hiệu lực của từng loại biên bản: ưu tiên ngày thực tế, nếu chưa có thì lấy Ngày dự kiến.
      const cDate = contractData?.contract_date || null
      setContractDate(cDate)
      const progRows  = (Array.isArray(progData) ? progData : []).map(r => ({ ...r, _key: String(r.id) }))
      const bbTypes   = Array.isArray(bbData) ? bbData : []
      const forecasts = computeForecasts(progRows, cDate)
      const dateMap   = {}
      const options   = []
      const seen      = new Set()
      progRows.forEach(r => {
        const t = r.bb_type_id
        if (t == null || t === '') return
        const key = String(t)
        if (!(key in dateMap)) {
          const eff = (r.actual_date ? r.actual_date.slice(0, 10) : null) || forecasts[r._key] || null
          if (eff) dateMap[key] = eff
        }
        if (!seen.has(key)) {
          seen.add(key)
          const bb = bbTypes.find(x => String(x.id) === key)
          options.push({ bb_type_id: t, code: bb ? bb.code : '—' })
        }
      })
      setBBDateMap(dateMap)
      setBaseOptions(options)
    } catch (e) { console.error('loadContractRef:', e) }
  }, [contractId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- loadContractRef() là async: setState xảy ra SAU await
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
          value={mAmt(totalExpected, refCur)}
          sub={`${sched.rows.filter(r => !r._isNew).length} khoản`}
          color="blue"
          unit={refCur === 'VND' ? 'đ' : refCur}
        />
        <SummaryCard
          label="Đã thu thực tế"
          value={mAmt(totalReceived, refCur)}
          sub={`${pay.rows.filter(r => !r._isNew).length} đợt`}
          color="green"
          unit={refCur === 'VND' ? 'đ' : refCur}
        />
        <SummaryCard
          label="Còn phải thu"
          value={mAmt(balance, refCur)}
          sub={balance > 0 ? `Còn thiếu ${mAmt(balance, refCur)} ${refCur === 'VND' ? 'đ' : refCur}` : 'Đã thu đủ'}
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
            <strong>{mAmt(refTotal, refCur)} {refCur === 'VND' ? 'đ' : refCur}</strong>
            {contractRef.currency !== 'VND' && (
              <span className="recv-ref-sub">
                &nbsp;≈ {mVND(refTotal * contractRef.exchangeRate)} đ
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

      {/* ── Phải thu theo ĐKTT HĐ (kèm tiền về liên kết) ── Khóa nhập/sửa khi không phải PM */}
      <EditGuard perm="co.receivable.manage">
      <ScheduleSection
        rows={sched.rows}
        setRows={sched.setRows}
        showAmounts={showAmounts}
        contractId={contractId}
        refTotal={refTotal}
        refCurrency={contractRef?.currency || 'VND'}
        refExRate={contractRef?.exchangeRate || 1}
        payRows={pay.rows}
        setPayRows={pay.setRows}
        onRateSynced={handleRateSynced}
        bbDateMap={bbDateMap}
        baseOptions={baseOptions}
        contractDate={contractDate}
      />
      </EditGuard>
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
