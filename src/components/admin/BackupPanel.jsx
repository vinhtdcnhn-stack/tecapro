import { useState, useRef } from 'react'
import { API_BASE as API } from '../../config/api'
import UploadsBackupSection from './UploadsBackupSection'

const CONFIRM_PHRASE = 'KHÔI PHỤC'

// Sao lưu / Khôi phục toàn hệ thống (chỉ admin).
// - Backup: gọi GET /api/admin/backup, nhận tệp .tgz và tải về máy.
// - Restore: upload tệp backup + gõ đúng cụm xác nhận để ghi đè toàn bộ dữ liệu.
export default function BackupPanel() {
  const [backupBusy, setBackupBusy] = useState(false)
  const [restoreBusy, setRestoreBusy] = useState(false)
  const [file, setFile] = useState(null)
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState(null)        // { type: 'ok' | 'err', text }
  const fileRef = useRef(null)

  async function handleBackup() {
    setBackupBusy(true)
    setMsg(null)
    try {
      const res = await fetch(`${API}/api/admin/backup`)
      if (!res.ok) {
        let text = 'Không tạo được bản backup.'
        try { text = (await res.json()).error || text } catch { /* phản hồi không phải JSON */ }
        throw new Error(text)
      }
      const blob = await res.blob()
      // Lấy tên tệp từ Content-Disposition, nếu không có thì tự đặt.
      const cd = res.headers.get('Content-Disposition') || ''
      const m = cd.match(/filename="?([^"]+)"?/)
      const name = m ? m[1] : `tecapro-backup-${Date.now()}.tgz`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setMsg({ type: 'ok', text: `Đã tạo và tải bản backup: ${name}` })
    } catch (e) {
      setMsg({ type: 'err', text: e.message || 'Có lỗi xảy ra khi tạo backup.' })
    } finally {
      setBackupBusy(false)
    }
  }

  async function handleRestore() {
    if (!file) { setMsg({ type: 'err', text: 'Vui lòng chọn tệp backup (.tgz).' }); return }
    if (confirm.trim() !== CONFIRM_PHRASE) {
      setMsg({ type: 'err', text: `Vui lòng gõ đúng "${CONFIRM_PHRASE}" để xác nhận.` })
      return
    }
    if (!window.confirm('CẢNH BÁO: Khôi phục sẽ GHI ĐÈ TOÀN BỘ dữ liệu hiện tại bằng dữ liệu trong tệp backup. Hành động này không thể hoàn tác. Bạn chắc chắn?')) return

    setRestoreBusy(true)
    setMsg(null)
    try {
      const fd = new FormData()
      fd.append('backup', file)
      fd.append('confirm', confirm.trim())
      const res = await fetch(`${API}/api/admin/restore`, { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Không khôi phục được hệ thống.')
      setMsg({ type: 'ok', text: 'Khôi phục thành công! Nên tải lại trang để dữ liệu hiển thị đúng.' })
      setFile(null); setConfirm('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      setMsg({ type: 'err', text: e.message || 'Có lỗi xảy ra khi khôi phục.' })
    } finally {
      setRestoreBusy(false)
    }
  }

  const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <h2 className="section-title">SAO LƯU / KHÔI PHỤC HỆ THỐNG</h2>

      {msg && (
        <div style={{
          margin: '0 0 16px', padding: '10px 14px', borderRadius: 6,
          background: msg.type === 'ok' ? '#dcfce7' : '#fee2e2',
          color: msg.type === 'ok' ? '#15803d' : '#b91c1c',
          border: `1px solid ${msg.type === 'ok' ? '#86efac' : '#fca5a5'}`,
        }}>
          {msg.text}
        </div>
      )}

      {/* ── Sao lưu CSDL ── */}
      <div style={{ ...card, borderColor: '#bbf7d0' }}>
        <h3 style={{ marginTop: 0, color: '#166534' }}>🗄️ Cơ sở dữ liệu</h3>
        <p style={{ color: '#555', fontSize: 14, lineHeight: 1.6 }}>
          Tạo một tệp <strong>.tgz</strong> chứa toàn bộ cơ sở dữ liệu (không kèm tệp đính kèm —
          uploads sao lưu riêng bên dưới), rồi tải về máy. Tệp này chứa dữ liệu nhạy cảm — hãy
          cất giữ ở nơi an toàn.
        </p>
        <button className="add-btn" onClick={handleBackup} disabled={backupBusy}>
          {backupBusy ? '⏳ Đang tạo bản backup...' : '⬇️ Tạo & tải bản backup CSDL'}
        </button>
      </div>

      {/* ── Sao lưu uploads (lớn) ── */}
      <UploadsBackupSection />

      {/* ── Khôi phục CSDL ── */}
      <div style={{ ...card, borderColor: '#fca5a5' }}>
        <h3 style={{ marginTop: 0, color: '#b91c1c' }}>♻️ Khôi phục cơ sở dữ liệu</h3>
        <p style={{ color: '#b91c1c', fontSize: 14, lineHeight: 1.6, fontWeight: 600 }}>
          ⚠️ Thao tác này sẽ GHI ĐÈ TOÀN BỘ cơ sở dữ liệu hiện tại bằng dữ liệu trong tệp backup
          CSDL (.tgz) và KHÔNG THỂ hoàn tác. Tệp đính kèm (uploads) khôi phục riêng ở phần trên.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
          <input
            ref={fileRef}
            type="file"
            accept=".tgz,.gz,.tar"
            onChange={e => setFile(e.target.files?.[0] || null)}
            disabled={restoreBusy}
          />
          <label style={{ fontSize: 14, color: '#333' }}>
            Gõ <strong>{CONFIRM_PHRASE}</strong> để xác nhận:
            <input
              type="text"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              disabled={restoreBusy}
              style={{ width: '100%', marginTop: 6, padding: '8px 12px', borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }}
            />
          </label>
          <button
            onClick={handleRestore}
            disabled={restoreBusy || !file || confirm.trim() !== CONFIRM_PHRASE}
            style={{
              padding: '10px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontWeight: 600, color: '#fff',
              background: restoreBusy || !file || confirm.trim() !== CONFIRM_PHRASE ? '#fca5a5' : '#dc2626',
            }}
          >
            {restoreBusy ? '⏳ Đang khôi phục...' : '♻️ Khôi phục CSDL'}
          </button>
        </div>
      </div>
    </div>
  )
}
