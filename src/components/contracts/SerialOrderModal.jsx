import { useState, useEffect } from 'react'
import { API } from '../../config/api'
import { apiGet } from '../../lib/api'
import DateInput from './DateInput'

// "Gửi lệnh nhập serial" — người tạo HĐ nhập giao cho một người KỸ THUẬT việc nhập
// serial cho hàng đã nhận. Lệnh tạo ra một CÔNG VIỆC của hợp đồng bán mẹ (xem ở tab
// "Công việc triển khai") và báo Telegram cho người nhận.

// Mặc định hạn hoàn thành: 3 ngày kể từ hôm nay.
function defaultDue() {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  return d.toISOString().slice(0, 10)
}

export default function SerialOrderModal({ contractInId, onClose, onSent }) {
  const [people, setPeople]   = useState([])
  const [userId, setUserId]   = useState('')
  const [dueDate, setDueDate] = useState(defaultDue())
  const [note, setNote]       = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    apiGet('/serial-order-candidates')
      .then(d => setPeople(Array.isArray(d) ? d : []))
      .catch(() => setPeople([]))
  }, [])

  async function send() {
    if (!userId) { alert('Chọn người nhận lệnh.'); return }
    setSending(true)
    try {
      const res = await fetch(`${API}/contract-ins/${contractInId}/serial-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: userId, due_date: dueDate || null, note }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { alert(data.error || 'Không gửi được lệnh.'); return }
      alert('Đã gửi lệnh nhập serial. Việc mới nằm ở tab "Công việc triển khai" của hợp đồng bán.')
      onSent?.(data)
      onClose()
    } catch { alert('Có lỗi xảy ra.') }
    finally { setSending(false) }
  }

  const label = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }
  const input = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, width: 460, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 20 }}
        onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#111827' }}>Gửi lệnh nhập serial</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#6b7280' }}>
          Tạo một công việc giao cho Kỹ thuật nhập serial cho hàng đã nhận, kèm thông báo Telegram.
        </p>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Người nhận lệnh (Kỹ thuật)</label>
          <select style={input} value={userId} onChange={e => setUserId(e.target.value)}>
            <option value="">— Chọn người —</option>
            {people.map(p => (
              <option key={p.id} value={p.id}>
                {p.full_name}{p.department_name ? ` — ${p.department_name}` : ''}
              </option>
            ))}
          </select>
          {people.length === 0 && (
            <div style={{ fontSize: 12, color: '#b45309', marginTop: 5 }}>
              Chưa có nhân sự kỹ thuật nào đang làm việc.
            </div>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Hạn hoàn thành</label>
          <DateInput value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={label}>Ghi chú thêm (tùy chọn)</label>
          <textarea style={{ ...input, minHeight: 72, resize: 'vertical' }} value={note}
            placeholder="VD: nhập cả serial linh kiện rời, chụp ảnh tem serial…"
            onChange={e => setNote(e.target.value)} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose}
            style={{ padding: '8px 16px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Hủy
          </button>
          <button onClick={send} disabled={sending}
            style={{ padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {sending ? 'Đang gửi…' : 'Gửi lệnh'}
          </button>
        </div>
      </div>
    </div>
  )
}
