import { useState } from 'react'

import { API } from '../../config/api'
import { fmtDate, caseStatusCls, priorityCls } from './warrantyUtils'
import CaseFormModal from './WarrantyCaseFormModal'
import CaseDetailModal from './WarrantyCaseDetailModal'
import EditGuard from './EditGuard'

// ── Cases Sub-tab ─────────────────────────────────────────────────────────────

export default function CasesSubTab({ contractId, cases, setCases, equipment, reload }) {
  const [modalOpen, setModal]     = useState(false)
  const [editCase, setEditCase]   = useState(null)
  const [detailCase, setDetail]   = useState(null)

  // Summary
  const open     = cases.filter(c => c.status !== 'Đóng' && c.status !== 'Hoàn thành').length
  const done     = cases.filter(c => c.status === 'Hoàn thành').length
  const urgent   = cases.filter(c => c.priority === 'Khẩn' && c.status !== 'Đóng').length

  async function handleSaveCase(form, isEdit) {
    const url = isEdit ? `${API}/warranty-cases/${editCase.id}` : `${API}/contracts/${contractId}/warranty-cases`
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    if (isEdit) setCases(prev => prev.map(c => c.id === editCase.id ? { ...c, ...data } : c))
    else setCases(prev => [data, ...prev])
    setModal(false)
  }

  async function handleDelete(c) {
    if (!confirm(`Xóa case "${c.case_no||c.title}"? Tất cả nhật ký liên quan sẽ bị xóa.`)) return
    await fetch(`${API}/warranty-cases/${c.id}`, { method: 'DELETE' })
    setCases(prev => prev.filter(x => x.id !== c.id))
  }

  // Auto-generate case number
  const nextCaseNo = `BH-${new Date().getFullYear()}-${String(cases.length + 1).padStart(3, '0')}`

  return (
    <>
      <div className="wty-summary">
        <div className="wty-card wty-card--purple">
          <div className="wty-card-label">Tổng case</div>
          <div className="wty-card-value">{cases.length}</div>
          <div className="wty-card-sub">bảo hành</div>
        </div>
        <div className="wty-card wty-card--blue">
          <div className="wty-card-label">Đang mở</div>
          <div className="wty-card-value">{open}</div>
          <div className="wty-card-sub">cần xử lý</div>
        </div>
        <div className="wty-card wty-card--green">
          <div className="wty-card-label">Hoàn thành</div>
          <div className="wty-card-value">{done}</div>
          <div className="wty-card-sub">case</div>
        </div>
        <div className="wty-card wty-card--red">
          <div className="wty-card-label">Khẩn cấp</div>
          <div className="wty-card-value">{urgent}</div>
          <div className="wty-card-sub">cần ưu tiên</div>
        </div>
      </div>

      <div className="wty-toolbar">
        <div />
        <EditGuard>
          <button className="wty-btn wty-btn-primary" onClick={() => { setEditCase(null); setModal(true) }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Tạo case bảo hành
          </button>
        </EditGuard>
      </div>

      <div className="wty-section">
        <div className="wty-table-wrap">
          <table className="wty-table">
            <thead>
              <tr>
                <th style={{ width:100 }}>Mã case</th>
                <th>Nội dung sự cố</th>
                <th style={{ width:90 }}>Ưu tiên</th>
                <th style={{ width:110 }}>Ngày báo</th>
                <th style={{ width:80 }}>TB liên quan</th>
                <th style={{ width:120 }}>Trạng thái</th>
                <th style={{ width:90 }}></th>
              </tr>
            </thead>
            <tbody>
              {cases.length === 0 ? (
                <tr><td colSpan="7" className="wty-empty">Chưa có case bảo hành nào. Nhấn <strong>Tạo case</strong> khi có sự cố.</td></tr>
              ) : cases.map(c => (
                <tr key={c.id}>
                  <td><strong style={{ color:'#2563eb' }}>{c.case_no||'—'}</strong></td>
                  <td>
                    <div style={{ fontWeight:600 }}>{c.title}</div>
                    {c.reported_by && <div style={{ fontSize:11, color:'#6b7280' }}>Báo bởi: {c.reported_by}</div>}
                  </td>
                  <td><span className={`priority-badge ${priorityCls(c.priority)}`}>{c.priority}</span></td>
                  <td>{fmtDate(c.reported_date)}</td>
                  <td style={{ textAlign:'center' }}>
                    <span style={{ fontWeight:600, color: parseInt(c.equipment_count)>0 ? '#1d4ed8' : '#9ca3af' }}>
                      {c.equipment_count}
                    </span>
                  </td>
                  <td><span className={`case-status ${caseStatusCls(c.status)}`}>{c.status}</span></td>
                  <td>
                    <div className="wty-actions">
                      <button className="wty-btn wty-btn-blue" style={{ padding:'4px 10px', fontSize:12 }}
                        onClick={() => setDetail(c)}>
                        Chi tiết
                      </button>
                      <EditGuard>
                        <button className="wty-act delete" onClick={() => handleDelete(c)} title="Xóa">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                      </EditGuard>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <CaseFormModal
          caseData={editCase}
          defaultCaseNo={nextCaseNo}
          onSave={handleSaveCase}
          onClose={() => setModal(false)}
        />
      )}

      {detailCase && (
        <CaseDetailModal
          caseId={detailCase.id}
          caseData={detailCase}
          equipment={equipment}
          onUpdate={(updated) => { setCases(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c)); reload() }}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  )
}
