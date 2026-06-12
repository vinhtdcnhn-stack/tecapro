import { useState, useEffect, useCallback } from 'react'

import { API } from '../../config/api'
import { fmtDate, fmtNum } from './deliveryUtils'
import DeliveryCard from './DeliveryCard'
import BatchModal from './DeliveryBatchModal'
import useIsMobile from './useIsMobile'

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

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() là async: setState xảy ra SAU await, không phải cascade đồng bộ
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
  const isMobile = useIsMobile()

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Đang tải...</div>

  return (
    <div style={{ padding: isMobile ? '14px 14px' : '20px 24px', display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>

      {/* Summary — ẩn trên mobile */}
      {!isMobile && (
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
      )}

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
