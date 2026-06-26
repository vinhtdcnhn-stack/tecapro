import AutoTextarea from '../common/AutoTextarea'
import { fmtNum } from './boqUtils'
import { IconSave, IconPlus, IconTrash, IconCheck } from './BOQRowIcons'

// Dòng NHÓM tổng hợp (vd "Hệ thống UPS 600kVA"): giữ ĐVT/SL mô tả, nhưng đơn giá &
// thành tiền là roll-up từ các dòng con (read-only). Có nút thêm nhóm/dòng con.
export default function BOQGroupRow({
  row, idx, depth, selected, onToggleSelect, set, saveRow, deleteRow, onAddChild, onToggleMultiply, rollupAmt, currency,
  canDrop, isDragOver, onDragOver, onDragEnter, onDrop, onDragEnd,
}) {
  const mult = !!row.multiply_qty
  return (
    <tr
      data-key={row._key}
      onDragOver={canDrop ? onDragOver : undefined}
      onDragEnter={canDrop ? () => onDragEnter(row._key) : undefined}
      onDrop={canDrop ? (e) => onDrop(e, row._key) : undefined}
      onDragEnd={canDrop ? onDragEnd : undefined}
      className={[
        'boq-group-row',
        row._isNew ? 'row-new' : '', row._dirty ? 'row-dirty' : '',
        row._saving ? 'row-saving' : '', selected ? 'row-selected' : '',
        isDragOver ? 'row-dropinto' : '',
      ].filter(Boolean).join(' ')}
    >
      <td className="td-select">
        <input type="checkbox" checked={selected} onChange={() => onToggleSelect(row._key)} title="Chọn dòng" />
      </td>
      <td className="td-stt">
        {row._dirty && <span className="dirty-dot" title="Chưa lưu" />}
        <span className="stt-num">{idx + 1}</span>
      </td>
      <td className="td-name" style={{ paddingLeft: 8 + depth * 22 }}>
        <span className="boq-kind-badge boq-badge-group">Hệ thống</span>
        <AutoTextarea
          value={row.item_name}
          onChange={e => set(row._key, 'item_name', e.target.value)}
          placeholder="Tên nhóm / hệ thống..."
        />
      </td>
      <td className="td-hs">
        <input type="text" value={row.hs_code} onChange={e => set(row._key, 'hs_code', e.target.value)} placeholder="—" />
      </td>
      <td className="td-unit">
        <input type="text" value={row.unit} onChange={e => set(row._key, 'unit', e.target.value)} placeholder="Hệ thống" />
      </td>
      <td className="td-num">
        <input type="number" value={row.quantity} onChange={e => set(row._key, 'quantity', e.target.value)} placeholder="0" min="0" />
      </td>
      <td className="td-num td-rollup" title={mult ? 'Đơn giá hệ thống = tổng thành tiền các dòng con (1 bộ)' : 'Tổng hợp từ dòng con'}>
        {mult ? fmtNum(rollupAmt?.unitBefore || 0, currency) : '—'}
      </td>
      <td className="td-amt computed td-rollup" title={mult ? 'Đã nhân theo số lượng hệ thống' : undefined}>{fmtNum(rollupAmt?.before || 0, currency)}</td>
      <td className="td-vat td-rollup">—</td>
      <td className="td-amt computed td-rollup" title={mult ? 'Đã nhân theo số lượng hệ thống' : undefined}>{fmtNum(rollupAmt?.after || 0, currency)}</td>
      <td className="td-warranty">
        <input type="text" value={row.warranty_period} onChange={e => set(row._key, 'warranty_period', e.target.value)} placeholder="—" />
      </td>
      <td className="td-item-type" />
      <td className="td-action">
        <div className="action-group">
          {row._dirty && (
            <button className="act save" onClick={() => saveRow(row)} disabled={row._saving} title="Lưu dòng">
              {row._saving ? <span className="spin">⟳</span> : <IconSave />}
            </button>
          )}
          <button className="act insert" onClick={() => onAddChild(row, 'group')} title="Thêm hệ thống con" disabled={!row.id}>
            <IconPlus /><span className="act-label">Thêm hệ thống</span>
          </button>
          <button
            className={`act mult${mult ? ' active' : ''}`}
            onClick={() => onToggleMultiply(row)}
            title={mult ? 'Đang nhân thành tiền theo SL hệ thống — bấm để tắt' : 'Nhân thành tiền theo SL hệ thống'}
            aria-pressed={mult}
          >
            <IconCheck />
          </button>
          <button className="act insert" onClick={() => onAddChild(row, 'leaf')} title="Thêm dòng con" disabled={!row.id}>
            <span className="act-label">+</span>
          </button>
          <button className="act delete" onClick={() => deleteRow(row)} title="Xóa nhóm (gồm dòng con)">
            <IconTrash />
          </button>
        </div>
      </td>
    </tr>
  )
}
