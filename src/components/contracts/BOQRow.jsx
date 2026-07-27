import { fmtNum, calcAmounts } from './boqUtils'
import NumberInput from '../common/NumberInput'
import AutoTextarea from '../common/AutoTextarea'
import BOQZoneRow from './BOQZoneRow'
import BOQGroupRow from './BOQGroupRow'
import EditGuard from './EditGuard'
import { auditRowAttrs } from '../common/rowAudit'
import { statusMeta } from './supplyCoverageUtils'

// Một dòng trong bảng giá (BOQ). Phân nhánh theo row_kind: zone / group / leaf.
// Tách riêng để giữ ContractBOQTab gọn dưới 500 dòng.
export default function BOQRow({
  row, idx, no, depth = 0, rollupAmt, currency, showPrice = true, coverageStatus, onToggleNoImport, selected, onToggleSelect, set, saveRow, insertAfter, deleteRow, onAddChild, onToggleMultiply, onToggleHideAmount,
  canDrag, canDrop, isDragging, isDragOver, dropMode, onDragStart, onDragOver, onDragEnter, onDrop, onDragEnd,
}) {
  const kind = row.row_kind || 'leaf'
  // Phần/Nhóm vừa KÉO ĐƯỢC (cả cây con đi theo) vừa là điểm thả để gom dòng vào.
  const dndProps = {
    canDrag, canDrop, isDragging, isDragOver, dropMode,
    onDragStart, onDragOver, onDragEnter, onDrop, onDragEnd,
  }
  if (kind === 'zone')
    return <BOQZoneRow {...{ row, idx, no, depth, selected, onToggleSelect, set, saveRow, deleteRow, onAddChild, rollupAmt, currency, showPrice, ...dndProps }} />
  if (kind === 'group')
    return <BOQGroupRow {...{ row, idx, no, depth, selected, onToggleSelect, set, saveRow, deleteRow, onAddChild, onToggleMultiply, onToggleHideAmount, rollupAmt, currency, showPrice, ...dndProps }} />

  const { before, after } = calcAmounts(row.quantity, row.unit_price, row.vat_rate, currency)
  const isDiThang = row.item_type === 'di_thang'

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
        row._isNew  ? 'row-new'   : '',
        row._dirty  ? 'row-dirty' : '',
        row._saving ? 'row-saving': '',
        isDiThang   ? 'row-di-thang' : '',
        selected    ? 'row-selected' : '',
        isDragging  ? 'row-dragging' : '',
        // vạch xanh ở trên/dưới cho biết dòng sẽ được chèn trước hay sau dòng đích
        isDragOver  ? (dropMode === 'into' ? 'row-dragover-bottom' : 'row-dragover') : '',
      ].filter(Boolean).join(' ')}
    >
      <td className="td-select">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(row._key)}
          title="Chọn dòng"
        />
      </td>

      <td className="td-stt">
        {row._dirty && <span className="dirty-dot" title="Chưa lưu" />}
        {canDrag && <span className="drag-handle" title="Kéo để đổi thứ tự">⠿</span>}
        {/* Số thứ tự phân cấp (1, 1.1, 1.1.2…); khi đang lọc thì quay về đánh số chạy */}
        <span className="stt-num">{no || idx + 1}</span>
        {/* Độ phủ nhập: chấm màu (dòng cần nhập) + cờ "không cần nhập" (PM). Chỉ khi đã lưu. */}
        {row.id && (
          row.no_import_needed ? (
            <span className="supply-cov-off" title="Không cần nhập">∅</span>
          ) : coverageStatus ? (
            <span
              className="supply-cov-dot"
              style={{ background: statusMeta(coverageStatus).color }}
              title={`Nhập hàng: ${statusMeta(coverageStatus).label}`}
            />
          ) : null
        )}
        {row.id && (
          <EditGuard perm="co.boq.manage">
            <label className="supply-noimp" title="Đánh dấu dòng KHÔNG cần nhập (loại khỏi theo dõi)">
              <input
                type="checkbox"
                checked={!!row.no_import_needed}
                onChange={(e) => onToggleNoImport(row, e.target.checked)}
              />
            </label>
          </EditGuard>
        )}
      </td>

      <td className="td-name" style={depth ? { paddingLeft: 8 + depth * 22 } : undefined}>
        <AutoTextarea
          value={row.item_name}
          onChange={e => set(row._key, 'item_name', e.target.value)}
          placeholder="Nhập tên hàng hóa..."
        />
      </td>

      <td className="td-hs">
        <input
          type="text"
          value={row.hs_code}
          onChange={e => set(row._key, 'hs_code', e.target.value)}
          placeholder="—"
        />
      </td>

      <td className="td-unit">
        <input
          type="text"
          value={row.unit}
          onChange={e => set(row._key, 'unit', e.target.value)}
          placeholder="Bộ"
        />
      </td>

      <td className="td-num">
        <input
          type="number"
          value={row.quantity}
          onChange={e => set(row._key, 'quantity', e.target.value)}
          placeholder="0"
          min="0"
        />
      </td>

      <td className="td-num">
        {showPrice ? (
          <NumberInput
            value={row.unit_price}
            onChange={v => set(row._key, 'unit_price', v)}
            placeholder="0"
          />
        ) : <span className="boq-masked">•••</span>}
      </td>

      <td className="td-amt computed">{showPrice ? fmtNum(before, currency) : '•••'}</td>

      <td className="td-vat">
        <input
          type="number"
          value={row.vat_rate}
          onChange={e => set(row._key, 'vat_rate', e.target.value)}
          placeholder="10"
          min="0"
          max="100"
        />
      </td>

      <td className="td-amt computed">{showPrice ? fmtNum(after, currency) : '•••'}</td>

      <td className="td-warranty">
        <input
          type="text"
          value={row.warranty_period}
          onChange={e => set(row._key, 'warranty_period', e.target.value)}
          placeholder="12 tháng"
        />
      </td>

      <td className="td-item-type">
        <select
          value={row.item_type || 'trong_nuoc'}
          onChange={e => set(row._key, 'item_type', e.target.value)}
          className={`item-type-select ${row.item_type === 'di_thang' ? 'type-di-thang' : 'type-trong-nuoc'}`}
        >
          <option value="trong_nuoc">Trong nước</option>
          <option value="di_thang">Đi thẳng</option>
        </select>
      </td>

      <td className="td-action">
        <div className="action-group">
          {row._dirty && (
            <button
              className="act save"
              onClick={() => saveRow(row)}
              disabled={row._saving}
              title="Lưu dòng"
            >
              {row._saving
                ? <span className="spin">⟳</span>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
              }
            </button>
          )}
          <button
            className="act insert"
            onClick={() => insertAfter(row)}
            title="Thêm dòng bên dưới"
            disabled={row._isNew && !row.id}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </button>
          <button
            className="act delete"
            onClick={() => deleteRow(row)}
            title="Xóa dòng"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </td>
    </tr>
  )
}
