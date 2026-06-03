import { useState, useEffect, useCallback, useRef } from 'react'
import './ContractBOQTab.css'

const API = (() => (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5174').replace(/\/$/, ''))() + '/api'

const fmtNum = (n) => { const num = parseFloat(n) || 0; return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: num % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 }).format(num) }

function calcAmounts(qty, price, vat) {
  const q = parseFloat(qty) || 0
  const p = parseFloat(price) || 0
  const v = parseFloat(vat) || 0
  const before = q * p
  return { before, after: before * (1 + v / 100) }
}

let _tmpCounter = 0
const tmpId = () => `tmp_${++_tmpCounter}`

// ── Component ──────────────────────────────────────────────────────────────────

export default function ContractBOQTab({ contractId }) {
  const [rows, setRows]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [importData, setImportData] = useState(null)  // { items, total }
  const [importMode, setImportMode] = useState('append')
  const [importSaving, setImportSaving] = useState(false)
  const excelRef = useRef(null)

  // ── Load ─────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/contracts/${contractId}/boq`)
      const data = await res.json()
      setRows(data.map(r => toLocalRow(r)))
    } catch (e) {
      console.error('load BOQ:', e)
    } finally {
      setLoading(false)
    }
  }, [contractId])

  useEffect(() => { load() }, [load])

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function toLocalRow(r) {
    return { ...r, _key: String(r.id), _dirty: false, _isNew: false, _saving: false }
  }

  function emptyRow(insertAfterRefId = null) {
    return {
      id: null, _key: tmpId(), _dirty: true, _isNew: true, _saving: false,
      _insertAfterRefId: insertAfterRefId,
      item_name: '', hs_code: '', unit: '',
      quantity: '', unit_price: '', vat_rate: '', warranty_period: '',
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
            Trước VAT: <strong>{fmtNum(totals.before)}</strong>
            <span className="boq-summary-sep">|</span>
            Sau VAT: <strong>{fmtNum(totals.after)}</strong>
          </span>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="boq-table-wrapper">
        <table className="boq-table">
          <thead>
            <tr>
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
              <th className="th-action"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="11" className="boq-empty">
                  Chưa có dữ liệu bảng giá.
                  Nhấn <strong>Thêm dòng</strong> hoặc <strong>Import Excel</strong> để bắt đầu.
                </td>
              </tr>
            ) : rows.map((row, idx) => {
              const { before, after } = calcAmounts(row.quantity, row.unit_price, row.vat_rate)
              return (
                <tr
                  key={row._key}
                  className={[
                    row._isNew  ? 'row-new'   : '',
                    row._dirty  ? 'row-dirty' : '',
                    row._saving ? 'row-saving': '',
                  ].filter(Boolean).join(' ')}
                >
                  <td className="td-stt">
                    {row._dirty && <span className="dirty-dot" title="Chưa lưu" />}
                    <span className="stt-num">{idx + 1}</span>
                  </td>

                  <td className="td-name">
                    <input
                      type="text"
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
                    <input
                      type="number"
                      value={row.unit_price}
                      onChange={e => set(row._key, 'unit_price', e.target.value)}
                      placeholder="0"
                      min="0"
                    />
                  </td>

                  <td className="td-amt computed">{fmtNum(before)}</td>

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

                  <td className="td-amt computed">{fmtNum(after)}</td>

                  <td className="td-warranty">
                    <input
                      type="text"
                      value={row.warranty_period}
                      onChange={e => set(row._key, 'warranty_period', e.target.value)}
                      placeholder="12 tháng"
                    />
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
            })}
          </tbody>

          {rows.length > 0 && (
            <tfoot>
              <tr className="totals-row">
                <td colSpan="6" className="totals-label">TỔNG CỘNG</td>
                <td className="td-amt">{fmtNum(totals.before)}</td>
                <td />
                <td className="td-amt">{fmtNum(totals.after)}</td>
                <td colSpan="2" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Excel Import Modal ── */}
      {importData && (
        <div className="modal-overlay" onClick={() => setImportData(null)}>
          <div className="boq-import-modal" onClick={e => e.stopPropagation()}>

            <div className="boq-import-header">
              <div>
                <h3>Preview dữ liệu Excel</h3>
                <p className="boq-import-count">{importData.total} dòng dữ liệu</p>
              </div>
              <button className="btn-close-preview" onClick={() => setImportData(null)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>

            <div className="boq-import-mode">
              <label>
                <input type="radio" value="append" checked={importMode === 'append'} onChange={() => setImportMode('append')} />
                Thêm vào cuối danh sách hiện có
              </label>
              <label>
                <input type="radio" value="replace" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} />
                <span className="replace-warn">Xóa toàn bộ và nhập mới</span>
              </label>
            </div>

            <div className="boq-import-hint">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
              Định dạng cột Excel: A=Danh mục · B=HScode · C=ĐVT · D=Số lượng · E=Đơn giá · F=VAT(%) · G=Thời hạn bảo hành
            </div>

            <div className="boq-import-preview">
              <table className="boq-table">
                <thead>
                  <tr>
                    <th className="th-stt">#</th>
                    <th className="th-name">Danh mục hàng hóa</th>
                    <th className="th-hs">HScode</th>
                    <th className="th-unit">ĐVT</th>
                    <th className="th-num">Số lượng</th>
                    <th className="th-num">Đơn giá</th>
                    <th className="th-amt">Trước VAT</th>
                    <th className="th-vat">VAT%</th>
                    <th className="th-amt">Sau VAT</th>
                    <th className="th-warranty">Bảo hành</th>
                  </tr>
                </thead>
                <tbody>
                  {importData.items.map((item, idx) => {
                    const { before, after } = calcAmounts(item.quantity, item.unit_price, item.vat_rate)
                    return (
                      <tr key={idx}>
                        <td className="td-stt"><span className="stt-num">{idx + 1}</span></td>
                        <td className="td-name"><span className="preview-text">{item.item_name}</span></td>
                        <td className="td-hs"><span className="preview-text">{item.hs_code}</span></td>
                        <td className="td-unit"><span className="preview-text">{item.unit}</span></td>
                        <td className="td-num"><span className="preview-text">{fmtNum(item.quantity)}</span></td>
                        <td className="td-num"><span className="preview-text">{fmtNum(item.unit_price)}</span></td>
                        <td className="td-amt computed">{fmtNum(before)}</td>
                        <td className="td-vat"><span className="preview-text">{item.vat_rate}%</span></td>
                        <td className="td-amt computed">{fmtNum(after)}</td>
                        <td className="td-warranty"><span className="preview-text">{item.warranty_period}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="boq-import-footer">
              <button className="btn-cancel" onClick={() => setImportData(null)}>Hủy</button>
              <button className="btn-confirm" onClick={confirmImport} disabled={importSaving}>
                {importSaving ? 'Đang lưu...' : `Xác nhận nhập ${importData.total} dòng`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
