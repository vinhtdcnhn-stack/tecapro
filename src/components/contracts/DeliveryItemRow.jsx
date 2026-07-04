import { useState } from 'react'

import { API } from '../../config/api'
import { fmtNum } from './deliveryUtils'
import EditGuard from './EditGuard'
import { useCanEdit } from '../../context/ContractPermContext'
import DeliveryItemSerials from './DeliveryItemSerials'
import { exportItemSerials } from './deliverySerialExport'
import { auditRowAttrs } from '../common/rowAudit'

// ── Delivery item row ─────────────────────────────────────────────────────────

export default function DeliveryItemRow({ idx, item, deliveryId, contractInId, locked = false, onDelete, onUpdateItem, onSerialCountChange, onReload }) {
  const canEdit = useCanEdit() && !locked
  const [showSerials, setShowSerials] = useState(false)

  const [editQty, setEditQty]         = useState(false)
  const [receivedQty, setReceivedQty] = useState(item.received_quantity)

  async function saveQty() {
    await onUpdateItem('received_quantity', receivedQty)
    setEditQty(false)
  }

  const serialCount = parseInt(item.serial_count) || 0

  return (
    <>
      <tr {...auditRowAttrs('contract_in_delivery_item', item.id)} style={{ borderBottom:'1px solid #f3f4f6' }}>
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
          ) : canEdit ? (
            <span
              onClick={() => setEditQty(true)}
              title="Click để sửa"
              style={{ cursor:'pointer', fontWeight:600, color: parseFloat(item.received_quantity) >= parseFloat(item.ordered_quantity) ? '#15803d' : '#d97706', padding:'2px 6px', borderRadius:4, background:'#f9fafb' }}
            >
              {fmtNum(item.received_quantity)} ✎
            </span>
          ) : (
            <span style={{ fontWeight:600, color: parseFloat(item.received_quantity) >= parseFloat(item.ordered_quantity) ? '#15803d' : '#d97706' }}>
              {fmtNum(item.received_quantity)}
            </span>
          )}
        </td>
        <td style={{ padding:'8px 10px' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
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
            {serialCount > 0 && (
              <button
                onClick={() => exportItemSerials(API, item)} title="Xuất serial ra Excel (máy chính + thành phần)" className="hide-on-mobile"
                style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 10px', background:'#f0fdf4', color:'#15803d', border:'1px solid #bbf7d0', borderRadius:99, fontSize:11, fontWeight:600, cursor:'pointer' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                Excel
              </button>
            )}
          </div>
        </td>
        <td style={{ padding:'8px 10px', color:'#9ca3af', fontSize:12 }}>{item.note||'—'}</td>
        <td style={{ padding:'8px 10px', textAlign:'center' }}>
          {!locked && (
            <EditGuard>
              <button onClick={onDelete} style={{ background:'#fee2e2', color:'#b91c1c', border:'none', borderRadius:5, cursor:'pointer', padding:'3px 8px', fontSize:11, fontWeight:600 }}>Xóa</button>
            </EditGuard>
          )}
        </td>
      </tr>

      {/* Serial panel — dùng chung component với mobile */}
      {showSerials && (
        <tr>
          <td colSpan="8" style={{ padding:0, borderBottom:'2px solid #bfdbfe' }}>
            <DeliveryItemSerials
              item={item}
              deliveryId={deliveryId}
              contractInId={contractInId}
              locked={locked}
              onSerialCountChange={onSerialCountChange}
              onReload={onReload}
            />
          </td>
        </tr>
      )}
    </>
  )
}
