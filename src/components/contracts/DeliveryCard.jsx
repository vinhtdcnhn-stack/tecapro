import { useState, useEffect } from 'react'

import { API } from '../../config/api'
import { fmtDate, statusStyle } from './deliveryUtils'
import DeliveryItemRow from './DeliveryItemRow'
import useIsMobile from './useIsMobile'
import EditGuard from './EditGuard'
import useCtrlSave from './useCtrlSave'

// ── Delivery card ─────────────────────────────────────────────────────────────

export default function DeliveryCard({ delivery, boqItems, isExpanded, onToggle, onEdit, onDelete, onItemCountChange }) {
  const [items, setItems]       = useState([])
  const [loadingItems, setLoad] = useState(false)
  const [itemsLoaded, setLoaded]= useState(false)
  const [addItemForm, setAddItem] = useState(false)

  useEffect(() => {
    if (isExpanded && !itemsLoaded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- bật cờ loading rồi fetch khi mở card (theo điều kiện)
      setLoad(true)
      fetch(`${API}/deliveries/${delivery.id}/items`)
        .then(r => r.json())
        .then(d => { setItems(Array.isArray(d) ? d : []); setLoaded(true) })
        .catch(e => console.error(e))
        .finally(() => setLoad(false))
    }
  }, [isExpanded, delivery.id, itemsLoaded])

  // Tải lại danh mục hàng của đợt (sau khi nhập barcode có thể phát sinh chủng loại mới).
  async function reloadItems() {
    setLoad(true)
    try {
      const r = await fetch(`${API}/deliveries/${delivery.id}/items`)
      const d = await r.json()
      const next = Array.isArray(d) ? d : []
      onItemCountChange(next.length - items.length)
      setItems(next)
      setLoaded(true)
    } catch (e) { console.error(e) }
    finally { setLoad(false) }
  }

  async function handleAddItem(form) {
    const res  = await fetch(`${API}/deliveries/${delivery.id}/items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error || 'Lỗi'); return }
    setItems(prev => [...prev, data])
    onItemCountChange(1)
    setAddItem(false)
  }

  async function handleDeleteItem(item) {
    if (!confirm(`Xóa "${item.item_name}"? Serial cũng sẽ bị xóa.`)) return
    await fetch(`${API}/delivery-items/${item.id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(x => x.id !== item.id))
    onItemCountChange(-1)
  }

  async function handleUpdateItem(item, field, value) {
    const updated = { ...item, [field]: value }
    const res = await fetch(`${API}/delivery-items/${item.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    setItems(prev => prev.map(x => x.id === item.id ? { ...x, ...data } : x))
  }

  const ss = statusStyle(delivery.status)
  const isMobile = useIsMobile()

  return (
    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, overflow:'hidden' }}>
      {/* Batch header */}
      <div
        style={{ display:'flex', alignItems: isMobile ? 'flex-start' : 'center', gap:12, padding:'13px 18px', background:'#f9fafb', borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none', cursor:'pointer', flexWrap: isMobile ? 'wrap' : 'nowrap' }}
        onClick={onToggle}
      >
        <span style={{ color:'#9ca3af', fontSize:11, transition:'transform .2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', display:'inline-block', marginTop: isMobile ? 4 : 0 }}>▶</span>

        <div style={{ flex:1, minWidth: isMobile ? '70%' : 0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <strong style={{ fontSize:14, color:'#111827' }}>{delivery.batch_name || 'Đợt nhận'}</strong>
            <span style={{ fontSize:12, color:'#6b7280' }}>{fmtDate(delivery.receive_date)}</span>
            {delivery.warehouse && <span style={{ fontSize:12, color:'#6b7280' }}>📦 {delivery.warehouse}</span>}
          </div>
          <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>
            {delivery.item_count} loại hàng
            {delivery.note && <> · {delivery.note}</>}
          </div>
        </div>

        <span style={{ ...ss, padding:'2px 10px', borderRadius:99, fontSize:11, fontWeight:600 }}>{delivery.status}</span>

        <div style={{ display:'flex', gap:6 }} onClick={e => e.stopPropagation()}>
          <EditGuard>
            <button onClick={onEdit}
              style={{ padding:'4px 10px', borderRadius:5, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', cursor:'pointer', fontSize:12, fontWeight:500 }}>
              Sửa
            </button>
            <button onClick={onDelete}
              style={{ padding:'4px 10px', borderRadius:5, border:'none', background:'#fee2e2', color:'#b91c1c', cursor:'pointer', fontSize:12, fontWeight:500 }}>
              Xóa
            </button>
          </EditGuard>
        </div>
      </div>

      {/* Expanded: items */}
      {isExpanded && (
        <div style={{ padding:'16px 20px' }}>
          {loadingItems ? (
            <div style={{ textAlign:'center', color:'#9ca3af', padding:20 }}>Đang tải...</div>
          ) : (
            <>
              {/* Items table */}
              <div style={{ overflowX:'auto', marginBottom:12 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#f9fafb' }}>
                      {['#','Chủng loại hàng hóa','ĐVT','SL đặt','SL nhận','Serial','Ghi chú',''].map((h,i)=>(
                        <th key={i} style={{ padding:'8px 10px', textAlign: i>=3&&i<=4?'right':'left', fontWeight:600, fontSize:11, color:'#4b5563', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr><td colSpan="8" style={{ padding:'24px', textAlign:'center', color:'#9ca3af' }}>Chưa có hàng hóa. Nhấn "+ Thêm hàng" để thêm.</td></tr>
                    ) : items.map((item, idx) => (
                      <DeliveryItemRow
                        key={item.id}
                        idx={idx}
                        item={item}
                        deliveryId={delivery.id}
                        contractInId={delivery.contract_in_id}
                        onReload={reloadItems}
                        onDelete={() => handleDeleteItem(item)}
                        onUpdateItem={(field, value) => handleUpdateItem(item, field, value)}
                        onSerialCountChange={(delta) =>
                          setItems(prev => prev.map(x => x.id === item.id
                            ? { ...x, serial_count: (parseInt(x.serial_count)||0) + delta }
                            : x))
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add item */}
              {addItemForm ? (
                <AddItemForm
                  boqItems={boqItems}
                  existingNames={items.map(i => i.item_name)}
                  onSave={handleAddItem}
                  onCancel={() => setAddItem(false)}
                />
              ) : (
                <EditGuard>
                  <button
                    onClick={() => setAddItem(true)}
                    style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                    Thêm hàng
                  </button>
                </EditGuard>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Add item form (inline) ────────────────────────────────────────────────────

function AddItemForm({ boqItems, existingNames = [], onSave, onCancel }) {
  const [form, setForm] = useState({
    boq_item_id: '', item_name: '', unit: '', ordered_quantity: '', received_quantity: '', note: '',
  })

  // Chuẩn hóa tên để so trùng (bỏ khoảng trắng thừa, không phân biệt hoa/thường)
  const norm = (s) => String(s || '').trim().toLowerCase()
  const usedNames = new Set(existingNames.map(norm))

  function handleBoqSelect(id) {
    const boq = boqItems.find(b => String(b.id) === String(id))
    if (boq) {
      setForm(p => ({ ...p, boq_item_id: id, item_name: boq.item_name, unit: boq.unit, ordered_quantity: boq.quantity }))
    } else {
      setForm(p => ({ ...p, boq_item_id: '', item_name: '', unit: '' }))
    }
  }

  async function handleSubmit() {
    if (!form.item_name.trim()) { alert('Vui lòng nhập tên hàng hóa'); return }
    if (usedNames.has(norm(form.item_name))) {
      alert(`Chủng loại "${form.item_name.trim()}" đã có trong đợt nhận này. Mỗi chủng loại chỉ thêm một dòng.`)
      return
    }
    await onSave(form)
  }

  // Ctrl/Cmd + S = lưu nhanh (form chỉ mount khi đang mở nên không xung đột tab khác)
  useCtrlSave(handleSubmit)

  return (
    <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'14px 16px', marginTop:8 }}>
      <div style={{ fontSize:12, fontWeight:700, color:'#15803d', marginBottom:10 }}>Thêm hàng hóa vào đợt nhận</div>
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 2fr', gap:8, alignItems:'end', flexWrap:'wrap' }}>
        <div>
          <label style={{ fontSize:11, fontWeight:600, color:'#374151', display:'block', marginBottom:3 }}>Chọn từ BOQ</label>
          <select value={form.boq_item_id} onChange={e => handleBoqSelect(e.target.value)}
            style={{ width:'100%', padding:'6px 8px', border:'1px solid #d1d5db', borderRadius:5, fontSize:12 }}>
            <option value="">-- Chọn hoặc nhập tự do --</option>
            {boqItems.filter(b => !usedNames.has(norm(b.item_name)))
              .map(b => <option key={b.id} value={b.id}>{b.item_name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize:11, fontWeight:600, color:'#374151', display:'block', marginBottom:3 }}>Tên hàng *</label>
          <input type="text" value={form.item_name} onChange={e => setForm(p=>({...p,item_name:e.target.value}))}
            placeholder="Tên hàng..." style={{ width:'100%', padding:'6px 8px', border:'1px solid #d1d5db', borderRadius:5, fontSize:12 }} />
        </div>
        <div>
          <label style={{ fontSize:11, fontWeight:600, color:'#374151', display:'block', marginBottom:3 }}>ĐVT</label>
          <input type="text" value={form.unit} onChange={e => setForm(p=>({...p,unit:e.target.value}))}
            placeholder="Bộ" style={{ width:'100%', padding:'6px 8px', border:'1px solid #d1d5db', borderRadius:5, fontSize:12 }} />
        </div>
        <div>
          <label style={{ fontSize:11, fontWeight:600, color:'#374151', display:'block', marginBottom:3 }}>SL đặt</label>
          <input type="number" value={form.ordered_quantity} onChange={e => setForm(p=>({...p,ordered_quantity:e.target.value}))}
            placeholder="0" min="0" style={{ width:'100%', padding:'6px 8px', border:'1px solid #d1d5db', borderRadius:5, fontSize:12 }} />
        </div>
        <div>
          <label style={{ fontSize:11, fontWeight:600, color:'#374151', display:'block', marginBottom:3 }}>SL nhận thực tế</label>
          <input type="number" value={form.received_quantity} onChange={e => setForm(p=>({...p,received_quantity:e.target.value}))}
            placeholder="0" min="0" style={{ width:'100%', padding:'6px 8px', border:'1px solid #d1d5db', borderRadius:5, fontSize:12 }} />
        </div>
      </div>
      <div style={{ display:'flex', gap:8, marginTop:10, justifyContent:'flex-end' }}>
        <button onClick={onCancel} style={{ padding:'6px 14px', background:'#f3f4f6', border:'none', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600 }}>Hủy</button>
        <button onClick={handleSubmit} style={{ padding:'6px 14px', background:'#16a34a', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600 }}>Thêm hàng</button>
      </div>
    </div>
  )
}
