import { useState, useEffect, useCallback, useRef } from 'react'
import { API_BASE as API } from '../../config/api'

const CONFIRM_PHRASE = 'KHÔI PHỤC'

function fmtSize(b) {
  if (!b && b !== 0) return ''
  const gb = b / (1024 ** 3)
  if (gb >= 1) return gb.toFixed(2) + ' GB'
  return (b / (1024 ** 2)).toFixed(1) + ' MB'
}
function fmtTime(ms) {
  if (!ms) return ''
  return new Date(ms).toLocaleString('vi-VN')
}

// Sao lưu / khôi phục thư mục uploads (rất lớn, hàng chục GB). Server gói tar trên đĩa
// VPS (job nền) → tải về máy bằng link stream; khôi phục từ tệp .tar có sẵn trên VPS.
export default function UploadsBackupSection() {
  const [job, setJob] = useState({ state: 'idle' })
  const [items, setItems] = useState([])
  const [dir, setDir] = useState('')
  const [confirm, setConfirm] = useState('')
  const [restoreFile, setRestoreFile] = useState('')
  const [msg, setMsg] = useState(null)        // { type, text }
  const pollRef = useRef(null)

  const loadList = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/uploads-backups`)
      const data = await res.json()
      if (res.ok) { setItems(data.items || []); setDir(data.dir || '') }
    } catch { /* bỏ qua */ }
  }, [])

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/uploads-backup/status`)
      const data = await res.json()
      if (res.ok) setJob(data)
      return data
    } catch { return null }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loader async: setState sau await
    loadList(); loadStatus()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [loadList, loadStatus])

  // Khi có job đang chạy thì poll trạng thái mỗi 3s; xong thì dừng + làm mới danh sách.
  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      const data = await loadStatus()
      if (data && data.state !== 'running') {
        clearInterval(pollRef.current); pollRef.current = null
        loadList()
        if (data.state === 'done') setMsg({ type: 'ok', text: data.kind === 'restore' ? 'Khôi phục uploads thành công.' : 'Đã tạo xong bản sao uploads.' })
        else if (data.state === 'error') setMsg({ type: 'err', text: 'Tác vụ lỗi: ' + (data.error || '') })
      }
    }, 3000)
  }

  async function handleBuild() {
    setMsg(null)
    try {
      const res = await fetch(`${API}/api/admin/uploads-backup`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Không bắt đầu được.')
      setJob({ state: 'running', kind: 'build' })
      setMsg({ type: 'ok', text: 'Đang gói uploads trên máy chủ... (có thể mất vài phút với dữ liệu lớn)' })
      startPolling()
    } catch (e) { setMsg({ type: 'err', text: e.message }) }
  }

  async function handleDelete(name) {
    if (!window.confirm(`Xoá bản sao "${name}" khỏi đĩa máy chủ?`)) return
    try {
      const res = await fetch(`${API}/api/admin/uploads-backups?file=${encodeURIComponent(name)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error || 'Không xoá được.')
      loadList()
    } catch (e) { setMsg({ type: 'err', text: e.message }) }
  }

  async function handleRestore() {
    if (!restoreFile) { setMsg({ type: 'err', text: 'Chọn tệp .tar để khôi phục.' }); return }
    if (confirm.trim() !== CONFIRM_PHRASE) { setMsg({ type: 'err', text: `Gõ đúng "${CONFIRM_PHRASE}" để xác nhận.` }); return }
    if (!window.confirm('CẢNH BÁO: Khôi phục sẽ GHI ĐÈ toàn bộ thư mục uploads hiện tại. Tiếp tục?')) return
    setMsg(null)
    try {
      const res = await fetch(`${API}/api/admin/uploads-restore`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: restoreFile, confirm: confirm.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Không khôi phục được.')
      setJob({ state: 'running', kind: 'restore' })
      setConfirm('')
      setMsg({ type: 'ok', text: 'Đang khôi phục uploads...' })
      startPolling()
    } catch (e) { setMsg({ type: 'err', text: e.message }) }
  }

  const running = job.state === 'running'
  const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }

  return (
    <div style={{ ...card, borderColor: '#bfdbfe' }}>
      <h3 style={{ marginTop: 0, color: '#1e40af' }}>🗂️ Tệp đính kèm (uploads)</h3>
      <p style={{ color: '#555', fontSize: 14, lineHeight: 1.6 }}>
        Thư mục uploads có thể rất lớn (hàng chục GB). Máy chủ sẽ gói thành một tệp <strong>.tar</strong>
        trên đĩa, sau đó bạn tải về máy để cất giữ. Link tải hỗ trợ <em>nối lại khi đứt mạng</em>.
      </p>

      {msg && (
        <div style={{
          margin: '0 0 14px', padding: '10px 14px', borderRadius: 6,
          background: msg.type === 'ok' ? '#dcfce7' : '#fee2e2',
          color: msg.type === 'ok' ? '#15803d' : '#b91c1c',
          border: `1px solid ${msg.type === 'ok' ? '#86efac' : '#fca5a5'}`,
        }}>{msg.text}</div>
      )}

      <button className="add-btn" onClick={handleBuild} disabled={running}>
        {running && job.kind === 'build' ? '⏳ Đang gói uploads...' : '📦 Tạo bản sao uploads'}
      </button>
      {running && (
        <span style={{ marginLeft: 12, color: '#1e40af', fontSize: 13 }}>
          Đang chạy ({job.kind === 'restore' ? 'khôi phục' : 'gói'})... cập nhật mỗi 3 giây.
        </span>
      )}

      {/* Danh sách bản sao trên đĩa VPS */}
      <div style={{ marginTop: 18 }}>
        <h4 style={{ margin: '0 0 8px', color: '#333' }}>Bản sao trên máy chủ</h4>
        {dir && <p style={{ color: '#888', fontSize: 12, margin: '0 0 8px' }}>Thư mục: {dir}</p>}
        {items.length === 0 ? (
          <p style={{ color: '#888', fontSize: 14 }}>Chưa có bản sao nào.</p>
        ) : (
          <table className="user-table">
            <thead><tr><th>Tệp</th><th>Dung lượng</th><th>Thời gian</th><th>Thao tác</th></tr></thead>
            <tbody>
              {items.map(it => (
                <tr key={it.name}>
                  <td style={{ wordBreak: 'break-all' }}>{it.name}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtSize(it.size)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtTime(it.mtime)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <a className="edit-btn" style={{ textDecoration: 'none', marginRight: 8 }}
                      href={`${API}/api/admin/uploads-backups/download?file=${encodeURIComponent(it.name)}`}>
                      ⬇️ Tải về
                    </a>
                    <button className="edit-btn" style={{ background: '#dc2626' }} onClick={() => handleDelete(it.name)}>🗑️ Xoá</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Khôi phục uploads từ tệp .tar có sẵn trên máy chủ */}
      <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px dashed #d1d5db' }}>
        <h4 style={{ margin: '0 0 8px', color: '#b91c1c' }}>Khôi phục uploads</h4>
        <p style={{ color: '#b91c1c', fontSize: 13, lineHeight: 1.6 }}>
          ⚠️ Ghi đè toàn bộ thư mục uploads hiện tại. Để khôi phục từ bản đã cất ở máy bạn, hãy
          chép tệp <strong>.tar</strong> vào thư mục bản sao trên máy chủ (qua scp) rồi chọn ở đây.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 480 }}>
          <select value={restoreFile} onChange={e => setRestoreFile(e.target.value)} disabled={running}
            style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }}>
            <option value="">— Chọn tệp .tar trên máy chủ —</option>
            {items.map(it => <option key={it.name} value={it.name}>{it.name} ({fmtSize(it.size)})</option>)}
          </select>
          <input type="text" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder={CONFIRM_PHRASE} disabled={running}
            style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }} />
          <button onClick={handleRestore} disabled={running || !restoreFile || confirm.trim() !== CONFIRM_PHRASE}
            style={{ padding: '10px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, color: '#fff',
              background: running || !restoreFile || confirm.trim() !== CONFIRM_PHRASE ? '#fca5a5' : '#dc2626' }}>
            ♻️ Khôi phục uploads
          </button>
        </div>
      </div>
    </div>
  )
}
