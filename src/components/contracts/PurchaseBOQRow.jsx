import { fmtNum, calcAmounts } from './boqUtils'
import NumberInput from '../common/NumberInput'
import { auditRowAttrs } from '../common/rowAudit'
import PurchaseSupplyLinks from './PurchaseSupplyLinks'

// Một dòng trong bảng giá mua (purchase BOQ). Tách riêng để giữ ContractInBOQTab gọn dưới 500 dòng.
//
// `rowLocked`: khóa MỌI ô của dòng TRỪ cột "Nhập cho". Dùng cho PM của HĐ bán đang xem — họ
// không sở hữu HĐ nhập nên không sửa được hàng/giá, nhưng vẫn tự ghép hàng cho dự án mình.
// Không dùng EditGuard (fieldset[disabled] ở cha sẽ khóa luôn cột "Nhập cho", không mở lại được).
export default function PurchaseBOQRow({
  row, idx, currency, showPrice = true, targets = [], viewContractId, onSetLinks, selected, onToggleSelect,
  set, saveRow, insertAfter, deleteRow, rowLocked = false,
  canDrag, isDragging, isDragOver, onDragStart, onDragOver, onDragEnter, onDrop, onDragEnd,
}) {
  const { before, after } = calcAmounts(row.quantity, row.unit_price, row.vat_rate, currency)

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
          disabled={row._isNew || rowLocked}
          title="Chọn dòng"
        />
      </td>

      <td className="td-stt">
        {row._dirty && <span className="dirty-dot" title="Chưa lưu" />}
        {canDrag && <span className="drag-handle" title="Kéo để đổi thứ tự">⠿</span>}
        <span className="stt-num">{idx + 1}</span>
      </td>

      <td className="td-name">
        <input type="text" value={row.item_name} disabled={rowLocked}
          onChange={e => set(row._key, 'item_name', e.target.value)}
          placeholder="Nhập tên hàng hóa..." />
      </td>

      <td className="td-unit">
        <input type="text" value={row.unit} disabled={rowLocked}
          onChange={e => set(row._key, 'unit', e.target.value)}
          placeholder="Bộ" />
      </td>

      <td className="td-num">
        <input type="number" value={row.quantity} disabled={rowLocked}
          onChange={e => set(row._key, 'quantity', e.target.value)}
          placeholder="0" min="0" />
      </td>

      <td className="td-num">
        {showPrice ? (
          <NumberInput value={row.unit_price} disabled={rowLocked}
            onChange={v => set(row._key, 'unit_price', v)}
            placeholder="0" />
        ) : <span className="boq-masked">•••</span>}
      </td>

      <td className="td-amt computed">{showPrice ? fmtNum(before, currency) : '•••'}</td>

      <td className="td-vat">
        <input type="number" value={row.vat_rate} disabled={rowLocked}
          onChange={e => set(row._key, 'vat_rate', e.target.value)}
          placeholder="10" min="0" max="100" />
      </td>

      <td className="td-amt computed">{showPrice ? fmtNum(after, currency) : '•••'}</td>

      <td className="td-warranty">
        <input type="text" value={row.warranty_period} disabled={rowLocked}
          onChange={e => set(row._key, 'warranty_period', e.target.value)}
          placeholder="12 tháng" />
      </td>

      <td className="td-supply">
        <PurchaseSupplyLinks
          allLinks={row.links || []}
          targets={targets}
          viewContractId={viewContractId}
          rowQuantity={Number(row.quantity) || 0}
          disabled={row._isNew || !row.id}
          onChange={(links) => onSetLinks(row, links)}
        />
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
            title="Thêm dòng bên dưới" disabled={rowLocked || (row._isNew && !row.id)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </button>
          <button className="act delete" onClick={() => deleteRow(row)} title="Xóa dòng" disabled={rowLocked}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </td>
    </tr>
  )
}
