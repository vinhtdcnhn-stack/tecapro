import { useState, useEffect } from 'react'
import { fmtNum, calcAmounts } from './boqUtils'
import NumberInput from '../common/NumberInput'
import { auditRowAttrs } from '../common/rowAudit'
import { targetKey } from './usePurchaseBOQLink'

// Một dòng trong bảng giá mua (purchase BOQ). Tách riêng để giữ ContractInBOQTab gọn dưới 500 dòng.
export default function PurchaseBOQRow({
  row, idx, currency, showPrice = true, targets = [], onSetLink, selected, onToggleSelect,
  set, saveRow, insertAfter, deleteRow,
  canDrag, isDragging, isDragOver, onDragStart, onDragOver, onDragEnter, onDrop, onDragEnd,
}) {
  const { before, after } = calcAmounts(row.quantity, row.unit_price, row.vat_rate, currency)

  // ── Cột "Nhập cho": chọn hàng bán/đầu bán + SL phủ ──
  const curKey = row.link_boq_id != null ? targetKey(row.link_boq_id, row.link_slot_id) : ''
  const curTarget = targets.find(t => targetKey(t.boq_id, t.slot_id) === curKey)
  const [covered, setCovered] = useState(row.link_covered_qty ?? '')
  // eslint-disable-next-line react-hooks/set-state-in-effect -- đồng bộ SL phủ khi ghép đổi từ ngoài
  useEffect(() => { setCovered(row.link_covered_qty ?? '') }, [row.link_id, row.link_covered_qty])

  const onSelectTarget = (e) => {
    const key = e.target.value
    if (!key) { onSetLink(row, { boq_id: '', slot_id: '', covered_qty: 0 }); return }
    const t = targets.find(x => targetKey(x.boq_id, x.slot_id) === key)
    if (!t) return
    const remaining = Math.max(0, (Number(t.needed) || 0) - (Number(t.covered) || 0))
    onSetLink(row, { boq_id: t.boq_id, slot_id: t.slot_id, covered_qty: remaining })
  }
  const commitCovered = () => {
    if (row.link_boq_id == null) return
    const v = parseFloat(covered) || 0
    if (v === (Number(row.link_covered_qty) || 0)) return
    onSetLink(row, { boq_id: row.link_boq_id, slot_id: row.link_slot_id, covered_qty: v })
  }

  return (
    <tr
      {...auditRowAttrs('contract_in_boq', row.id)}
      draggable={canDrag}
      onDragStart={canDrag ? (e) => onDragStart(e, row._key) : undefined}
      onDragOver={canDrag ? onDragOver : undefined}
      onDragEnter={canDrag ? () => onDragEnter(row._key) : undefined}
      onDrop={canDrag ? (e) => onDrop(e, row._key) : undefined}
      onDragEnd={canDrag ? onDragEnd : undefined}
      className={[
        row._isNew  ? 'row-new'   : '',
        row._dirty  ? 'row-dirty' : '',
        row._saving ? 'row-saving': '',
        selected    ? 'row-selected' : '',
        isDragging  ? 'row-dragging' : '',
        isDragOver  ? 'row-dragover' : '',
      ].filter(Boolean).join(' ')}
    >
      <td className="td-select">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(row._key)}
          disabled={row._isNew}
          title="Chọn dòng"
        />
      </td>

      <td className="td-stt">
        {row._dirty && <span className="dirty-dot" title="Chưa lưu" />}
        {canDrag && <span className="drag-handle" title="Kéo để đổi thứ tự">⠿</span>}
        <span className="stt-num">{idx + 1}</span>
      </td>

      <td className="td-name">
        <input type="text" value={row.item_name}
          onChange={e => set(row._key, 'item_name', e.target.value)}
          placeholder="Nhập tên hàng hóa..." />
      </td>

      <td className="td-unit">
        <input type="text" value={row.unit}
          onChange={e => set(row._key, 'unit', e.target.value)}
          placeholder="Bộ" />
      </td>

      <td className="td-num">
        <input type="number" value={row.quantity}
          onChange={e => set(row._key, 'quantity', e.target.value)}
          placeholder="0" min="0" />
      </td>

      <td className="td-num">
        {showPrice ? (
          <NumberInput value={row.unit_price}
            onChange={v => set(row._key, 'unit_price', v)}
            placeholder="0" />
        ) : <span className="boq-masked">•••</span>}
      </td>

      <td className="td-amt computed">{showPrice ? fmtNum(before, currency) : '•••'}</td>

      <td className="td-vat">
        <input type="number" value={row.vat_rate}
          onChange={e => set(row._key, 'vat_rate', e.target.value)}
          placeholder="10" min="0" max="100" />
      </td>

      <td className="td-amt computed">{showPrice ? fmtNum(after, currency) : '•••'}</td>

      <td className="td-warranty">
        <input type="text" value={row.warranty_period}
          onChange={e => set(row._key, 'warranty_period', e.target.value)}
          placeholder="12 tháng" />
      </td>

      <td className="td-supply">
        {row._isNew || !row.id ? (
          <span className="boq-masked" title="Lưu dòng trước khi gán">—</span>
        ) : (
          <div className="supply-cell">
            <select className="supply-select" value={curKey} onChange={onSelectTarget}
              title={curTarget?.label || 'Chọn hàng bán / đầu bán để nhập cho'}>
              <option value="">— Chưa gán —</option>
              {targets.map(t => {
                const k = targetKey(t.boq_id, t.slot_id)
                return <option key={k} value={k}>{t.label}</option>
              })}
            </select>
            {curTarget && (
              <span className="supply-qtywrap">
                <NumberInput value={covered} onChange={setCovered} onBlur={commitCovered}
                  placeholder="SL phủ" className="supply-qty" />
                {curTarget.unit && <span className="supply-unit">{curTarget.unit}</span>}
              </span>
            )}
          </div>
        )}
      </td>

      <td className="td-action">
        <div className="action-group">
          {row._dirty && (
            <button className="act save" onClick={() => saveRow(row)} disabled={row._saving} title="Lưu dòng">
              {row._saving
                ? <span className="spin">⟳</span>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
              }
            </button>
          )}
          <button className="act insert" onClick={() => insertAfter(row)}
            title="Thêm dòng bên dưới" disabled={row._isNew && !row.id}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </button>
          <button className="act delete" onClick={() => deleteRow(row)} title="Xóa dòng">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </td>
    </tr>
  )
}
