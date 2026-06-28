import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { API } from '../../config/api'
import { useAuth } from '../../context/AuthContext'
import { useApprovalsMy, qk } from '../../lib/queries'
import useIsMobile from '../contracts/useIsMobile'
import MobileEditSheet from '../contracts/MobileEditSheet'
import RequestForm from './RequestForm'
import RequestDetail from './RequestDetail'
import { statusInfo } from './approvalUtils'
import FormTypeFilter, { useFormTypeFilter } from './FormTypeFilter'

const fmt = (s) => (s ? new Date(s).toLocaleDateString('vi-VN') : '')

function StatusBadge({ s }) {
  const info = statusInfo(s)
  return <span className={`status-badge ${info.cls}`}>{info.label}</span>
}

// Nút hành động theo trạng thái đơn. onAct(r, 'submit'|'cancel'|'delete'); onEdit(r).
function ActionButtons({ r, busy, onAct, onEdit, size = '' }) {
  const cls = `btn btn-sm ${size}`.trim()
  return (
    <>
      {r.status === 'draft' && <>
        <button className={`${cls} btn-primary`} disabled={busy} onClick={() => onAct(r, 'submit')}>Gửi</button>
        <button className={cls} disabled={busy} onClick={() => onEdit(r)}>Sửa</button>
        <button className={`${cls} btn-danger`} disabled={busy} onClick={() => onAct(r, 'delete')}>Xóa</button>
      </>}
      {r.status === 'pending' && <button className={`${cls} btn-danger`} disabled={busy} onClick={() => onAct(r, 'cancel')}>Hủy</button>}
    </>
  )
}

// "Đơn của tôi": danh sách + tạo/sửa/gửi/hủy/xóa. Desktop = bảng, mobile = thẻ + sheet.
export default function RequestList() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)   // đơn nháp đang sửa
  const [sheet, setSheet] = useState(null)        // đơn đang mở sheet (mobile)
  const [detailId, setDetailId] = useState(null)  // đơn đang xem chi tiết
  const [busy, setBusy] = useState(false)
  // Danh sách đơn của tôi qua TanStack Query; load() (sau khi gửi/hủy/xóa/sửa) = invalidate.
  const { data: rows = [] } = useApprovalsMy()
  const load = () => queryClient.invalidateQueries({ queryKey: qk.approvalsMy })
  const { formId, setFormId, options, filtered } = useFormTypeFilter(rows)

  function openCreate() { setEditing(null); setFormOpen(true) }
  async function openEdit(r) {
    // Cần form_data đầy đủ → lấy chi tiết trước khi mở form sửa.
    const res = await fetch(`${API}/approvals/requests/${r.id}`)
    const full = res.ok ? await res.json() : r
    setEditing(full); setFormOpen(true); setSheet(null)
  }

  async function act(r, action) {
    const labels = { submit: 'gửi duyệt', cancel: 'hủy', delete: 'xóa' }
    if ((action === 'cancel' || action === 'delete') && !confirm(`Bạn chắc chắn muốn ${labels[action]} đơn này?`)) return
    setBusy(true)
    try {
      const url = action === 'delete'
        ? `${API}/approvals/requests/${r.id}`
        : `${API}/approvals/requests/${r.id}/${action}`
      const res = await fetch(url, { method: action === 'delete' ? 'DELETE' : 'POST' })
      if (!res.ok) { alert((await res.json().catch(() => ({}))).error || 'Thao tác thất bại.'); return }
      setSheet(null); load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="ab-section-head">
        <h2 className="section-title" style={{ margin: 0 }}>ĐƠN CỦA TÔI</h2>
        <div className="ar-head-tools">
          <FormTypeFilter value={formId} onChange={setFormId} options={options} />
          {isMobile ? (
            <button type="button" className="btn btn-primary ar-create-icon" onClick={openCreate}
              title="Tạo đơn" aria-label="Tạo đơn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={openCreate}>+ Tạo đơn</button>
          )}
        </div>
      </div>

      {rows.length === 0 && <p className="approval-empty">Bạn chưa có đơn nào.</p>}
      {rows.length > 0 && filtered.length === 0 && <p className="approval-empty">Không có đơn nào thuộc loại đã chọn.</p>}

      {/* Desktop: bảng */}
      {!isMobile && filtered.length > 0 && (
        <table className="data-table ar-table">
          <thead>
            <tr><th>Loại đơn</th><th>Tiêu đề</th><th>Trạng thái</th><th>Bước hiện tại</th><th>Ngày tạo</th><th>Hành động</th></tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td>{r.form_icon ? `${r.form_icon} ` : ''}{r.form_name}</td>
                <td><button className={`ar-link${r.deleted_at ? ' ar-deleted' : ''}`} onClick={() => setDetailId(r.id)}>{r.title}</button></td>
                <td><StatusBadge s={r.status} />{r.deleted_at && <span className="status-badge status-cancelled" style={{ marginLeft: 4 }}>Đã xóa</span>}</td>
                <td>{r.status === 'pending' ? (r.current_step_name || '') : ''}</td>
                <td>{fmt(r.created_at)}</td>
                <td className="ar-actions"><ActionButtons r={r} busy={busy} onAct={act} onEdit={openEdit} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Mobile: thẻ → mở sheet */}
      {isMobile && filtered.map(r => (
        <div key={r.id} className="ar-card" onClick={() => setSheet(r)}>
          <div className="ar-card-top">
            <span className={`ar-card-title${r.deleted_at ? ' ar-deleted' : ''}`}>{r.form_icon ? `${r.form_icon} ` : ''}{r.title}</span>
            <StatusBadge s={r.status} />
          </div>
          <div className="ar-card-meta">
            <span>{r.form_name}</span>
            <span>{fmt(r.created_at)}</span>
          </div>
        </div>
      ))}

      {formOpen && (
        <RequestForm
          existing={editing}
          onClose={() => setFormOpen(false)}
          onDone={() => { setFormOpen(false); load() }}
        />
      )}

      {sheet && (
        <MobileEditSheet title={sheet.title} onClose={() => setSheet(null)}>
          <div className="ar-sheet-meta">
            <div><b>Loại đơn:</b> {sheet.form_name}</div>
            <div><b>Trạng thái:</b> <StatusBadge s={sheet.status} /></div>
            {sheet.status === 'pending' && <div><b>Đang ở bước:</b> {sheet.current_step_name}</div>}
            <div><b>Ngày tạo:</b> {fmt(sheet.created_at)}</div>
          </div>
          <div className="ar-sheet-actions">
            <button className="btn btn-sm" onClick={() => { const id = sheet.id; setSheet(null); setDetailId(id) }}>Xem chi tiết</button>
            <ActionButtons r={sheet} busy={busy} onAct={act} onEdit={openEdit} />
          </div>
        </MobileEditSheet>
      )}

      {detailId && (
        <RequestDetail
          requestId={detailId}
          currentUserId={user.id}
          onClose={() => setDetailId(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}
