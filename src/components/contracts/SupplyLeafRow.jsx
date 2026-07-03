import { useState } from 'react'
import NumberInput from '../common/NumberInput'
import EditGuard from './EditGuard'
import { statusMeta, fmtQty, pct } from './supplyCoverageUtils'

// Một dòng hàng bán CẦN NHẬP trong tab "Theo dõi nhập hàng": trạng thái + các đầu bán
// + HĐ nhập đang phủ. PM tách/sửa/xóa đầu bán ngay tại đây (không có giá). Tách khỏi
// ContractSupplyCoverageTab để giữ file < 500 dòng.

function StatusPill({ status, small }) {
  const m = statusMeta(status)
  return (
    <span className={`sc-pill ${m.cls} ${small ? 'sc-pill-sm' : ''}`}>
      <span className="sc-dot" style={{ background: m.color }} />
      {m.label}
    </span>
  )
}

// Danh sách HĐ nhập đang phủ (link) — chỉ đọc.
function LinkList({ links }) {
  if (!links?.length) return null
  return (
    <div className="sc-links">
      {links.map((l) => (
        <span key={l.link_id} className="sc-link-chip" title={l.in_item_name || ''}>
          HĐ nhập {l.contract_in_no || `#${l.contract_in_id}`} · {fmtQty(l.covered_qty)}
        </span>
      ))}
    </div>
  )
}

// Form thêm/sửa đầu bán (dùng chung).
function SlotForm({ initial, unitFallback, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '')
  const [qty, setQty] = useState(initial?.needed_qty ?? '')
  const [unit, setUnit] = useState(initial?.unit || unitFallback || '')
  const save = () => {
    if (!name.trim()) { alert('Nhập tên đầu bán'); return }
    onSave({ name: name.trim(), needed_qty: qty, unit: unit.trim() })
  }
  return (
    <div className="sc-slot-form">
      <input className="sc-in sc-in-name" value={name} placeholder="Tên đầu bán (vd: Khung tủ)"
        onChange={(e) => setName(e.target.value)} autoFocus />
      <NumberInput value={qty} onChange={setQty} placeholder="SL kỳ vọng" />
      <input className="sc-in sc-in-unit" value={unit} placeholder="ĐVT"
        onChange={(e) => setUnit(e.target.value)} />
      <button className="sc-btn sc-btn-green" onClick={save}>Lưu</button>
      <button className="sc-btn" onClick={onCancel}>Hủy</button>
    </div>
  )
}

function SlotItem({ slot, canEdit, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <div className="sc-slot sc-slot-editing">
        <SlotForm initial={slot} onCancel={() => setEditing(false)}
          onSave={(vals) => { onUpdate(slot.id, vals); setEditing(false) }} />
      </div>
    )
  }
  return (
    <div className="sc-slot">
      <div className="sc-slot-main">
        <StatusPill status={slot.status} small />
        <span className="sc-slot-name">{slot.name || '(chưa đặt tên)'}</span>
        <span className="sc-slot-qty">
          Cần {fmtQty(slot.needed_qty)}{slot.unit ? ` ${slot.unit}` : ''} · Đã {fmtQty(slot.covered)} ({pct(slot.covered, slot.needed_qty)}%)
        </span>
        {canEdit && (
          <span className="sc-slot-actions">
            <button className="sc-btn sc-btn-sm" onClick={() => setEditing(true)}>Sửa</button>
            <button className="sc-btn sc-btn-sm sc-btn-danger" onClick={() => onDelete(slot.id)}>Xóa</button>
          </span>
        )}
      </div>
      <LinkList links={slot.links} />
    </div>
  )
}

export default function SupplyLeafRow({ leaf, canEdit, onAddSlot, onUpdateSlot, onDeleteSlot }) {
  const [adding, setAdding] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const remaining = Math.max(0, (Number(leaf.needed) || 0) - (Number(leaf.covered) || 0))

  // Dòng đã tách đầu bán luôn sổ rộng; dòng chưa tách thu gọn 1 dòng, bấm để mở.
  const collapsible = !leaf.split
  const open = leaf.split || expanded

  return (
    <div className={`sc-leaf ${statusMeta(leaf.status).cls}${collapsible ? ' sc-leaf-collapsible' : ''}`}>
      <div
        className="sc-leaf-head"
        onClick={collapsible ? () => setExpanded((v) => !v) : undefined}
        role={collapsible ? 'button' : undefined}
      >
        {collapsible && <span className={`sc-caret${open ? ' sc-caret-open' : ''}`}>▸</span>}
        <StatusPill status={leaf.status} />
        <div className="sc-leaf-title">
          {leaf.group_path && <span className="sc-leaf-path">{leaf.group_path} › </span>}
          <span className="sc-leaf-name">{leaf.item_name}</span>
        </div>
        <span className="sc-leaf-qty">
          Cần {fmtQty(leaf.needed)}{leaf.unit ? ` ${leaf.unit}` : ''} · Đã {fmtQty(leaf.covered)} ({pct(leaf.covered, leaf.needed)}%)
        </span>
      </div>

      {open && (
      <div className="sc-leaf-body">
        {leaf.split ? (
          leaf.slots.map((s) => (
            <SlotItem key={s.id} slot={s} canEdit={canEdit}
              onUpdate={onUpdateSlot} onDelete={onDeleteSlot} />
          ))
        ) : (
          <div className="sc-direct">
            <span className="sc-muted">Chưa tách đầu bán — nhập trọn cả dòng.</span>
            <LinkList links={leaf.direct_links} />
          </div>
        )}

        <EditGuard perm="co.boq.manage">
          {adding ? (
            <div className="sc-slot sc-slot-editing">
              <SlotForm unitFallback={leaf.unit}
                initial={{ needed_qty: leaf.split ? '' : remaining }}
                onCancel={() => setAdding(false)}
                onSave={(vals) => { onAddSlot(leaf.boq_id, vals); setAdding(false) }} />
            </div>
          ) : (
            <button className="sc-btn sc-btn-add" onClick={() => setAdding(true)}>+ Tách đầu bán</button>
          )}
        </EditGuard>
      </div>
      )}
    </div>
  )
}
