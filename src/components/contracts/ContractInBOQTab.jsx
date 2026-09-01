import { Fragment } from 'react'
import './ContractBOQTab.css'
import useIsMobile from './useIsMobile'
import BOQMobile from './BOQMobile'
import PurchaseBOQRow from './PurchaseBOQRow'
import PurchaseBOQImportModal from './PurchaseBOQImportModal'
import BOQWarrantyDefaultBar from './BOQWarrantyDefaultBar'
import usePurchaseBOQTab from './usePurchaseBOQTab'
import { fmtNum } from './boqUtils'
import EditGuard from './EditGuard'
import { useCanEdit, useContractPerm } from '../../context/ContractPermContext'

import { API } from '../../config/api'

// Tab Bảng giá mua của HĐ nhập (chỉ render; toàn bộ logic ở hook usePurchaseBOQTab).
export default function ContractInBOQTab({ contractInId, currency = 'VND', viewContractId, warrantyDefault: warrantyDefaultInit }) {
  const {
    rows, loading, totals, visibleRows, isFiltering,
    targets, setLinks,
    bbList, bbById, warrantyDefault, saveWarrantyDefault,
    search, setSearch,
    selected, toggleSelect, allSelected, toggleSelectAll, selectableKeys, selectedCount,
    bulkDelete, bulkDeleting,
    set, saveRow, deleteRow, insertAfter, addRow,
    dragKey, dragOverKey, handleDragStart, handleDragOver, handleDragEnter, handleDrop, handleDragEnd,
    excelRef, handleExcelFile, importData, importMode, setImportMode, importSaving, confirmImport, setImportData,
  } = usePurchaseBOQTab(contractInId, currency, viewContractId, warrantyDefaultInit)

  const isMobile = useIsMobile()
  const canEdit = useCanEdit()
  const { canSection, canLinkSupply } = useContractPerm()
  const showPrice = canSection('ci.pricing.unit_price')

  // PM của HĐ bán đang xem nhưng KHÔNG phải chủ HĐ nhập: chỉ mở cột "Nhập cho", khóa phần còn
  // lại theo từng ô. Mobile không có cột này nên vẫn khóa cả bảng bằng EditGuard như cũ.
  const lockRows = !canEdit && canLinkSupply && !isMobile
  const RowsWrap = lockRows ? Fragment : EditGuard

  if (loading) return <div className="boq-loading">Đang tải bảng giá mua...</div>

  return (
    <div className="boq-tab">
      {/* ── Toolbar ── */}
      <div className="boq-toolbar">
        {/* Ẩn trên điện thoại: Import/Tải template Excel không dùng trên mobile,
            và nút Thêm dòng đã có sẵn trong thẻ BOQMobile. */}
        <div className="boq-toolbar-left hide-on-mobile">
          <EditGuard>
            <button className="boq-btn boq-btn-green" onClick={() => excelRef.current?.click()}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
              </svg>
              Import Excel
            </button>
            <input ref={excelRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleExcelFile} />
          </EditGuard>

          <a className="boq-btn" href={`${API}/purchase-boq/template`} download="BangGiaMua_template.xlsx">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
            Tải template
          </a>

          <EditGuard>
            <button className="boq-btn" onClick={addRow}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              Thêm dòng
            </button>
          </EditGuard>
        </div>

        <div className="boq-toolbar-right">
          <span className="boq-summary">
            <span className="boq-summary-count">{rows.length} dòng</span>
            <span className="boq-summary-sep">|</span>
            Trước VAT: <strong>{showPrice ? fmtNum(totals.before, currency) : '•••'}</strong>
            <span className="boq-summary-sep">|</span>
            Sau VAT: <strong>{showPrice ? fmtNum(totals.after, currency) : '•••'}</strong>
          </span>
        </div>
      </div>

      {/* ── Filter / bulk actions bar ── */}
      <div className="boq-filterbar">
        <div className="boq-filter-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên hàng hóa..."
          />
          {search && <button className="boq-filter-clear" onClick={() => setSearch('')} title="Xóa tìm kiếm">×</button>}
        </div>

        {isFiltering && (
          <span className="boq-filter-count">Hiển thị {visibleRows.length}/{rows.length} dòng</span>
        )}

        {/* Mốc bảo hành mặc định cho cả bảng giá mua — biên bản lấy từ tab Tiến độ của chính HĐ nhập */}
        <EditGuard>
          <BOQWarrantyDefaultBar
            bbList={bbList}
            value={warrantyDefault}
            onSave={saveWarrantyDefault}
          />
        </EditGuard>

        <div className="boq-filter-spacer" />

        {selectedCount > 0 && (
          <>
            <span className="boq-sel-count">Đã chọn {selectedCount}</span>
            <EditGuard>
              <button className="boq-btn boq-btn-danger" onClick={bulkDelete} disabled={bulkDeleting}>
                {bulkDeleting ? 'Đang xóa…' : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    Xóa {selectedCount} dòng
                  </>
                )}
              </button>
            </EditGuard>
          </>
        )}
      </div>

      {/* ── Table (desktop) / Cards (mobile) ── Khóa nhập/xóa khi không phải PM.
          Trường hợp lockRows (PM của HĐ bán đang xem, KHÔNG phải chủ HĐ nhập): không bọc
          EditGuard, vì fieldset[disabled] không cho mở lại control con — thay vào đó khóa
          từng ô bằng prop rowLocked, chừa cột "Nhập cho" cho họ tự ghép hàng. */}
      <RowsWrap>
      {isMobile ? (
        <BOQMobile
          items={visibleRows} currency={currency} showPrice={showPrice}
          set={set} saveRow={saveRow} deleteRow={deleteRow} addRow={addRow} totals={totals}
          showHs={false} showType={false}
          bbList={bbList} bbById={bbById} warrantyDefault={warrantyDefault}
        />
      ) : (
      <div className="boq-table-wrapper">
        <table className="boq-table">
          <thead>
            <tr>
              <th className="th-select">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  disabled={selectableKeys.length === 0 || lockRows}
                  title="Chọn tất cả"
                />
              </th>
              <th className="th-stt">STT</th>
              <th className="th-name">Danh mục hàng hóa</th>
              <th className="th-unit">ĐVT</th>
              <th className="th-num">Số lượng</th>
              <th className="th-num">Đơn giá</th>
              <th className="th-amt">Thành tiền<br/>trước VAT</th>
              <th className="th-vat">VAT<br/>(%)</th>
              <th className="th-amt">Thành tiền<br/>sau VAT</th>
              <th className="th-warranty">Thời hạn<br/>bảo hành</th>
              <th className="th-wty-range">Hiệu lực<br/>bảo hành</th>
              <th className="th-supply">Nhập cho<br/>(hàng bán)</th>
              <th className="th-action"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="13" className="boq-empty">
                  Chưa có dữ liệu bảng giá mua.
                  Nhấn <strong>Thêm dòng</strong> hoặc <strong>Import Excel</strong> để bắt đầu.
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan="13" className="boq-empty">Không có dòng nào khớp tìm kiếm.</td>
              </tr>
            ) : visibleRows.map(({ r, idx }) => (
              <PurchaseBOQRow
                key={r._key}
                row={r}
                idx={idx}
                currency={currency}
                showPrice={showPrice}
                targets={targets}
                viewContractId={viewContractId}
                onSetLinks={setLinks}
                rowLocked={lockRows}
                selected={selected.has(r._key)}
                onToggleSelect={toggleSelect}
                set={set}
                saveRow={saveRow}
                insertAfter={insertAfter}
                deleteRow={deleteRow}
                bbList={bbList}
                bbById={bbById}
                warrantyDefault={warrantyDefault}
                canDrag={canEdit && !isFiltering && !r._isNew && !!r.id}
                isDragging={dragKey === r._key}
                isDragOver={dragOverKey === r._key}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              />
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="totals-row">
                <td colSpan="6" className="totals-label">TỔNG CỘNG</td>
                <td className="td-amt">{showPrice ? fmtNum(totals.before, currency) : '•••'}</td>
                <td />
                <td className="td-amt">{showPrice ? fmtNum(totals.after, currency) : '•••'}</td>
                <td colSpan="4" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      )}
      </RowsWrap>

      {/* ── Import modal ── */}
      {importData && (
        <PurchaseBOQImportModal
          importData={importData}
          importMode={importMode}
          importSaving={importSaving}
          currency={currency}
          onModeChange={setImportMode}
          onConfirm={confirmImport}
          onClose={() => setImportData(null)}
        />
      )}
    </div>
  )
}
