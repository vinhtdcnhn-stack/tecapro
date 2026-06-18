import { useState, useEffect, useRef } from 'react'

import { API } from '../../config/api'
import EditGuard from './EditGuard'
import BarcodeScanImportModal from './BarcodeScanImportModal'
import SerialComponentsModal from './SerialComponentsModal'
import { exportItemSerials, downloadSerialTemplate } from './deliverySerialExport'

// ── Panel quản lý serial của một chủng loại hàng ──────────────────────────────
// Dùng chung cho desktop (mở trong dòng bảng) và mobile (mở trong sheet riêng).
export default function DeliveryItemSerials({ item, deliveryId, contractInId, onSerialCountChange, onReload }) {
  const [serials, setSerials]       = useState([])
  const [serialsLoaded, setSLoaded] = useState(false)
  const [newSerial, setNewSerial]   = useState('')
  const [showBarcode, setShowBarcode] = useState(false)
  const [compSerial, setCompSerial] = useState(null)   // serial đang xem linh kiện
  const importRef = useRef(null)

  useEffect(() => {
    if (!serialsLoaded) {
      fetch(`${API}/delivery-items/${item.id}/serials`)
        .then(r => r.json())
        .then(d => { setSerials(Array.isArray(d) ? d : []); setSLoaded(true) })
    }
  }, [item.id, serialsLoaded])

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

  async function deleteSerial(sId, serialNo) {
    if (!confirm(`Xóa serial "${serialNo}"?`)) return
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
    setSLoaded(true)
    onReload?.()   // thành phần đi vào chủng loại khác + đồng bộ số đếm chuẩn từ server
    const compCount = (data.imported || 0) - (data.machines || 0)
    alert(`Import thành công ${data.machines} máy${compCount ? ` + ${compCount} serial thành phần` : ''}!`)
  }

  return (
    <div style={{ padding:'12px 16px 16px', background:'#f0f9ff' }}>
      <div style={{ display:'flex', gap:8, marginBottom:10, alignItems:'center', flexWrap:'wrap' }}>
        <strong style={{ fontSize:12, color:'#1d4ed8' }}>Serial của "{item.item_name}"</strong>
        <button
          onClick={() => downloadSerialTemplate(item)}
          style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', background:'#f0fdf4', color:'#15803d', border:'1px solid #bbf7d0', borderRadius:5, cursor:'pointer', fontSize:11, fontWeight:600 }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          Tải mẫu
        </button>
        {serials.length > 0 && (
          <button
            onClick={() => exportItemSerials(API, item)} title="Xuất serial ra Excel (máy chính + thành phần)"
            style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', background:'#f0fdf4', color:'#15803d', border:'1px solid #bbf7d0', borderRadius:5, cursor:'pointer', fontSize:11, fontWeight:600 }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            Xuất Excel
          </button>
        )}
        <EditGuard serial>
          <label style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', background:'#e0f2fe', color:'#0369a1', border:'1px solid #bae6fd', borderRadius:5, cursor:'pointer', fontSize:11, fontWeight:600 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
            Import Excel
            <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={importSerials} />
          </label>
          <button
            onClick={() => setShowBarcode(true)}
            style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', background:'#f3e8ff', color:'#7e22ce', border:'1px solid #e9d5ff', borderRadius:5, cursor:'pointer', fontSize:11, fontWeight:600 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M2 4h2v16H2V4zm3 0h1v16H5V4zm2 0h2v16H7V4zm3 0h1v16h-1V4zm3 0h2v16h-2V4zm3 0h1v16h-1V4zm2 0h2v16h-2V4z"/></svg>
            Nhập từ barcode
          </button>
        </EditGuard>
      </div>

      {/* Serial list */}
      <EditGuard serial>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
        {serials.map(s => (
          <span key={s.id} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', background:'#fff', border:'1px solid #93c5fd', borderRadius:99, fontSize:12, fontWeight:600, color:'#1d4ed8' }}>
            <span
              onClick={() => setCompSerial(s)}
              title="Xem linh kiện của máy này"
              style={{ cursor:'pointer', textDecoration:'underline', textDecorationStyle:'dotted', textUnderlineOffset:2 }}
            >
              {s.serial_no}
            </span>
            <button onClick={() => deleteSerial(s.id, s.serial_no)} style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', fontSize:14, lineHeight:1, padding:0 }}>×</button>
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
      </EditGuard>
      <div style={{ fontSize:11, color:'#6b7280', marginTop:5 }}>
        Mẫu Excel import: <strong>cột đầu = serial máy</strong>, các cột sau = serial thành phần
        (tiêu đề cột = tên loại linh kiện, vd Mainboard, RAM…). Một loại có nhiều serial cho cùng
        1 máy thì viết xuống các dòng dưới, để trống cột máy. File chỉ 1 cột serial vẫn nhập được như cũ.
      </div>

      {showBarcode && (
        <BarcodeScanImportModal
          machineItem={item}
          deliveryId={deliveryId}
          contractInId={contractInId}
          onClose={() => setShowBarcode(false)}
          onSaved={() => { setShowBarcode(false); setSLoaded(false); onReload?.() }}
        />
      )}

      {compSerial && (
        <SerialComponentsModal
          serialId={compSerial.id}
          itemName={item.item_name}
          onClose={() => setCompSerial(null)}
        />
      )}
    </div>
  )
}
