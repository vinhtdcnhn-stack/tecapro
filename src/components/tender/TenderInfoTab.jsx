import { useState } from 'react'
import { API } from '../../config/api'
import TenderModal from './TenderModal'
import AssignModal from './AssignModal'
import { WORKFLOW, RESULTS, statusColor, resultColor, fmtMoney, fmtAmount, fmtDate } from './tenderUtils'

// Tab "Thông tin chung": hiển thị 16 trường, sửa (người làm thầu/Trưởng phòng),
// phân công (Trưởng phòng), đổi trạng thái workflow & kết quả.
function Row({ label, children }) {
  return (
    <div className="tender-info-row">
      <span className="tender-info-label">{label}</span>
      <span className="tender-info-value">{children || <span className="tender-muted">—</span>}</span>
    </div>
  )
}

export default function TenderInfoTab({ tender, members, isHead, canEdit, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [busy, setBusy] = useState(false)
  const sc = statusColor(tender.workflow_status)
  const rc = resultColor(tender.result)

  async function patchStatus(body) {
    setBusy(true)
    try {
      const res = await fetch(`${API}/tender/${tender.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Lỗi') }
      onChanged?.()
    } catch (e) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tender-info">
      <div className="tender-info-actions">
        <span className="tender-badge" style={{ background: sc.bg, color: sc.fg }}>{tender.workflow_status}</span>
        {rc && <span className="tender-badge" style={{ background: rc.bg, color: rc.fg }}>{tender.result}</span>}
        <div className="tender-toolbar-spacer" />
        {canEdit && <button className="btn-secondary" onClick={() => setEditing(true)}>Sửa thông tin</button>}
        {isHead && <button className="btn-primary" onClick={() => setAssigning(true)}>Phân công</button>}
      </div>

      <div className="tender-info-grid">
        <Row label="Tên gói thầu">{tender.package_name}</Row>
        <Row label="Mã gói thầu">{tender.package_code}</Row>
        <Row label="Chủ đầu tư">{tender.investor}</Row>
        <Row label="Dự toán">
          {tender.estimate != null ? fmtAmount(tender.estimate, tender.currency_code) : null}
          {tender.estimate != null && tender.currency_code && tender.currency_code !== 'VND'
            && tender.exchange_rate > 0
            ? ` (≈ ${fmtMoney(Math.round(tender.estimate * tender.exchange_rate))} đ)` : ''}
        </Row>
        <Row label="Ngày nộp">{fmtDate(tender.submit_date)}</Row>
        <Row label="Lĩnh vực">{tender.field}</Row>
        <Row label="Bảo lãnh">{tender.guarantee}</Row>
        <Row label="Số PAKD">{tender.pakd_no}</Row>
        <Row label="Số UQ">{tender.uq_no}</Row>
        <Row label="QĐ giao nhiệm vụ">{tender.assign_decision}</Row>
        <Row label="Người làm thầu">{tender.bid_maker_name}</Row>
        <Row label="AM phụ trách">{tender.am_name}</Row>
        <Row label="Ghi chú">{tender.note}</Row>
      </div>

      {canEdit && (
        <div className="tender-status-edit">
          <label className="field">
            <span>Cập nhật tình trạng</span>
            <select value={tender.workflow_status} disabled={busy}
              onChange={e => patchStatus({ workflow_status: e.target.value })}>
              {WORKFLOW.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Kết quả</span>
            <select value={tender.result || ''} disabled={busy}
              onChange={e => patchStatus({ result: e.target.value })}>
              <option value="">— Chưa có —</option>
              {RESULTS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        </div>
      )}

      {editing && (
        <TenderModal tender={tender} onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); onChanged?.() }} />
      )}
      {assigning && (
        <AssignModal tender={tender} members={members} onClose={() => setAssigning(false)}
          onSaved={() => { setAssigning(false); onChanged?.() }} />
      )}
    </div>
  )
}
