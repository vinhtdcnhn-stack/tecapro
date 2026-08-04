import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react'
import './ContractBOQTab.css'
import useCtrlSave from './useCtrlSave'
import useIsMobile from './useIsMobile'
import BOQMobile from './BOQMobile'
import PurchaseBOQRow from './PurchaseBOQRow'
import PurchaseBOQImportModal from './PurchaseBOQImportModal'
import usePurchaseBOQLink from './usePurchaseBOQLink'
import { fmtNum, stripNum, calcAmounts, tmpId } from './boqUtils'
import EditGuard from './EditGuard'
import { useCanEdit, useContractPerm } from '../../context/ContractPermContext'

import { API } from '../../config/api'
import { apiGet } from '../../lib/api'
import { withStamp, handledConflict } from './conflict'

export default function ContractInBOQTab({ contractInId, currency = 'VND', viewContractId }) {
  const [rows, setRows]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [importData, setImportData]   = useState(null)
  const [importMode, setImportMode]   = useState('append')
  const [importSaving, setImportSaving] = useState(false)
  const [search, setSearch]           = useState('')
  const [selected, setSelected]       = useState(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [dragKey, setDragKey]         = useState(null)   // _key của dòng đang kéo
  const [dragOverKey, setDragOverKey] = useState(null)
  const excelRef = useRef(null)

  const { targets, reloadTargets, saveLinks } = usePurchaseBOQLink(contractInId, viewContractId)

  const toLocalRow = (r) => ({
    ...r, _key: String(r.id), _dirty: false, _isNew: false, _saving: false,
    links: Array.isArray(r.links) ? r.links : [],
    quantity: stripNum(r.quantity), unit_price: stripNum(r.unit_price), vat_rate: stripNum(r.vat_rate),
  })

  // Thay toàn bộ ghép "Nhập cho" của 1 dòng (nhiều đầu bán); cập nhật links trong state + làm mới target.
  const setLinks = async (row, links) => {
    try {
      const saved = await saveLinks(row.id, links)
      setRows(prev => prev.map(r => r._key === row._key ? { ...r, links: saved } : r))
      reloadTargets()
    } catch (e) { alert('Lỗi lưu "Nhập cho": ' + e.message) }
  }

  const load = useCallback(async () => {
    try {
      const data = await apiGet(`/contract-ins/${contractInId}/boq`, { conditional: true })
      setRows((Array.isArray(data) ? data : []).map(r => toLocalRow(r)))
      setSelected(new Set())
    } catch (e) { console.error('load purchase BOQ:', e) }
    finally { setLoading(false) }
  }, [contractInId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() là async: setState xảy ra SAU await, không phải cascade đồng bộ
  useEffect(() => { load() }, [load])

  const emptyRow = (insertAfterRefId = null) => ({
    id: null, _key: tmpId(), _dirty: true, _isNew: true, _saving: false,
    _insertAfterRefId: insertAfterRefId,
    item_name: '', unit: '', quantity: '', unit_price: '', vat_rate: '', warranty_period: '',
  })

  const set = (key, field, value) =>
    setRows(prev => prev.map(r => r._key === key ? { ...r, [field]: value, _dirty: true } : r))

  // Không cho phép 2 dòng trùng tên hàng (đã cắt khoảng trắng, không phân biệt hoa/thường).
  const duplicateNameKey = (row) => {
    const name = (row.item_name || '').trim().toLowerCase()
    if (!name) return null
    const dup = rows.find(r => r._key !== row._key && (r.item_name || '').trim().toLowerCase() === name)
    return dup ? dup._key : null
  }

  const saveRow = async (row) => {
    if (duplicateNameKey(row)) {
      alert(`Trùng tên hàng hóa: "${row.item_name.trim()}" đã có ở dòng khác trong bảng giá mua.`)
      return
    }
    setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: true } : r))
    const { before, after } = calcAmounts(row.quantity, row.unit_price, row.vat_rate, currency)
    const body = {
      item_name: row.item_name, unit: row.unit,
      quantity: row.quantity, unit_price: row.unit_price,
      amount_before_vat: before, vat_rate: row.vat_rate,
      amount_after_vat: after, warranty_period: row.warranty_period,
    }
    try {
      let url, method
      if (row._isNew) {
        method = 'POST'
        url = row._insertAfterRefId
          ? `${API}/contract-ins/${contractInId}/boq/after/${row._insertAfterRefId}`
          : `${API}/contract-ins/${contractInId}/boq`
      } else {
        method = 'PUT'
        url = `${API}/purchase-boq/${row.id}`
      }
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(withStamp(body, row)) })
      const saved = await res.json()
      if (await handledConflict(res, saved, load)) return
      if (!res.ok) throw new Error(saved.error || 'Save failed')
      // Giữ lại ghép "Nhập cho" (links) vì response lưu dòng không kèm trường này.
      setRows(prev => prev.map(r => r._key === row._key ? {
        ...toLocalRow(saved), _key: row._key, links: r.links || [],
      } : r))
    } catch (e) {
      alert('Lỗi khi lưu: ' + e.message)
      setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: false } : r))
    }
  }

  const deleteRow = async (row) => {
    if (row._isNew) { setRows(prev => prev.filter(r => r._key !== row._key)); return }
    if (!confirm(`Xóa dòng "${row.item_name || '(trống)'}"?`)) return
    try {
      await fetch(`${API}/purchase-boq/${row.id}`, { method: 'DELETE' })
      setRows(prev => prev.filter(r => r._key !== row._key))
      setSelected(prev => { const n = new Set(prev); n.delete(row._key); return n })
    } catch { alert('Không thể xóa dòng này.') }
  }

  const insertAfter = (row) => {
    const newRow = emptyRow(row._isNew ? null : row.id)
    setRows(prev => {
      const copy = [...prev]
      copy.splice(prev.findIndex(r => r._key === row._key) + 1, 0, newRow)
      return copy
    })
  }

  const addRow = () => {
    const r = emptyRow(null)
    setRows(prev => [...prev, r])
    return r._key
  }

  // ── Kéo-thả đổi thứ tự ─────────────────────────────────────────────────────
  // Chỉ cho phép kéo dòng đã lưu (có id).

  const persistOrder = async (orderedRows) => {
    const ids = orderedRows.filter(r => !r._isNew && r.id).map(r => r.id)
    if (!ids.length) return
    try {
      await fetch(`${API}/contract-ins/${contractInId}/boq/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
    } catch (e) {
      console.error('reorder purchase BOQ:', e)
      load()  // khôi phục thứ tự từ server nếu lỗi
    }
  }

  const handleDragStart = (e, key) => {
    // Không bắt đầu kéo khi thao tác trong ô nhập liệu
    const tag = e.target.tagName
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') {
      e.preventDefault()
      return
    }
    setDragKey(key)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', key)  // Firefox cần dữ liệu để khởi động kéo
  }

  const handleDragOver = (e) => {
    if (!dragKey) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (key) => {
    if (dragKey && key !== dragKey) setDragOverKey(key)
  }

  const handleDragEnd = () => { setDragKey(null); setDragOverKey(null) }

  const handleDrop = (e, targetKey) => {
    e.preventDefault()
    if (!dragKey || dragKey === targetKey) { handleDragEnd(); return }

    // Thả ở nửa dưới của dòng đích → chèn sau, nửa trên → chèn trước
    const rect = e.currentTarget.getBoundingClientRect()
    const after = (e.clientY - rect.top) > rect.height / 2

    let reordered = null
    setRows(prev => {
      const copy = [...prev]
      const from = copy.findIndex(r => r._key === dragKey)
      if (from < 0) return prev
      const [moved] = copy.splice(from, 1)
      const to = copy.findIndex(r => r._key === targetKey)
      if (to < 0) return prev
      copy.splice(after ? to + 1 : to, 0, moved)
      reordered = copy
      return copy
    })
    if (reordered) persistOrder(reordered)
    handleDragEnd()
  }

  const isMobile = useIsMobile()
  const canEdit = useCanEdit()
  const { canSection, canLinkSupply } = useContractPerm()
  const showPrice = canSection('ci.pricing.unit_price')

  // PM của HĐ bán đang xem nhưng KHÔNG phải chủ HĐ nhập: chỉ mở cột "Nhập cho", khóa phần còn
  // lại theo từng ô. Mobile không có cột này nên vẫn khóa cả bảng bằng EditGuard như cũ.
  const lockRows = !canEdit && canLinkSupply && !isMobile
  const RowsWrap = lockRows ? Fragment : EditGuard

  // Ctrl+S: lưu tất cả dòng đang sửa
  useCtrlSave(() => rows.filter(r => r._dirty && !r._saving).forEach(saveRow))

  // ── Lọc theo tên hàng ─────────────────────────────────────────────────────
  // Dòng mới (_isNew) luôn hiển thị để không bị ẩn khi đang lọc. Giữ số thứ tự gốc qua idx.
  const visibleRows = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return rows
      .map((r, idx) => ({ r, idx }))
      .filter(({ r }) => {
        if (r._isNew) return true
        if (!kw) return true
        return (r.item_name || '').toLowerCase().includes(kw)
      })
  }, [rows, search])

  const isFiltering = search.trim() !== ''

  // ── Chọn nhiều dòng để xóa loạt ────────────────────────────────────────────
  const toggleSelect = (key) =>
    setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  const selectableKeys = visibleRows.filter(({ r }) => !r._isNew).map(({ r }) => r._key)
  const allSelected = selectableKeys.length > 0 && selectableKeys.every(k => selected.has(k))

  const toggleSelectAll = () =>
    setSelected(prev => {
      if (allSelected) { const n = new Set(prev); selectableKeys.forEach(k => n.delete(k)); return n }
      return new Set([...prev, ...selectableKeys])
    })

  const selectedCount = selected.size

  const bulkDelete = async () => {
    const keys = [...selected]
    const targets = rows.filter(r => keys.includes(r._key))
    const ids = targets.filter(r => !r._isNew && r.id).map(r => r.id)
    if (!confirm(`Xóa ${targets.length} dòng đã chọn?`)) return

    setBulkDeleting(true)
    try {
      if (ids.length) {
        const res = await fetch(`${API}/purchase-boq/bulk-delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        })
        if (!res.ok) throw new Error('Bulk delete failed')
      }
      setRows(prev => prev.filter(r => !keys.includes(r._key)))
      setSelected(new Set())
    } catch {
      alert('Không thể xóa các dòng đã chọn.')
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleExcelFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    excelRef.current.value = ''
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res  = await fetch(`${API}/contract-ins/${contractInId}/boq/import`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Lỗi đọc file'); return }
      setImportData(data)
      setImportMode('append')
    } catch (e) { alert('Lỗi: ' + e.message) }
  }

  const confirmImport = async () => {
    if (!importData) return
    setImportSaving(true)
    try {
      const res = await fetch(`${API}/contract-ins/${contractInId}/boq/save-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: importData.items, replaceAll: importMode === 'replace' }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Lỗi lưu'); return }
      setImportData(null)
      setLoading(true)
      await load()
    } catch (e) { alert('Lỗi: ' + e.message) }
    finally { setImportSaving(false) }
  }

  const totals = rows.reduce((acc, r) => {
    const { before, after } = calcAmounts(r.quantity, r.unit_price, r.vat_rate, currency)
    return { before: acc.before + before, after: acc.after + after }
  }, { before: 0, after: 0 })

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
              <th className="th-supply">Nhập cho<br/>(hàng bán)</th>
              <th className="th-action"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="12" className="boq-empty">
                  Chưa có dữ liệu bảng giá mua.
                  Nhấn <strong>Thêm dòng</strong> hoặc <strong>Import Excel</strong> để bắt đầu.
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan="12" className="boq-empty">Không có dòng nào khớp tìm kiếm.</td>
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
                <td colSpan="3" />
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
