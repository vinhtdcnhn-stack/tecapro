import './ContractBOQTab.css'
import { useState, useEffect } from 'react'
import BOQImportModal from './BOQImportModal'
import BOQRow from './BOQRow'
import BOQMobile from './BOQMobile'
import { fmtNum } from './boqUtils'
import { API } from '../../config/api'
import useBOQTab from './useBOQTab'
import useSyncedHScroll from './useSyncedHScroll'
import EditGuard from './EditGuard'
import { useCanEdit } from '../../context/ContractPermContext'

// ── Component (chỉ render; toàn bộ logic ở hook useBOQTab) ─────────────────────

export default function ContractBOQTab({ contractId }) {
  const {
    rows, currency, loading, totals, isMobile,
    search, setSearch, typeFilter, setTypeFilter, isFiltering, visibleRows,
    selected, toggleSelect, allSelected, toggleSelectAll, selectableKeys, selectedCount,
    bulkDelete, bulkDeleting,
    set, saveRow, deleteRow, insertAfter, addRow,
    dragKey, dragOverKey, handleDragStart, handleDragOver, handleDragEnter, handleDrop, handleDragEnd,
    excelRef, handleExcelFile, importData, importMode, setImportMode, importSaving, confirmImport, setImportData,
  } = useBOQTab(contractId)

  const canEdit = useCanEdit()

  // Phóng to bảng giá toàn màn hình (vẫn giữ thanh menu trình duyệt)
  const [fullscreen, setFullscreen] = useState(false)

  // Khóa cuộn nền + thoát bằng phím Esc khi đang toàn màn hình
  useEffect(() => {
    if (!fullscreen) return
    const onKey = e => { if (e.key === 'Escape') setFullscreen(false) }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [fullscreen])

  // Thanh cuộn ngang nổi (dính đầu bảng), đồng bộ với vùng cuộn của bảng
  const { topRef, bodyRef, width, needed, onTop, onBody } = useSyncedHScroll([rows.length, isMobile, loading, fullscreen])

  if (loading) return <div className="boq-loading">Đang tải bảng giá...</div>

  return (
    <div className={`boq-tab${fullscreen ? ' boq-tab--fullscreen' : ''}`}>

      {/* ── Toolbar ── */}
      <div className="boq-toolbar">
        <div className="boq-toolbar-left">
          <EditGuard>
            <button className="boq-btn boq-btn-green" onClick={() => excelRef.current?.click()}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
              </svg>
              Import Excel
            </button>
            <input ref={excelRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleExcelFile} />
          </EditGuard>

          <a
            className="boq-btn"
            href={`${API}/boq/template`}
            download="BOQ_template.xlsx"
            title="Tải file Excel mẫu"
          >
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
            Trước VAT: <strong>{fmtNum(totals.before, currency)}</strong>
            <span className="boq-summary-sep">|</span>
            Sau VAT: <strong>{fmtNum(totals.after, currency)}</strong>
          </span>

          <button
            className="boq-btn boq-btn-fs"
            onClick={() => setFullscreen(v => !v)}
            title={fullscreen ? 'Thoát toàn màn hình (Esc)' : 'Phóng to toàn màn hình'}
          >
            {fullscreen ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
              </svg>
            )}
            {fullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          </button>
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
            placeholder="Tìm theo tên hàng / HScode..."
          />
          {search && <button className="boq-filter-clear" onClick={() => setSearch('')} title="Xóa tìm kiếm">×</button>}
        </div>

        <select className="boq-filter-type" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">Tất cả loại hàng</option>
          <option value="trong_nuoc">Trong nước</option>
          <option value="di_thang">Đi thẳng</option>
        </select>

        {isFiltering && (
          <span className="boq-filter-count">Hiển thị {visibleRows.length}/{rows.length} dòng</span>
        )}

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

      {/* ── Table (desktop) / Cards (mobile) ── Vô hiệu hóa nhập/xóa khi không phải PM */}
      <EditGuard>
      {isMobile ? (
        <BOQMobile
          rows={visibleRows.map(v => v.r)}
          currency={currency}
          set={set}
          saveRow={saveRow}
          deleteRow={deleteRow}
          addRow={addRow}
          totals={totals}
        />
      ) : (
      <>
      {needed && (
        <div className="boq-scroll-top" ref={topRef} onScroll={onTop}>
          <div className="boq-scroll-top-inner" style={{ width }} />
        </div>
      )}
      <div className="boq-table-wrapper" ref={bodyRef} onScroll={onBody}>
        <table className="boq-table">
          <thead>
            <tr>
              <th className="th-select">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  disabled={selectableKeys.length === 0}
                  title="Chọn tất cả"
                />
              </th>
              <th className="th-stt">STT</th>
              <th className="th-name">Danh mục hàng hóa</th>
              <th className="th-hs">HScode</th>
              <th className="th-unit">ĐVT</th>
              <th className="th-num">Số lượng</th>
              <th className="th-num">Đơn giá</th>
              <th className="th-amt">Thành tiền<br/>trước VAT</th>
              <th className="th-vat">VAT<br/>(%)</th>
              <th className="th-amt">Thành tiền<br/>sau VAT</th>
              <th className="th-warranty">Thời hạn<br/>bảo hành</th>
              <th className="th-item-type">Loại hàng</th>
              <th className="th-action"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="13" className="boq-empty">
                  Chưa có dữ liệu bảng giá.
                  Nhấn <strong>Thêm dòng</strong> hoặc <strong>Import Excel</strong> để bắt đầu.
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan="13" className="boq-empty">Không có dòng nào khớp bộ lọc.</td>
              </tr>
            ) : visibleRows.map(({ r, idx }) => (
              <BOQRow
                key={r._key}
                row={r}
                idx={idx}
                currency={currency}
                selected={selected.has(r._key)}
                onToggleSelect={toggleSelect}
                set={set}
                saveRow={saveRow}
                insertAfter={insertAfter}
                deleteRow={deleteRow}
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
                <td colSpan="7" className="totals-label">TỔNG CỘNG</td>
                <td className="td-amt">{fmtNum(totals.before, currency)}</td>
                <td />
                <td className="td-amt">{fmtNum(totals.after, currency)}</td>
                <td colSpan="3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      </>
      )}
      </EditGuard>

      {/* ── Excel Import Modal ── */}
      {importData && (
        <BOQImportModal
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
