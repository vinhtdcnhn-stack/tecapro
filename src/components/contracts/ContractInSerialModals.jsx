import { useState } from 'react'
import DateInput from './DateInput'
import { API } from '../../config/api'
import { SERIAL_STATUSES } from './warrantyUtils'

const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }
const box     = { background:'#fff', borderRadius:12, width:'92vw', maxWidth:480, boxShadow:'0 24px 64px rgba(0,0,0,.2)', padding:'20px 22px' }
const label   = { fontSize:12, fontWeight:600, color:'#374151', marginBottom:4, display:'block' }
const field   = { width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:7, fontSize:13, fontFamily:'inherit', boxSizing:'border-box', outline:'none' }
const row      = { marginBottom:14 }
const btnPri  = { padding:'8px 18px', background:'#16a34a', color:'#fff', border:'none', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer' }
const btnSec  = { padding:'8px 16px', background:'#fff', color:'#374151', border:'1px solid #d1d5db', borderRadius:7, fontSize:13, fontWeight:500, cursor:'pointer' }

const itemLabel = (it) => `${it.item_name}${it.batch_name ? ` · ${it.batch_name}` : ''}`

// ── Thêm linh kiện (1 serial gắn vào 1 chủng loại + máy cha tùy chọn) ──────────
export function AddComponentModal({ items, parentOptions, onClose, onSaved }) {
  const [itemId, setItemId]   = useState(items[0]?.id || '')
  const [serialNo, setSerial] = useState('')
  const [parentId, setParent] = useState('')
  const [status, setStatus]   = useState('Đang hoạt động')
  const [note, setNote]       = useState('')
  const [saving, setSaving]   = useState(false)

  async function submit() {
    if (!itemId) { alert('Chọn chủng loại hàng'); return }
    if (!serialNo.trim()) { alert('Nhập số serial'); return }
    setSaving(true)
    try {
      const res = await fetch(`${API}/delivery-items/${itemId}/serials`, {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ serial_no: serialNo, parent_serial_id: parentId || null, status, note }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Lỗi'); return }
      onSaved()
    } catch (e) { alert('Lỗi: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin:'0 0 16px', fontSize:16, fontWeight:700, color:'#111827' }}>Thêm linh kiện / serial</h3>
        <div style={row}>
          <label style={label}>Chủng loại hàng *</label>
          <select style={field} value={itemId} onChange={e => setItemId(e.target.value)}>
            {items.length === 0 && <option value="">— Chưa có hàng nhận nào —</option>}
            {items.map(it => <option key={it.id} value={it.id}>{itemLabel(it)}</option>)}
          </select>
        </div>
        <div style={row}>
          <label style={label}>Số serial *</label>
          <input style={field} value={serialNo} onChange={e => setSerial(e.target.value)} placeholder="Nhập serial..." autoFocus />
        </div>
        <div style={row}>
          <label style={label}>Thuộc máy (tùy chọn)</label>
          <select style={field} value={parentId} onChange={e => setParent(e.target.value)}>
            <option value="">— Không gắn / là máy độc lập —</option>
            {parentOptions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div style={{ ...row, display:'flex', gap:12 }}>
          <div style={{ flex:1 }}>
            <label style={label}>Tình trạng</label>
            <select style={field} value={status} onChange={e => setStatus(e.target.value)}>
              {SERIAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={row}>
          <label style={label}>Ghi chú</label>
          <input style={field} value={note} onChange={e => setNote(e.target.value)} placeholder="(tùy chọn)" />
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:6 }}>
          <button style={btnSec} onClick={onClose}>Hủy</button>
          <button style={btnPri} onClick={submit} disabled={saving}>{saving ? 'Đang lưu…' : 'Thêm'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Import serial Excel vào 1 chủng loại ───────────────────────────────────────
export function ImportSerialModal({ items, onClose, onSaved }) {
  const [itemId, setItemId] = useState(items[0]?.id || '')
  const [busy, setBusy]     = useState(false)

  async function pick(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!itemId) { alert('Chọn chủng loại trước'); return }
    setBusy(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res  = await fetch(`${API}/delivery-items/${itemId}/serials/import`, { method:'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Lỗi import'); return }
      alert(`Import thành công ${data.imported} serial!`)
      onSaved()
    } catch (e) { alert('Lỗi: ' + e.message) }
    finally { setBusy(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin:'0 0 16px', fontSize:16, fontWeight:700, color:'#111827' }}>Import serial từ Excel</h3>
        <div style={row}>
          <label style={label}>Gán vào chủng loại *</label>
          <select style={field} value={itemId} onChange={e => setItemId(e.target.value)}>
            {items.length === 0 && <option value="">— Chưa có hàng nhận nào —</option>}
            {items.map(it => <option key={it.id} value={it.id}>{itemLabel(it)}</option>)}
          </select>
        </div>
        <div style={{ fontSize:12, color:'#6b7280', marginBottom:14, lineHeight:1.5 }}>
          File Excel: cột A = Serial (dòng 1 là tiêu đề, từ dòng 2 là dữ liệu).
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button style={btnSec} onClick={onClose}>Đóng</button>
          <label style={{ ...btnPri, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Đang import…' : 'Chọn file Excel'}
            <input type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={pick} disabled={busy} />
          </label>
        </div>
      </div>
    </div>
  )
}

// ── Thay thế serial ────────────────────────────────────────────────────────────
export function ReplaceSerialModal({ serial, onClose, onSaved }) {
  const [newSerial, setNewSerial] = useState('')
  const [date, setDate]           = useState('')
  const [saving, setSaving]       = useState(false)

  async function submit() {
    if (!newSerial.trim()) { alert('Nhập serial mới'); return }
    setSaving(true)
    try {
      const res = await fetch(`${API}/delivery-serials/${serial.id}/replace`, {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ new_serial_no: newSerial, replaced_at: date || null }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Lỗi'); return }
      onSaved()
    } catch (e) { alert('Lỗi: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin:'0 0 6px', fontSize:16, fontWeight:700, color:'#111827' }}>Thay thế serial</h3>
        <p style={{ margin:'0 0 16px', fontSize:13, color:'#6b7280' }}>
          Serial cũ <strong style={{ color:'#b91c1c' }}>{serial.serial_no}</strong> sẽ chuyển sang "Đã thay thế".
        </p>
        <div style={row}>
          <label style={label}>Serial mới *</label>
          <input style={field} value={newSerial} onChange={e => setNewSerial(e.target.value)} placeholder="Nhập serial thay thế..." autoFocus />
        </div>
        <div style={row}>
          <label style={label}>Ngày thay thế</label>
          <DateInput style={field} value={date} onChange={e => setDate(e.target.value)} placeholder="dd/mm/yyyy (mặc định hôm nay)" />
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:6 }}>
          <button style={btnSec} onClick={onClose}>Hủy</button>
          <button style={btnPri} onClick={submit} disabled={saving}>{saving ? 'Đang lưu…' : 'Thay thế'}</button>
        </div>
      </div>
    </div>
  )
}
