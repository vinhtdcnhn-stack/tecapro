import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'

import { API } from '../../config/api'
import { fmtNum } from './deliveryUtils'

// ── Delivery item row ─────────────────────────────────────────────────────────

export default function DeliveryItemRow({ idx, item, onDelete, onUpdateItem, onSerialCountChange }) {
  const [showSerials, setShowSerials] = useState(false)
  const [serials, setSerials]         = useState([])
  const [serialsLoaded, setSLoaded]   = useState(false)
  const [newSerial, setNewSerial]     = useState('')
  const importRef = useRef(null)

  const [editQty, setEditQty]         = useState(false)
  const [receivedQty, setReceivedQty] = useState(item.received_quantity)

  useEffect(() => {
    if (showSerials && !serialsLoaded) {
      fetch(`${API}/delivery-items/${item.id}/serials`)
        .then(r => r.json())
        .then(d => { setSerials(Array.isArray(d) ? d : []); setSLoaded(true) })
    }
  }, [showSerials, item.id, serialsLoaded])

  async function saveQty() {
    await onUpdateItem('received_quantity', receivedQty)
    setEditQty(false)
  }

  async function addSerial() {
    if (!newSerial.trim()) return
    const res  = await fetch(`${API}/delivery-items/${item.id}/serials`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serial_no: newSerial.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    setSerials(prev => [...prev, data])
    onSerialCountChange(1)
    setNewSerial('')
  }

  async function deleteSerial(sId) {
    await fetch(`${API}/delivery-serials/${sId}`, { method: 'DELETE' })
    setSerials(prev => prev.filter(s => s.id !== sId))
    onSerialCountChange(-1)
  }

  async function importSerials(e) {
    const file = e.target.files[0]
    if (!file) return
    importRef.current.value = ''
    const fd = new FormData()
    fd.append('file', file)
    const res  = await fetch(`${API}/delivery-items/${item.id}/serials/import`, { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) { alert(data.error || 'Lỗi'); return }
    setSerials(prev => [...prev, ...data.items])
    onSerialCountChange(data.imported)
    setSLoaded(true)
    alert(`Import thành công ${data.imported} serial!`)
  }

  const serialCount = parseInt(item.serial_count) || serials.length

  return (
    <>
      <tr style={{ borderBottom:'1px solid #f3f4f6' }}>
        <td style={{ padding:'8px 10px', color:'#9ca3af', fontSize:12, textAlign:'center' }}>{idx+1}</td>
        <td style={{ padding:'8px 10px', fontWeight:500 }}>{item.item_name}</td>
        <td style={{ padding:'8px 10px', color:'#6b7280' }}>{item.unit||'—'}</td>
        <td style={{ padding:'8px 10px', textAlign:'right', color:'#6b7280' }}>{fmtNum(item.ordered_quantity)}</td>
        <td style={{ padding:'8px 10px', textAlign:'right' }}>
          {editQty ? (
            <div style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'flex-end' }}>
              <input type="number" value={receivedQty} min="0"
                onChange={e => setReceivedQty(e.target.value)}
                onKeyDown={e => e.key==='Enter' && saveQty()}
                style={{ width:70, padding:'3px 6px', border:'1px solid #3b82f6', borderRadius:4, fontSize:13, textAlign:'right' }}
                autoFocus />
              <button onClick={saveQty} style={{ padding:'2px 8px', background:'#16a34a', color:'#fff', border:'none', borderRadius:4, cursor:'pointer', fontSize:11 }}>✓</button>
              <button onClick={() => setEditQty(false)} style={{ padding:'2px 8px', background:'#f3f4f6', border:'none', borderRadius:4, cursor:'pointer', fontSize:11 }}>✕</button>
            </div>
          ) : (
            <span
              onClick={() => setEditQty(true)}
              title="Click để sửa"
              style={{ cursor:'pointer', fontWeight:600, color: parseFloat(item.received_quantity) >= parseFloat(item.ordered_quantity) ? '#15803d' : '#d97706', padding:'2px 6px', borderRadius:4, background:'#f9fafb' }}
            >
              {fmtNum(item.received_quantity)} ✎
            </span>
          )}
        </td>
        <td style={{ padding:'8px 10px' }}>
          {serialCount > 0 ? (
            <button
              onClick={() => setShowSerials(!showSerials)}
              style={{ padding:'2px 10px', background:'#eff6ff', color:'#1d4ed8', border:'1px solid #bfdbfe', borderRadius:99, fontSize:11, fontWeight:600, cursor:'pointer' }}
            >
              {serialCount} serial {showSerials ? '▲' : '▼'}
            </button>
          ) : (
            <button
              onClick={() => setShowSerials(!showSerials)}
              style={{ padding:'2px 10px', background:'#f9fafb', color:'#9ca3af', border:'1px solid #e5e7eb', borderRadius:99, fontSize:11, cursor:'pointer' }}
            >
              + Serial
            </button>
          )}
        </td>
        <td style={{ padding:'8px 10px', color:'#9ca3af', fontSize:12 }}>{item.note||'—'}</td>
        <td style={{ padding:'8px 10px', textAlign:'center' }}>
          <button onClick={onDelete} style={{ background:'#fee2e2', color:'#b91c1c', border:'none', borderRadius:5, cursor:'pointer', padding:'3px 8px', fontSize:11, fontWeight:600 }}>Xóa</button>
        </td>
      </tr>

      {/* Serial panel */}
      {showSerials && (
        <tr>
          <td colSpan="8" style={{ padding:0, borderBottom:'2px solid #bfdbfe' }}>
            <div style={{ padding:'12px 16px 16px 40px', background:'#f0f9ff' }}>
              <div style={{ display:'flex', gap:8, marginBottom:10, alignItems:'center', flexWrap:'wrap' }}>
                <strong style={{ fontSize:12, color:'#1d4ed8' }}>Serial của "{item.item_name}"</strong>
                <button
                  onClick={() => {
                    const ws = XLSX.utils.aoa_to_sheet([['Serial'], ['MM001'], ['MM002'], ['MM003']])
                    ws['!cols'] = [{ wch: 20 }]
                    const wb = XLSX.utils.book_new()
                    XLSX.utils.book_append_sheet(wb, ws, 'Serial')
                    XLSX.writeFile(wb, 'mau_serial.xlsx')
                  }}
                  style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', background:'#f0fdf4', color:'#15803d', border:'1px solid #bbf7d0', borderRadius:5, cursor:'pointer', fontSize:11, fontWeight:600 }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                  Tải mẫu
                </button>
                <label style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', background:'#e0f2fe', color:'#0369a1', border:'1px solid #bae6fd', borderRadius:5, cursor:'pointer', fontSize:11, fontWeight:600 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                  Import Excel
                  <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={importSerials} />
                </label>
              </div>

              {/* Serial list */}
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
                {serials.map(s => (
                  <span key={s.id} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', background:'#fff', border:'1px solid #93c5fd', borderRadius:99, fontSize:12, fontWeight:600, color:'#1d4ed8' }}>
                    {s.serial_no}
                    <button onClick={() => deleteSerial(s.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', fontSize:14, lineHeight:1, padding:0 }}>×</button>
                  </span>
                ))}
                {serials.length === 0 && <span style={{ fontSize:12, color:'#9ca3af' }}>Chưa có serial nào.</span>}
              </div>

              {/* Add serial inline */}
              <div style={{ display:'flex', gap:6 }}>
                <input
                  type="text" value={newSerial}
                  onChange={e => setNewSerial(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && addSerial()}
                  placeholder="Nhập serial rồi Enter..."
                  style={{ flex:1, maxWidth:260, padding:'5px 10px', border:'1px solid #93c5fd', borderRadius:5, fontSize:12, outline:'none' }}
                />
                <button onClick={addSerial} style={{ padding:'5px 12px', background:'#2563eb', color:'#fff', border:'none', borderRadius:5, cursor:'pointer', fontSize:12, fontWeight:600 }}>
                  + Thêm
                </button>
              </div>
              <div style={{ fontSize:11, color:'#6b7280', marginTop:5 }}>
                Mẫu Excel import: cột A = Serial (dòng 1 là tiêu đề, từ dòng 2 là dữ liệu)
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
