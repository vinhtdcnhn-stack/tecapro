import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import './ContractBOQTab.css'
import BOQImportModal from './BOQImportModal'
import BOQRow from './BOQRow'
import { fmtNum, stripNum, calcAmounts, tmpId } from './boqUtils'
import { API } from '../../config/api'

// ── Component ──────────────────────────────────────────────────────────────────

export default function ContractBOQTab({ contractId }) {
  const [rows, setRows]           = useState([])
  const [currency, setCurrency]   = useState('VND')
  const [loading, setLoading]     = useState(true)
  const [importData, setImportData] = useState(null)  // { items, total }
  const [importMode, setImportMode] = useState('append')
  const [importSaving, setImportSaving] = useState(false)
  const [search, setSearch]       = useState('')
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'trong_nuoc' | 'di_thang'
  const [selected, setSelected]   = useState(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const excelRef = useRef(null)

  // ── Load ─────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const [res, cRes] = await Promise.all([
        fetch(`${API}/contracts/${contractId}/boq`),
        fetch(`${API}/contracts/${contractId}`),
      ])
      const data  = await res.json()
      const cData = await cRes.json()
      setCurrency(cData?.currency_code || 'VND')
      setRows(data.map(r => toLocalRow(r)))
      setSelected(new Set())
    } catch (e) {
      console.error('load BOQ:', e)
    } finally {
      setLoading(false)
    }
  }, [contractId])

  useEffect(() => { load() }, [load])

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function toLocalRow(r) {
    return {
      ...r, _key: String(r.id), _dirty: false, _isNew: false, _saving: false,
      quantity: stripNum(r.quantity), unit_price: stripNum(r.unit_price), vat_rate: stripNum(r.vat_rate),
    }
  }

  function emptyRow(insertAfterRefId = null) {
    return {
      id: null, _key: tmpId(), _dirty: true, _isNew: true, _saving: false,
      _insertAfterRefId: insertAfterRefId,
      item_name: '', hs_code: '', unit: '',
      quantity: '', unit_price: '', vat_rate: '', warranty_period: '',
      item_type: 'trong_nuoc',
    }
  }

  // ── Cell change ───────────────────────────────────────────────────────────────

  const set = (key, field, value) =>
    setRows(prev => prev.map(r => r._key === key ? { ...r, [field]: value, _dirty: true } : r))

  // ── Save row ─────────────────────────────────────────────────────────────────

  const saveRow = async (row) => {
    setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: true } : r))

    const { before, after } = calcAmounts(row.quantity, row.unit_price, row.vat_rate)
    const body = {
      item_name:        row.item_name,
      hs_code:          row.hs_code,
      unit:             row.unit,
      quantity:         row.quantity,
      unit_price:       row.unit_price,
      amount_before_vat: before,
      vat_rate:         row.vat_rate,
      amount_after_vat: after,
      warranty_period:  row.warranty_period,
      item_type:        row.item_type || 'trong_nuoc',
    }

    try {
      let url, method
      if (row._isNew) {
        method = 'POST'
        url = row._insertAfterRefId
          ? `${API}/contracts/${contractId}/boq/after/${row._insertAfterRefId}`
          : `${API}/contracts/${contractId}/boq`
      } else {
        method = 'PUT'
        url = `${API}/boq/${row.id}`
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const saved = await res.json()
      if (!res.ok) throw new Error(saved.error || 'Save failed')

      setRows(prev => prev.map(r =>
        r._key === row._key
          ? { ...toLocalRow(saved), _key: row._key }
          : r
      ))
    } catch (e) {
      alert('Lỗi khi lưu: ' + e.message)
      setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: false } : r))
    }
  }

  // ── Delete row ────────────────────────────────────────────────────────────────

  const deleteRow = async (row) => {
    if (row._isNew) {
      setRows(prev => prev.filter(r => r._key !== row._key))
      return
    }
    if (!confirm(`Xóa dòng "${row.item_name || '(trống)'}"?`)) return
    try {
      const res = await fetch(`${API}/boq/${row.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setRows(prev => prev.filter(r => r._key !== row._key))
      setSelected(prev => { const n = new Set(prev); n.delete(row._key); return n })
    } catch {
      alert('Không thể xóa dòng này.')
    }
  }

  // ── Insert after ──────────────────────────────────────────────────────────────

  const insertAfter = (row) => {
    const newRow = emptyRow(row._isNew ? null : row.id)
    setRows(prev => {
      const copy = [...prev]
      copy.splice(prev.findIndex(r => r._key === row._key) + 1, 0, newRow)
      return copy
    })
  }

  // ── Add row at end ────────────────────────────────────────────────────────────

  const addRow = () => setRows(prev => [...prev, emptyRow(null)])

  // ── Filter ──────────────────────────────────────────────────────────────────

  // Lọc theo từ khóa (tên hàng / HScode) và loại hàng. Dòng mới (_isNew) luôn hiển
  // thị để không bị ẩn khi đang lọc. Giữ số thứ tự gốc qua _idx.
  const visibleRows = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return rows
      .map((r, idx) => ({ r, idx }))
      .filter(({ r }) => {
        if (r._isNew) return true
        if (typeFilter !== 'all' && (r.item_type || 'trong_nuoc') !== typeFilter) return false
        if (!kw) return true
        return `${r.item_name || ''} ${r.hs_code || ''}`.toLowerCase().includes(kw)
      })
  }, [rows, search, typeFilter])

  const isFiltering = search.trim() !== '' || typeFilter !== 'all'

  // ── Selection ─────────────────────────────────────────────────────────────────

  const toggleSelect = (key) =>
    setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  // Các dòng đang nhìn thấy (đã lưu, có id) có thể chọn
  const selectableKeys = visibleRows.filter(({ r }) => !r._isNew).map(({ r }) => r._key)
  const allSelected = selectableKeys.length > 0 && selectableKeys.every(k => selected.has(k))

  const toggleSelectAll = () =>
    setSelected(prev => {
      if (allSelected) {
        const n = new Set(prev); selectableKeys.forEach(k => n.delete(k)); return n
      }
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
        const res = await fetch(`${API}/boq/bulk-delete`, {
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

  // ── Excel import ──────────────────────────────────────────────────────────────

  const handleExcelFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    excelRef.current.value = ''

    const fd = new FormData()
    fd.append('file', file)
    try {
      const res  = await fetch(`${API}/contracts/${contractId}/boq/import`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Lỗi đọc file'); return }
      setImportData(data)
      setImportMode('append')
    } catch (e) {
      alert('Lỗi: ' + e.message)
    }
  }

  const confirmImport = async () => {
    if (!importData) return
    setImportSaving(true)
    try {
      const res = await fetch(`${API}/contracts/${contractId}/boq/save-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: importData.items, replaceAll: importMode === 'replace' }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Lỗi lưu'); return }
      setImportData(null)
      setLoading(true)
      await load()
    } catch (e) {
      alert('Lỗi: ' + e.message)
    } finally {
      setImportSaving(false)
    }
  }

  // ── Totals ────────────────────────────────────────────────────────────────────

  const totals = rows.reduce((acc, r) => {
    const { before, after } = calcAmounts(r.quantity, r.unit_price, r.vat_rate)
    return { before: acc.before + before, after: acc.after + after }
  }, { before: 0, after: 0 })

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return <div className="boq-loading">Đang tải bảng giá...</div>

  return (
    <div className="boq-tab">

      {/* ── Toolbar ── */}
      <div className="boq-toolbar">
        <div className="boq-toolbar-left">
          <button className="boq-btn boq-btn-green" onClick={() => excelRef.current?.click()}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
            </svg>
            Import Excel
          </button>
          <input ref={excelRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleExcelFile} />

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

          <button className="boq-btn" onClick={addRow}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Thêm dòng
          </button>
        </div>

        <div className="boq-toolbar-right">
          <span className="boq-summary">
            <span className="boq-summary-count">{rows.length} dòng</span>
            <span className="boq-summary-sep">|</span>
            Trước VAT: <strong>{fmtNum(totals.before, currency)}</strong>
            <span className="boq-summary-sep">|</span>
            Sau VAT: <strong>{fmtNum(totals.after, currency)}</strong>
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
            <button className="boq-btn boq-btn-danger" onClick={bulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? 'Đang xóa…' : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                  Xóa {selectedCount} dòng
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* ── Table ── */}
      <div className="boq-table-wrapper">
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
              <th className="th-stt">#</th>
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

      {/* ── Excel Import Modal ── */}
      {importData && (
        <BOQImportModal
          importData={importData}
          importMode={importMode}
          importSaving={importSaving}
          onModeChange={setImportMode}
          onConfirm={confirmImport}
          onClose={() => setImportData(null)}
        />
      )}
    </div>
  )
}
