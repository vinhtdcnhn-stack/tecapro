import { useState, useEffect, useCallback, useRef } from 'react'
import Modal from '../common/Modal'
import Linkify from '../common/Linkify'
import { Field } from '../contracts/MobileEditSheet'
import HandoffModal from './HandoffModal'
import TaskTimeline from './TaskTimeline'
import { API, API_BASE } from '../../config/api'
import { fmtDate, ACCEPT_LABEL } from './deptWorkUtils'

const fmtSize = (b) => !b ? '' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`

// Ngăn xem chi tiết việc: thông tin, người nhận (★ nhóm trưởng + trạng thái nhận), đính kèm.
// Desktop = drawer phải; mobile = toàn màn hình (CSS).
export default function TaskDetailDrawer({
  taskId, currentUser, canManage, members = [],
  onConfirmDone, onRejectDone, onClose, onEdit, onChanged, onRead,
}) {
  const [task, setTask] = useState(null)
  const [atts, setAtts] = useState([])
  const [uploading, setUploading] = useState(false)
  const [handoffOpen, setHandoffOpen] = useState(false)
  const [escalateOpen, setEscalateOpen] = useState(false)
  const [escalateNote, setEscalateNote] = useState('')
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const [t, a] = await Promise.all([
        fetch(`${API}/dept-work/tasks/${taskId}`).then(r => r.ok ? r.json() : null),
        fetch(`${API}/dept-work/tasks/${taskId}/attachments`).then(r => r.ok ? r.json() : []),
      ])
      setTask(t)
      setAtts(Array.isArray(a) ? a : [])
    } catch (e) { console.error('load task detail:', e) }
  }, [taskId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async: setState sau await
  useEffect(() => { load() }, [load])

  // Lượt giao đang active của user hiện tại (pending = đang được chuyển tới; accepted = đang giữ).
  const myAsg = task?.assignees?.find(a => a.assignee_id === currentUser?.id)
  // Được upload nếu là head/deputy/admin hoặc người đang được giao việc.
  const canUpload = canManage || !!myAsg
  // Xác nhận / trả lại kết quả: trưởng-phó phòng, admin, hoặc chính người giao việc.
  const canConfirm = canManage || Number(task?.created_by) === Number(currentUser?.id)

  async function postAction(path, body) {
    try {
      const opt = body
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        : { method: 'POST' }
      const res = await fetch(`${API}${path}`, opt)
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { alert(d.error || 'Thao tác thất bại'); return false }
      await load(); onChanged?.()
      return true
    } catch { alert('Có lỗi xảy ra.'); return false }
  }

  const doAccept = () => postAction(`/dept-work/assignments/${myAsg.id}/accept`)
  const doReject = async () => { if (confirm('Từ chối việc được chuyển cho bạn?')) await postAction(`/dept-work/assignments/${myAsg.id}/reject`) }
  const doHandoff = (toUserId, note) => postAction(`/dept-work/assignments/${myAsg.id}/handoff`, { to_user_id: toUserId, note })
  const doResolve = () => postAction(`/dept-work/tasks/${taskId}/escalate-resolve`)
  async function doEscalate() {
    const ok = await postAction(`/dept-work/tasks/${taskId}/escalate`, { note: escalateNote.trim() || null })
    if (ok) { setEscalateOpen(false); setEscalateNote('') }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${API}/dept-work/tasks/${taskId}/attachments`, { method: 'POST', body: fd })
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Tải lên thất bại') }
      else { await load(); onChanged?.() }
    } catch { alert('Có lỗi khi tải lên.') }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function handleDeleteAtt(att) {
    if (!confirm(`Xóa tệp "${att.file_name}"?`)) return
    try {
      const res = await fetch(`${API}/dept-work/task-attachments/${att.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Xóa thất bại'); return }
      await load(); onChanged?.()
    } catch { alert('Có lỗi khi xóa.') }
  }

  return (
    <Modal onClose={onClose} overlayClassName="dw-drawer-overlay" contentClassName="dw-drawer-panel" labelledBy="dw-drawer-title">
      <div className="dw-drawer-header">
        <h3 id="dw-drawer-title">{task?.title || 'Chi tiết công việc'}</h3>
        <button className="close-btn" onClick={onClose} aria-label="Đóng">✕</button>
      </div>

      {!task ? (
        <div className="dw-drawer-body"><p className="dash-empty">Đang tải...</p></div>
      ) : (
        <div className="dw-drawer-body">
          {(myAsg || (canManage && task.escalated)) && (
            <div className="dw-action-area">
              {myAsg?.accept_state === 'pending' && (
                <div className="dw-action-bar dw-action-pending">
                  <span>📥 Bạn được chuyển việc này:</span>
                  <button className="save-btn" onClick={doAccept}>Chấp nhận</button>
                  <button className="dw-del-btn" onClick={doReject}>Từ chối</button>
                </div>
              )}
              {myAsg?.accept_state === 'accepted' && (
                <div className="dw-action-bar">
                  <button className="dw-act-btn" onClick={() => setHandoffOpen(true)}>↪ Chuyển việc</button>
                  {!task.escalated && <button className="dw-act-btn dw-act-warn" onClick={() => setEscalateOpen(true)}>⬆ Đẩy cấp trên</button>}
                </div>
              )}
              {canManage && task.escalated && (
                <div className="dw-action-bar">
                  <button className="dw-act-btn" onClick={doResolve}>✓ Đã xử lý (gỡ cờ đẩy)</button>
                </div>
              )}
            </div>
          )}

          <dl className="dw-detail-grid">
            <dt>Người giao</dt><dd>{task.created_by_name || '—'}</dd>
            <dt>Hạn hoàn thành</dt><dd>{fmtDate(task.due_date)}</dd>
          </dl>

          {/* Đã báo hoàn thành, chờ người giao việc (hoặc trưởng/phó phòng) chốt */}
          {task.completion_pending && (
            <div className="task-await-panel">
              <div className="task-await-panel-text">
                ⏳ <strong>{task.completion_requested_by_name || 'Người thực hiện'}</strong> đã báo hoàn thành
                {task.completion_requested_at ? ` lúc ${new Date(task.completion_requested_at).toLocaleString('vi-VN')}` : ''}.
                {canConfirm
                  ? ' Bạn hãy kiểm tra rồi xác nhận, hoặc trả lại kèm lý do.'
                  : ' Đang chờ người giao việc xác nhận.'}
              </div>
              {canConfirm && (
                <div className="task-await-panel-actions">
                  <button type="button" className="task-await-panel-btn ok"
                    onClick={async () => { await onConfirmDone?.(task); load(); onChanged?.() }}>
                    ✔ Xác nhận hoàn thành
                  </button>
                  <button type="button" className="task-await-panel-btn no" onClick={() => onRejectDone?.(task)}>
                    ✘ Chưa đạt
                  </button>
                </div>
              )}
            </div>
          )}
          {!task.completion_pending && Number(task.completion_reject_count) > 0 && task.completion_reject_reason && (
            <div className="task-reject-note">
              ❌ Bị trả lại {task.completion_reject_count} lần. Lý do gần nhất: <strong>{task.completion_reject_reason}</strong>
            </div>
          )}

          {task.description && <Section title="Mô tả"><p className="dw-pre"><Linkify text={task.description} onNavigate={onClose} /></p></Section>}

          <Section title={`Người nhận (${task.assignees?.length || 0})`}>
            {task.assignees?.length ? (
              <ul className="dw-assignee-view">
                {task.assignees.map(a => (
                  <li key={a.id}>
                    {a.is_lead && <span className="dw-lead-tag">★ Nhóm trưởng</span>}
                    <span>{a.assignee_name}</span>
                    {a.accept_state !== 'accepted' && <span className="dw-accept-tag">{ACCEPT_LABEL[a.accept_state]}</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="dash-empty">Chưa giao cho ai.</p>}
          </Section>

          <Section title={`Tài liệu đính kèm (${atts.length})`}>
            <div className="dw-att-list">
              {atts.map(att => (
                <div key={att.id} className="dw-att-item">
                  <a href={`${API_BASE}${att.file_path}`} target="_blank" rel="noreferrer" className="dw-att-name" title={att.file_name}>📎 {att.file_name}</a>
                  <span className="dw-att-size">{fmtSize(att.file_size)}</span>
                  {(canManage || att.uploaded_by === currentUser?.id) && (
                    <button className="dw-att-del" onClick={() => handleDeleteAtt(att)} title="Xóa">✕</button>
                  )}
                </div>
              ))}
              {atts.length === 0 && <p className="dash-empty">Chưa có tài liệu.</p>}
            </div>
            {canUpload && (
              <label className="dw-att-add">
                {uploading ? 'Đang tải lên…' : '+ Thêm tệp'}
                <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
              </label>
            )}
          </Section>

          <TaskTimeline
            taskId={taskId}
            task={task}
            currentUser={currentUser}
            canManage={canManage}
            onChanged={onChanged}
            onRead={onRead}
          />
        </div>
      )}

      {canManage && task && (
        <div className="dw-drawer-footer">
          <button className="cancel-btn" onClick={onClose}>Đóng</button>
          <button className="save-btn" onClick={() => onEdit(task)}>Sửa công việc</button>
        </div>
      )}

      {handoffOpen && (
        <HandoffModal
          members={members}
          excludeIds={task?.assignees?.map(a => a.assignee_id) || []}
          onSubmit={doHandoff}
          onClose={() => setHandoffOpen(false)}
        />
      )}
      {escalateOpen && (
        <Modal onClose={() => setEscalateOpen(false)} labelledBy="dw-esc-title" width="440px">
          <div className="modal-header">
            <h2 id="dw-esc-title">Đẩy việc lên cấp trên</h2>
            <button className="close-btn" onClick={() => setEscalateOpen(false)} aria-label="Đóng">✕</button>
          </div>
          <div className="modal-body dw-modal-body">
            <Field label="Lý do / vướng mắc">
              <textarea value={escalateNote} onChange={e => setEscalateNote(e.target.value)} placeholder="Vì sao cần trưởng/phó phòng xử lý..." />
            </Field>
          </div>
          <div className="modal-footer">
            <button className="cancel-btn" onClick={() => setEscalateOpen(false)}>Hủy</button>
            <button className="save-btn" onClick={doEscalate}>Đẩy lên</button>
          </div>
        </Modal>
      )}
    </Modal>
  )
}

function Section({ title, children }) {
  return (
    <div className="dw-detail-section">
      <h4 className="dw-detail-title">{title}</h4>
      {children}
    </div>
  )
}
