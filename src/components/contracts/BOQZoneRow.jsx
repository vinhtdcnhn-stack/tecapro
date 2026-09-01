import AutoTextarea from '../common/AutoTextarea'
import { fmtNum } from './boqUtils'
import { IconSave, IconPlus, IconTrash } from './BOQRowIcons'
import { auditRowAttrs } from '../common/rowAudit'

// Dòng ZONE (Phần / phân khu): chỉ là dải tiêu đề phân vùng, không số liệu.
// Hiển thị tên + tổng tiền roll-up của các dòng con; có nút thêm nhóm/dòng con.
export default function BOQZoneRow({
  row, idx, no, depth, selected, onToggleSelect, set, saveRow, deleteRow, onAddChild, rollupAmt, currency, showPrice = true,
  canDrag, canDrop, isDragging, isDragOver, dropMode = 'into', onDragStart, onDragOver, onDragEnter, onDrop, onDragEnd,
}) {
  return (
    <tr
      data-key={row._key}
      {...auditRowAttrs('contract_out_boq', row.id)}
      draggable={canDrag}
      onDragStart={canDrag ? (e) => onDragStart(e, row._key) : undefined}
      onDragOver={canDrop ? onDragOver : undefined}
      onDragEnter={canDrop ? () => onDragEnter(row._key) : undefined}
      onDrop={canDrop ? (e) => onDrop(e, row._key) : undefined}
      onDragEnd={canDrop ? onDragEnd : undefined}
      className={[
        'boq-zone-row',
        row._isNew ? 'row-new' : '', row._dirty ? 'row-dirty' : '',
        row._saving ? 'row-saving' : '', selected ? 'row-selected' : '',
        isDragging ? 'row-dragging' : '',
        isDragOver ? (dropMode === 'into' ? 'row-dropinto' : 'row-dragover') : '',
      ].filter(Boolean).join(' ')}
    >
      <td className="td-select">
        <input type="checkbox" checked={selected} onChange={() => onToggleSelect(row._key)} title="Chọn dòng" />
      </td>
      <td className="td-stt">
        {row._dirty && <span className="dirty-dot" title="Chưa lưu" />}
        {canDrag && <span className="drag-handle" title="Kéo để đổi thứ tự (cả dòng con đi theo)">⠿</span>}
        <span className="stt-num">{no || idx + 1}</span>
      </td>
      <td className="td-name boq-zone-name" colSpan={11} style={{ paddingLeft: 8 + depth * 22 }}>
        <span className="boq-kind-badge boq-badge-zone">PHẦN</span>
        <AutoTextarea
          value={row.item_name}
          onChange={e => set(row._key, 'item_name', e.target.value)}
          placeholder="Tên phần / phân khu..."
        />
        <span className="boq-zone-total">{showPrice ? fmtNum(rollupAmt?.after || 0, currency) : '•••'}</span>
      </td>
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
          <button className="act insert" onClick={() => onAddChild(row, 'leaf')} title="Thêm dòng con" disabled={!row.id}>
            <span className="act-label">+</span>
          </button>
          <button className="act delete" onClick={() => deleteRow(row)} title="Xóa phần (gồm dòng con)">
            <IconTrash />
          </button>
        </div>
      </td>
    </tr>
  )
}
