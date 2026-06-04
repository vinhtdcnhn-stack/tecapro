import { useState, useEffect, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'

import { API } from '../../config/api'

const DELIVERY_STATUSES = ['Chờ nhận', 'Đang nhận', 'Đã nhận đủ', 'Nhận một phần']
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'
const fmtNum  = (n) => new Intl.NumberFormat('vi-VN').format(parseFloat(n) || 0)

function statusStyle(s) {
  if (s === 'Đã nhận đủ')     return { background: '#dcfce7', color: '#15803d' }
  if (s === 'Nhận một phần')  return { background: '#fef9c3', color: '#a16207' }
  if (s === 'Đang nhận')      return { background: '#dbeafe', color: '#1d4ed8' }
  return { background: '#f3f4f6', color: '#6b7280' }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ContractInDeliveryTab({ contractInId }) {
  const [deliveries, setDeliveries]   = useState([])
  const [boqItems, setBoqItems]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [expandedId, setExpandedId]   = useState(null)
  const [addBatchModal, setAddBatch]  = useState(false)
  const [editBatch, setEditBatch]     = useState(null)

  const load = useCallback(async () => {
    try {
      const [dRes, bRes] = await Promise.all([
        fetch(`${API}/contract-ins/${contractInId}/deliveries`),
        fetch(`${API}/contract-ins/${contractInId}/boq`),
      ])
      const [dData, bData] = await Promise.all([dRes.json(), bRes.json()])
      setDeliveries(Array.isArray(dData) ? dData : [])
      setBoqItems(Array.isArray(bData) ? bData : [])
    } catch (e) { console.error('load deliveries:', e) }
    finally { setLoading(false) }
  }, [contractInId])

  useEffect(() => { load() }, [load])

  async function handleSaveBatch(form, isEdit) {
    const url    = isEdit ? `${API}/deliveries/${editBatch.id}` : `${API}/contract-ins/${contractInId}/deliveries`
    const method = isEdit ? 'PUT' : 'POST'
    const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data   = await res.json()
    if (!res.ok) { alert(data.error || 'Lỗi lưu'); return }
    if (isEdit) {
      setDeliveries(prev => prev.map(d => d.id === editBatch.id ? { ...d, ...data } : d))
    } else {
      setDeliveries(prev => [data, ...prev])
      setExpandedId(data.id)
    }
    setAddBatch(false)
    setEditBatch(null)
  }

  async function handleDeleteBatch(d) {
    if (!confirm(`Xóa đợt nhận "${d.batch_name || fmtDate(d.receive_date)}"? Tất cả hàng hóa và serial sẽ bị xóa.`)) return
    await fetch(`${API}/deliveries/${d.id}`, { method: 'DELETE' })
    setDeliveries(prev => prev.filter(x => x.id !== d.id))
    if (expandedId === d.id) setExpandedId(null)
  }

  // Stats
  const totalBatches  = deliveries.length
  const received      = deliveries.filter(d => d.status === 'Đã nhận đủ').length
  const totalReceived = deliveries.reduce((s, d) => s + parseFloat(d.total_received || 0), 0)

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Đang tải...</div>

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
        {[
          { label: 'Tổng đợt nhận', value: totalBatches, color: '#3b82f6' },
          { label: 'Đã nhận đủ',    value: received,     color: '#16a34a' },
          { label: 'Tổng SL nhận',  value: fmtNum(totalReceived), color: '#8b5cf6', unit: '' },
        ].map((c, i) => (
          <div key={i} style={{ background:'#fff', border:`1px solid #e5e7eb`, borderLeft:`4px solid ${c.color}`, borderRadius:10, padding:'14px 16px' }}>
            <div style={{ fontSize:11, color:'#6b7280', fontWeight:500, textTransform:'uppercase', letterSpacing:'.3px' }}>{c.label}</div>
            <div style={{ fontSize:24, fontWeight:700, color:'#111827', marginTop:2 }}>{c.value}{c.unit}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button
          onClick={() => { setEditBatch(null); setAddBatch(true) }}
          style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', background:'#16a34a', color:'#fff', border:'none', borderRadius:7, cursor:'pointer', fontSize:13, fontWeight:600 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Thêm đợt nhận hàng
        </button>
      </div>

      {/* Delivery list */}
      {deliveries.length === 0 ? (
        <div style={{ padding:48, textAlign:'center', color:'#9ca3af', background:'#fff', border:'1px solid #e5e7eb', borderRadius:10 }}>
          Chưa có đợt nhận hàng nào. Nhấn <strong>Thêm đợt nhận hàng</strong> để bắt đầu.
        </div>
      ) : deliveries.map(delivery => (
        <DeliveryCard
          key={delivery.id}
          delivery={delivery}
          boqItems={boqItems}
          isExpanded={expandedId === delivery.id}
          onToggle={() => setExpandedId(prev => prev === delivery.id ? null : delivery.id)}
          onEdit={() => { setEditBatch(delivery); setAddBatch(true) }}
          onDelete={() => handleDeleteBatch(delivery)}
          onItemCountChange={(delta) =>
            setDeliveries(prev => prev.map(d => d.id === delivery.id
              ? { ...d, item_count: (parseInt(d.item_count)||0) + delta }
              : d))
          }
        />
      ))}

      {/* Add/Edit batch modal */}
      {addBatchModal && (
        <BatchModal
          batch={editBatch}
          onSave={handleSaveBatch}
          onClose={() => { setAddBatch(false); setEditBatch(null) }}
        />
      )}
    </div>
  )
}

// ── Delivery card ─────────────────────────────────────────────────────────────

function DeliveryCard({ delivery, boqItems, isExpanded, onToggle, onEdit, onDelete, onItemCountChange }) {
  const [items, setItems]       = useState([])
  const [loadingItems, setLoad] = useState(false)
  const [itemsLoaded, setLoaded]= useState(false)
  const [addItemForm, setAddItem] = useState(false)

  useEffect(() => {
    if (isExpanded && !itemsLoaded) {
      setLoad(true)
      fetch(`${API}/deliveries/${delivery.id}/items`)
        .then(r => r.json())
        .then(d => { setItems(Array.isArray(d) ? d : []); setLoaded(true) })
        .catch(e => console.error(e))
        .finally(() => setLoad(false))
    }
  }, [isExpanded, delivery.id, itemsLoaded])

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

  return (
    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, overflow:'hidden' }}>
      {/* Batch header */}
      <div
        style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 18px', background:'#f9fafb', borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none', cursor:'pointer' }}
        onClick={onToggle}
      >
        <span style={{ color:'#9ca3af', fontSize:11, transition:'transform .2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', display:'inline-block' }}>▶</span>

        <div style={{ flex:1 }}>
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
          <button onClick={onEdit}
            style={{ padding:'4px 10px', borderRadius:5, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', cursor:'pointer', fontSize:12, fontWeight:500 }}>
            Sửa
          </button>
          <button onClick={onDelete}
            style={{ padding:'4px 10px', borderRadius:5, border:'none', background:'#fee2e2', color:'#b91c1c', cursor:'pointer', fontSize:12, fontWeight:500 }}>
            Xóa
          </button>
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
                  onSave={handleAddItem}
                  onCancel={() => setAddItem(false)}
                />
              ) : (
                <button
                  onClick={() => setAddItem(true)}
                  style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600 }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                  Thêm hàng
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Delivery item row ─────────────────────────────────────────────────────────

function DeliveryItemRow({ idx, item, onDelete, onUpdateItem, onSerialCountChange }) {
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

// ── Add item form (inline) ────────────────────────────────────────────────────

function AddItemForm({ boqItems, onSave, onCancel }) {
  const [form, setForm] = useState({
    boq_item_id: '', item_name: '', unit: '', ordered_quantity: '', received_quantity: '', note: '',
  })

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
    await onSave(form)
  }

  return (
    <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'14px 16px', marginTop:8 }}>
      <div style={{ fontSize:12, fontWeight:700, color:'#15803d', marginBottom:10 }}>Thêm hàng hóa vào đợt nhận</div>
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 2fr', gap:8, alignItems:'end', flexWrap:'wrap' }}>
        <div>
          <label style={{ fontSize:11, fontWeight:600, color:'#374151', display:'block', marginBottom:3 }}>Chọn từ BOQ</label>
          <select value={form.boq_item_id} onChange={e => handleBoqSelect(e.target.value)}
            style={{ width:'100%', padding:'6px 8px', border:'1px solid #d1d5db', borderRadius:5, fontSize:12 }}>
            <option value="">-- Chọn hoặc nhập tự do --</option>
            {boqItems.map(b => <option key={b.id} value={b.id}>{b.item_name}</option>)}
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

// ── Batch modal (add/edit) ────────────────────────────────────────────────────

function BatchModal({ batch, onSave, onClose }) {
  const isEdit = !!batch
  const [form, setForm] = useState({
    batch_name:   batch?.batch_name   || '',
    receive_date: batch?.receive_date?.slice(0,10) || '',
    warehouse:    batch?.warehouse    || '',
    status:       batch?.status       || 'Chờ nhận',
    note:         batch?.note         || '',
  })
  const [saving, setSaving] = useState(false)
  const s = f => setForm(p=>({...p,...f}))

  async function handleSubmit() {
    setSaving(true)
    await onSave(form, isEdit)
    setSaving(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => { if(e.target===e.currentTarget) onClose() }}>
      <div style={{ background:'#fff', borderRadius:12, width:520, maxWidth:'100%', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding:'16px 24px 12px', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:'#111827' }}>{isEdit ? 'Cập nhật đợt nhận hàng' : 'Thêm đợt nhận hàng'}</h3>
          <button onClick={onClose} style={{ width:30, height:30, border:'none', background:'#f3f4f6', borderRadius:6, cursor:'pointer', fontSize:16, color:'#6b7280', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
        <div style={{ padding:'18px 24px', display:'flex', flexDirection:'column', gap:13 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div className="form-group">
              <label>Tên đợt nhận</label>
              <input type="text" value={form.batch_name} onChange={e=>s({batch_name:e.target.value})} placeholder="VD: Đợt 1, Đợt giao hàng tháng 3..." />
            </div>
            <div className="form-group">
              <label>Ngày nhận</label>
              <input type="date" value={form.receive_date} onChange={e=>s({receive_date:e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label>Kho nhận hàng</label>
            <input type="text" value={form.warehouse} onChange={e=>s({warehouse:e.target.value})} placeholder="VD: Kho Hà Nội, Kho TP.HCM..." />
          </div>
          <div className="form-group">
            <label>Trạng thái</label>
            <select value={form.status} onChange={e=>s({status:e.target.value})}>
              {DELIVERY_STATUSES.map(st => <option key={st}>{st}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Ghi chú</label>
            <textarea rows="2" value={form.note} onChange={e=>s({note:e.target.value})} placeholder="Ghi chú đặc biệt về đợt nhận..." />
          </div>
        </div>
        <div style={{ padding:'12px 24px', borderTop:'1px solid #e5e7eb', display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={{ padding:'8px 18px', borderRadius:7, border:'none', background:'#f3f4f6', color:'#374151', cursor:'pointer', fontSize:13, fontWeight:600 }}>Hủy</button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding:'8px 18px', borderRadius:7, border:'none', background:'#16a34a', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}>
            {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo đợt nhận'}
          </button>
        </div>
      </div>
    </div>
  )
}
