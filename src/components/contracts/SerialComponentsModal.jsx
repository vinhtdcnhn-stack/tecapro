import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { API } from '../../config/api'

// Modal hiển thị chi tiết linh kiện (serial con) của một máy chính khi click vào serial.
// Nhóm linh kiện theo tên chủng loại (RAM, HDD…). Chỉ đọc.

// zIndex 1200 để nổi trên cả bottom-sheet (msheet-overlay z-index 1100) khi mở lồng từ sheet serial.
const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1200, padding:16 }
const box     = { background:'#fff', borderRadius:12, width:'92vw', maxWidth:480, maxHeight:'85vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,.2)', padding:'20px 22px' }

export default function SerialComponentsModal({ serialId, itemName, onClose }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    let cancelled = false
    fetch(`${API}/delivery-serials/${serialId}/components`)
      .then(async r => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Lỗi tải linh kiện')
        return d
      })
      .then(d => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [serialId])

  // Nhóm theo tên chủng loại linh kiện → [ [type_name, [comp...]] ]
  const grouped = () => {
    const map = new Map()
    for (const c of data?.components || []) {
      if (!map.has(c.type_name)) map.set(c.type_name, [])
      map.get(c.type_name).push(c)
    }
    return [...map.entries()]
  }

  const total = data?.components?.length || 0

  return createPortal(
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, marginBottom:4 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:'#111827' }}>
            🖥 {data?.machine?.serial_no || '…'}
          </h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', fontSize:20, lineHeight:1, padding:0 }}>×</button>
        </div>
        <p style={{ margin:'0 0 16px', fontSize:13, color:'#6b7280' }}>
          Linh kiện của {itemName ? <strong style={{ color:'#111827' }}>{itemName}</strong> : 'máy này'}
          {!loading && !error && ` · ${total} linh kiện`}
        </p>

        {loading && <div style={{ fontSize:13, color:'#9ca3af', padding:'12px 0' }}>Đang tải…</div>}
        {error && <div style={{ fontSize:13, color:'#dc2626', padding:'12px 0' }}>{error}</div>}

        {!loading && !error && total === 0 && (
          <div style={{ fontSize:13, color:'#9ca3af', textAlign:'center', padding:'20px 0' }}>
            Máy này chưa gắn linh kiện nào.
          </div>
        )}

        {!loading && !error && total > 0 && grouped().map(([typeName, comps]) => (
          <div key={typeName} style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:4 }}>
              {typeName} <span style={{ color:'#9ca3af', fontWeight:500 }}>· {comps.length}</span>
            </div>
            {comps.map(c => (
              <div key={c.id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#4b5563', padding:'4px 0 4px 14px', borderBottom:'1px solid #f3f4f6' }}>
                <span style={{ color:'#cbd5e1' }}>↳</span>
                <span style={{ fontWeight:600, color:'#1d4ed8' }}>{c.serial_no}</span>
                {c.status && c.status !== 'Đang hoạt động' && (
                  <span style={{ fontSize:11, color:'#b45309', background:'#fef3c7', borderRadius:4, padding:'1px 6px' }}>{c.status}</span>
                )}
                {c.note && <span style={{ fontSize:11, color:'#9ca3af' }}>{c.note}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>,
    document.body
  )
}
