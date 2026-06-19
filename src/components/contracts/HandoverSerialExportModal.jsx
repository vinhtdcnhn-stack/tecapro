import { useState } from 'react'
import { createPortal } from 'react-dom'

import { exportHandoverWorkbook } from './handoverSerialExport'

// Modal chọn & sắp xếp linh kiện trước khi xuất serial bàn giao của một đợt giao hàng.
// sheetData = kết quả buildBatchSerialData(equipment, deliveryId).

const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1200, padding:16 }
const box     = { background:'#fff', borderRadius:12, width:'94vw', maxWidth:560, maxHeight:'88vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(0,0,0,.2)' }
export default function HandoverSerialExportModal({ batchName, sheetData, onClose }) {
  // cfg[equipmentId] = [{ name, on }] theo thứ tự cột mong muốn.
  const [cfg, setCfg] = useState(() => {
    const init = {}
    for (const s of sheetData) init[s.equipment.id] = s.types.map(t => ({ name: t, on: true }))
    return init
  })
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(null)   // { eqId, from, over } — kéo-thả sắp xếp

  const withComponents = sheetData.filter(s => s.types.length > 0)
  const noComponents   = sheetData.filter(s => s.types.length === 0)

  function update(eqId, next) { setCfg(prev => ({ ...prev, [eqId]: next })) }
  function toggle(eqId, idx) {
    const list = cfg[eqId].map((x, i) => i === idx ? { ...x, on: !x.on } : x)
    update(eqId, list)
  }
  function reorder(eqId, from, to) {
    if (from === to || from == null || to == null) return
    const list = [...cfg[eqId]]
    const [moved] = list.splice(from, 1)
    list.splice(to, 0, moved)
    update(eqId, list)
  }

  async function doExport() {
    setBusy(true)
    try {
      const sheets = sheetData.map(s => ({
        ...s,
        types: (cfg[s.equipment.id] || []).filter(x => x.on).map(x => x.name),
      }))
      await exportHandoverWorkbook(batchName, sheets)
      onClose()
    } catch (e) {
      alert('Lỗi xuất: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, padding:'18px 22px 10px' }}>
          <div>
            <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:'#111827' }}>Xuất serial bàn giao</h3>
            <p style={{ margin:'4px 0 0', fontSize:13, color:'#6b7280' }}>
              Đợt <strong style={{ color:'#111827' }}>{batchName}</strong> · {sheetData.length} thiết bị (mỗi thiết bị 1 sheet)
            </p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', fontSize:20, lineHeight:1, padding:0 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ overflowY:'auto', padding:'4px 22px 12px' }}>
          {sheetData.length === 0 && (
            <div style={{ fontSize:13, color:'#9ca3af', textAlign:'center', padding:'24px 0' }}>
              Đợt này chưa có thiết bị nào để xuất.
            </div>
          )}

          {withComponents.map(s => {
            const list = cfg[s.equipment.id] || []
            return (
              <div key={s.equipment.id} style={{ border:'1px solid #e5e7eb', borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:2 }}>{s.equipment.name}</div>
                <div style={{ fontSize:12, color:'#9ca3af', marginBottom:10 }}>
                  {s.machines.length} serial máy · kéo-thả ⠿ để sắp xếp, bỏ tích để loại linh kiện
                </div>
                {list.map((x, idx) => {
                  const eqId = s.equipment.id
                  const dragging = drag?.eqId === eqId && drag.from === idx
                  const isOver   = drag?.eqId === eqId && drag.over === idx && drag.from !== idx
                  return (
                    <div
                      key={x.name}
                      onDragOver={e => { if (drag?.eqId === eqId) { e.preventDefault(); if (drag.over !== idx) setDrag(d => ({ ...d, over: idx })) } }}
                      onDrop={e => { if (drag?.eqId === eqId) { e.preventDefault(); reorder(eqId, drag.from, idx); setDrag(null) } }}
                      style={{
                        display:'flex', alignItems:'center', gap:8, padding:'5px 0',
                        borderTop: isOver ? '2px solid #16a34a' : idx ? '1px solid #f3f4f6' : '2px solid transparent',
                        opacity: dragging ? 0.4 : 1,
                      }}
                    >
                      <span
                        draggable
                        onDragStart={() => setDrag({ eqId, from: idx, over: idx })}
                        onDragEnd={() => setDrag(null)}
                        title="Kéo để sắp xếp"
                        style={{ cursor:'grab', color:'#9ca3af', fontSize:14, lineHeight:1, userSelect:'none', padding:'0 2px' }}
                      >⠿</span>
                      <input type="checkbox" checked={x.on} onChange={() => toggle(eqId, idx)} style={{ accentColor:'#16a34a', cursor:'pointer' }} />
                      <span style={{ flex:1, fontSize:13, color: x.on ? '#374151' : '#9ca3af', textDecoration: x.on ? 'none' : 'line-through' }}>{x.name}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {noComponents.length > 0 && (
            <div style={{ fontSize:12, color:'#6b7280', background:'#f9fafb', border:'1px solid #f3f4f6', borderRadius:8, padding:'8px 12px' }}>
              {noComponents.length} thiết bị không có linh kiện con — chỉ xuất serial thiết bị:
              <div style={{ marginTop:4, color:'#9ca3af' }}>{noComponents.map(s => s.equipment.name).join(', ')}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'12px 22px', borderTop:'1px solid #f3f4f6' }}>
          <button className="wty-btn wty-btn-secondary" onClick={onClose} disabled={busy}>Hủy</button>
          <button className="wty-btn wty-btn-primary" onClick={doExport} disabled={busy || sheetData.length === 0}>
            {busy ? 'Đang xuất…' : 'Xuất Excel'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
