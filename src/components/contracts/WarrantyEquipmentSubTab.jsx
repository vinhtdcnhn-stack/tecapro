import { useState } from 'react'

import { API } from '../../config/api'
import { warrantyCounts } from './warrantyUtils'
import HandoverBatchCard from './HandoverBatchCard'
import HandoverBatchModal from './HandoverBatchModal'
import EditGuard from './EditGuard'

// ── Tab "Thiết bị bàn giao": tách theo ĐỢT GIAO HÀNG (card từng đợt) ─────────────
// Thiết bị linh-kiện (mọi serial có parent_serial_id) chỉ quản lý ở tab "Quản lý Serial".
const isComponentEquipment = (e) =>
  Array.isArray(e.serials) && e.serials.length > 0 &&
  e.serials.every(s => s.parent_serial_id != null)

export default function EquipmentSubTab({ contractId, equipment, setEquipment, reload, deliveries, reloadDeliveries }) {
  const [search, setSearch]       = useState('')
  const [expandedId, setExpanded] = useState(deliveries[0]?.id ?? null)
  const [batchModal, setBatchModal] = useState(false)
  const [editBatch, setEditBatch] = useState(null)

  // Summary tính trên thiết bị CHA toàn hợp đồng.
  const mainEquipment = equipment.filter(e => !isComponentEquipment(e))
  const { totalSerials, expiring, expired } = warrantyCounts(mainEquipment)

  async function handleSaveBatch(form, isEdit) {
    const url = isEdit ? `${API}/out-deliveries/${editBatch.id}` : `${API}/contracts/${contractId}/deliveries`
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error || 'Lỗi lưu đợt giao'); return }
    setBatchModal(false); setEditBatch(null)
    await reloadDeliveries()
    if (!isEdit) setExpanded(data.id)
  }

  async function handleDeleteBatch(d) {
    if (!confirm(`Xóa đợt giao "${d.batch_name || '(chưa đặt tên)'}"? Toàn bộ thiết bị & serial của đợt sẽ bị xóa.`)) return
    const res = await fetch(`${API}/out-deliveries/${d.id}`, { method: 'DELETE' })
    if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Không thể xóa đợt'); return }
    await Promise.all([reloadDeliveries(), reload()])
    if (expandedId === d.id) setExpanded(null)
  }

  return (
    <>
      {/* Summary */}
      <div className="wty-summary">
        <div className="wty-card wty-card--blue">
          <div className="wty-card-label">Tổng thiết bị</div>
          <div className="wty-card-value">{mainEquipment.length}</div>
          <div className="wty-card-sub">loại thiết bị</div>
        </div>
        <div className="wty-card wty-card--green">
          <div className="wty-card-label">Tổng Serial</div>
          <div className="wty-card-value">{totalSerials}</div>
          <div className="wty-card-sub">đã quản lý</div>
        </div>
        <div className="wty-card wty-card--orange">
          <div className="wty-card-label">Sắp hết BH</div>
          <div className="wty-card-value">{expiring}</div>
          <div className="wty-card-sub">≤ 30 ngày</div>
        </div>
        <div className="wty-card wty-card--red">
          <div className="wty-card-label">Hết bảo hành</div>
          <div className="wty-card-value">{expired}</div>
          <div className="wty-card-sub">thiết bị</div>
        </div>
      </div>

      {/* Toolbar: tìm kiếm + thêm đợt */}
      <div className="wty-toolbar">
        <input className="wty-search" placeholder="🔍 Tìm tên, hãng, model, vị trí..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <div className="wty-toolbar-right">
          <EditGuard>
            <button className="wty-btn wty-btn-primary" onClick={() => { setEditBatch(null); setBatchModal(true) }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              Thêm đợt giao hàng
            </button>
          </EditGuard>
        </div>
      </div>

      {/* Danh sách đợt giao hàng */}
      {deliveries.length === 0 ? (
        <div className="wty-empty" style={{ padding: 40, textAlign: 'center', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}>
          Chưa có đợt giao hàng nào. Nhấn <strong>Thêm đợt giao hàng</strong> để bắt đầu.
        </div>
      ) : (
        <div className="hbatch-list">
          {deliveries.map(d => (
            <HandoverBatchCard
              key={d.id}
              contractId={contractId}
              delivery={d}
              equipment={equipment}
              setEquipment={setEquipment}
              reload={reload}
              search={search}
              isExpanded={expandedId === d.id}
              onToggle={() => setExpanded(prev => prev === d.id ? null : d.id)}
              onEdit={() => { setEditBatch(d); setBatchModal(true) }}
              onDelete={() => handleDeleteBatch(d)}
            />
          ))}
        </div>
      )}

      {batchModal && (
        <HandoverBatchModal batch={editBatch} onSave={handleSaveBatch} onClose={() => { setBatchModal(false); setEditBatch(null) }} />
      )}
    </>
  )
}
