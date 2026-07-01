import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { fetchRowTimeline } from '../admin/auditlog/auditApi'
import { tableLabel, OP_LABELS, OP_COLORS, fmtDateTime } from '../admin/auditlog/auditLabels'
import AuditDiffTable from '../admin/auditlog/AuditDiffTable'
import '../admin/auditlog/audit.css'

// ── Xem lịch sử "hình thành & phát triển" của 1 dòng dữ liệu (CHỈ ADMIN) ───────────
// Trỏ chuột vào một dòng (có gắn data-audit-table/data-audit-id qua common/rowAudit.js)
// rồi nhấn Ctrl+Shift+H → modal liệt kê toàn bộ quá trình tạo/sửa/xóa của đúng dòng đó.
// Mount một lần ở Layout (App.jsx). Bắt phím + vị trí chuột ở mức window nên áp dụng đồng
// nhất cho mọi bảng mà không phải sửa logic từng tab.
//
// Chỉ MỞ MODAL khi dòng thực sự có lịch sử. Các trường hợp còn lại (chưa trỏ đúng dòng,
// dòng chưa có lịch sử, lỗi tải) chỉ hiện một TOAST nhỏ tự tắt — để người dùng nhận phản
// hồi ngay thay vì phải mở modal rồi mới đọc chữ "chưa có".
export default function RowAuditViewer({ user }) {
  const isAdmin = Number(user?.role) === 1
  const mouse = useRef({ x: 0, y: 0 })
  const [state, setState] = useState(null) // { table, id, items } | null — chỉ khi có lịch sử
  const [toast, setToast] = useState('')   // '' | thông báo ngắn
  const toastTimer = useRef(null)

  const showToast = useCallback((msg) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2800)
  }, [])

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  // Theo dõi vị trí chuột để biết "dòng nào" lúc nhấn phím (không cần click/chọn).
  useEffect(() => {
    if (!isAdmin) return
    const onMove = (e) => { mouse.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [isAdmin])

  const openFor = useCallback(async (table, id) => {
    showToast('Đang tải lịch sử…')
    try {
      const data = await fetchRowTimeline(table, id)
      const items = data.items || []
      if (items.length === 0) {
        showToast('Dòng này chưa có lịch sử thay đổi.')
        return
      }
      if (toastTimer.current) clearTimeout(toastTimer.current)
      setToast('')
      setState({ table, id, items })
    } catch (err) {
      showToast(err?.message || 'Không tải được lịch sử của dòng dữ liệu.')
    }
  }, [showToast])

  useEffect(() => {
    if (!isAdmin) return
    const onKey = (e) => {
      // Ctrl+Shift+H (không Alt/Meta). Dùng e.code='KeyH' (phím vật lý, không phụ thuộc
      // layout/IME); phòng khi e.key bị bộ gõ tiếng Việt biến đổi. KHÔNG chặn khi đang focus
      // ô nhập vì đây là tổ hợp có chủ đích, không gõ ra ký tự. Bắt ở CAPTURE để chạy trước
      // các handler phím khác trong trang.
      if (!(e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey)) return
      if (e.code !== 'KeyH' && (e.key || '').toLowerCase() !== 'h') return
      e.preventDefault()
      const { x, y } = mouse.current
      const el = document.elementFromPoint(x, y)
      const row = el?.closest('[data-audit-id]')
      if (!row) {
        showToast('Đưa chuột vào một dòng dữ liệu rồi nhấn Ctrl+Shift+H để xem lịch sử.')
        return
      }
      openFor(row.getAttribute('data-audit-table'), row.getAttribute('data-audit-id'))
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [isAdmin, openFor, showToast])

  // Esc để đóng.
  useEffect(() => {
    if (!state) return
    const onEsc = (e) => { if (e.key === 'Escape') setState(null) }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [state])

  if (!isAdmin) return null

  const close = () => setState(null)
  const title = state?.table ? tableLabel(state.table) : 'Lịch sử dòng dữ liệu'

  return createPortal(
    <>
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(17,24,39,.94)', color: '#fff', padding: '10px 18px', borderRadius: 8,
            fontSize: 13.5, fontWeight: 500, zIndex: 4100, boxShadow: '0 8px 24px rgba(0,0,0,.28)',
            maxWidth: '90vw', textAlign: 'center',
          }}
        >
          {toast}
        </div>
      )}

      {state && (
        <div
          onClick={close}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 4000,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 10, width: 'min(720px, 96vw)', maxHeight: '86vh',
              display: 'flex', flexDirection: 'column', boxShadow: '0 12px 40px rgba(0,0,0,.25)', overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid #eef0f2' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1f2937' }}>Lịch sử: {title}</div>
                {state.id && <div style={{ fontSize: 12, color: '#6b7280' }}>Mã dòng #{state.id}</div>}
              </div>
              <button onClick={close} aria-label="Đóng" style={{ border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: 16, overflowY: 'auto' }}>
              {state.items.map((it) => (
                <div key={it.id} style={{ borderLeft: '3px solid ' + (OP_COLORS[it.op] || '#999'), padding: '6px 0 14px 12px', marginBottom: 4 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: OP_COLORS[it.op] || '#333' }}>{OP_LABELS[it.op] || it.op}</span>
                    <span style={{ fontSize: 13, color: '#374151' }}>{it.actor_name || it.actor_email || 'Hệ thống'}</span>
                    <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>{fmtDateTime(it.at)}</span>
                  </div>
                  <AuditDiffTable row={it} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  )
}
