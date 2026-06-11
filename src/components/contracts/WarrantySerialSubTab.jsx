import { useState } from 'react'
import DateInput, { isoToDisplay } from './DateInput'

import { API } from '../../config/api'
import { SERIAL_STATUSES, warrantyStatus, flattenSerials, toISODate } from './warrantyUtils'
import WarrantyBulkDateModal from './WarrantyBulkDateModal'
import { ComponentModal, ReplaceSerialModal } from './SerialModals'
import useCtrlSave from './useCtrlSave'
import useIsMobile from './useIsMobile'
import SerialMobile from './SerialMobile'

const INACTIVE_STATUSES = ['Đã thay thế', 'Ngừng sử dụng']

// ── Quản lý Serial: mỗi serial 1 dòng, có bảo hành riêng + gắn máy cha (tùy chọn) ──

export default function WarrantySerialSubTab({ contractId, equipment, setEquipment, reload }) {
  const [edits, setEdits]   = useState({})   // { [serialId]: { field: value } }
  const [saving, setSaving] = useState({})   // { [serialId]: true }
  const [search, setSearch] = useState('')
  const [filterEq, setFilterEq] = useState('')   // equipment_id lọc theo loại
  const [showAdd, setShowAdd] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [showBulk, setShowBulk] = useState(false)
  const [replaceFor, setReplaceFor] = useState(null)   // serial đang được thay thế
  const isMobile = useIsMobile()

  const all = flattenSerials(equipment)
  const snById = new Map(all.map(s => [String(s.id), s.serial_no]))

  const parentLabel = (id) => {
    const p = all.find(s => String(s.id) === String(id))
    return p ? `${p.eqName} – ${p.serial_no}` : '—'
  }

  const filtered = all.filter(s => {
    if (filterEq && String(s.equipment_id) !== String(filterEq)) return false
    const t = search.trim().toLowerCase()
    if (!t) return true
    return [s.serial_no, s.eqName, s.brand, s.model].some(v => v?.toLowerCase().includes(t))
  })

  const val   = (row, f) => (edits[row.id] && f in edits[row.id]) ? edits[row.id][f] : (row[f] ?? '')
  const dirty = (id) => !!edits[id]
  const setF  = (id, f, v) => setEdits(prev => ({ ...prev, [id]: { ...prev[id], [f]: v } }))

  function applyServerSerial(saved, equipmentId) {
    setEquipment(prev => prev.map(eq =>
      eq.id === equipmentId ? { ...eq, serials: (eq.serials || []).map(s => s.id === saved.id ? saved : s) } : eq
    ))
  }

  async function save(row) {
    setSaving(p => ({ ...p, [row.id]: true }))
    const body = {
      serial_no:        val(row, 'serial_no'),
      status:           val(row, 'status') || 'Đang hoạt động',
      note:             val(row, 'note'),
      warranty_from:    val(row, 'warranty_from') || null,
      warranty_to:      val(row, 'warranty_to') || null,
      parent_serial_id: val(row, 'parent_serial_id') || null,
    }
    try {
      const res = await fetch(`${API}/serials/${row.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lỗi lưu serial')
      applyServerSerial(data, row.equipment_id)
      setEdits(prev => { const n = { ...prev }; delete n[row.id]; return n })
    } catch (e) { alert('Lỗi: ' + e.message) }
    finally { setSaving(p => { const n = { ...p }; delete n[row.id]; return n }) }
  }

  async function del(row) {
    if (!confirm(`Xóa serial "${row.serial_no}"?`)) return
    await fetch(`${API}/serials/${row.id}`, { method: 'DELETE' })
    setEquipment(prev => prev.map(eq =>
      eq.id === row.equipment_id ? { ...eq, serials: eq.serials.filter(s => s.id !== row.id) } : eq
    ))
  }

  // Thêm 1 linh kiện (tự tạo loại nếu chưa có) qua endpoint import
  async function addComponent(form) {
    const res = await fetch(`${API}/contracts/${contractId}/serials/import`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([form]),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    setShowAdd(false)
    await reload()
  }

  // ── Excel ──
  async function downloadTemplate() {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([
      ['Tên linh kiện', 'Hãng', 'Model', 'Serial', 'BH từ (YYYY-MM-DD)', 'BH đến (YYYY-MM-DD)', 'Serial máy (nếu thuộc máy)'],
      ['Ổ cứng SSD 960GB', 'Samsung', 'PM893', 'S6X1NN0', '2025-01-01', '2030-12-31', 'SRV-001'],
      ['RAM 32GB DDR4', 'Kingston', 'KSM32', 'KR32A1', '2025-01-01', '2027-12-31', 'SRV-001'],
      ['CPU Xeon 4310', 'Intel', '4310', 'CPU99X', '2025-01-01', '2028-12-31', ''],
    ])
    ws['!cols'] = [22, 14, 14, 16, 18, 18, 22].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Serial linh kiện')
    XLSX.writeFile(wb, 'mau_serial_linh_kien.xlsx')
  }

  function handleImportFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const XLSX  = await import('xlsx')
      const wb   = XLSX.read(new Uint8Array(ev.target.result), { type: 'array', cellDates: true })
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      const items = []
      for (const row of rows) {
        const name = String(row['Tên linh kiện'] || '').trim()
        const sn   = String(row['Serial'] || '').trim()
        if (!name || !sn) continue
        items.push({
          name, serial_no: sn,
          brand: String(row['Hãng'] || '').trim(),
          model: String(row['Model'] || '').trim(),
          warranty_from: toISODate(row['BH từ (YYYY-MM-DD)']),
          warranty_to:   toISODate(row['BH đến (YYYY-MM-DD)']),
          parent_serial_no: String(row['Serial máy (nếu thuộc máy)'] || '').trim(),
        })
      }
      setImportPreview(items)
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  async function confirmImport() {
    if (!importPreview?.length) return
    setImporting(true)
    try {
      const res = await fetch(`${API}/contracts/${contractId}/serials/import`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(importPreview),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      alert(`Đã thêm ${data.imported} serial linh kiện!`)
      setImportPreview(null)
      await reload()
    } catch (e) { alert('Lỗi: ' + e.message) }
    finally { setImporting(false) }
  }

  // ── Chọn & sửa hàng loạt ──
  const filteredIds = filtered.map(r => r.id)
  const allChecked  = filteredIds.length > 0 && filteredIds.every(id => selected.has(id))
  const toggleOne = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSelected(prev => {
    const n = new Set(prev)
    if (allChecked) filteredIds.forEach(id => n.delete(id))
    else filteredIds.forEach(id => n.add(id))
    return n
  })
  async function applyBulk({ warranty_from, warranty_to }) {
    const res = await fetch(`${API}/serials/bulk-warranty`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selected], warranty_from, warranty_to }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    setShowBulk(false); setSelected(new Set())
    await reload()
  }
  async function bulkDelete() {
    if (!confirm(`Xóa ${selected.size} serial đã chọn?`)) return
    const res = await fetch(`${API}/serials/bulk-delete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selected] }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error || 'Không thể xóa'); return }
    setSelected(new Set())
    await reload()
  }

  // Ctrl+S: lưu tất cả dòng đang sửa
  useCtrlSave(() => Object.keys(edits).forEach(id => {
    if (saving[id]) return
    const row = all.find(s => String(s.id) === String(id))
    if (row) save(row)
  }))

  return (
    <>
      <div className="wty-toolbar">
        <input className="wty-search" placeholder="🔍 Tìm serial, thiết bị, hãng, model..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <div className="wty-toolbar-right">
          <select className="wty-search" style={{ minWidth: 180 }} value={filterEq} onChange={e => setFilterEq(e.target.value)}>
            <option value="">— Tất cả loại thiết bị —</option>
            {equipment.map(eq => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
          </select>
          <button className="wty-btn wty-btn-secondary" onClick={downloadTemplate}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            Tải mẫu Excel
          </button>
          <label className="wty-btn wty-btn-blue" style={{ cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>
            Import Excel
            <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportFile} />
          </label>
          <button className="wty-btn wty-btn-primary" onClick={() => setShowAdd(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Thêm linh kiện
          </button>
        </div>
      </div>

      {/* Thanh chọn hàng loạt */}
      {selected.size > 0 && (
        <div className="wty-bulk-bar">
          <span>Đã chọn <strong>{selected.size}</strong> dòng</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="wty-btn wty-btn-primary" onClick={() => setShowBulk(true)}>Sửa bảo hành hàng loạt</button>
            <button className="wty-btn wty-btn-danger" onClick={bulkDelete}>Xóa hàng loạt</button>
            <button className="wty-btn wty-btn-secondary" onClick={() => setSelected(new Set())}>Bỏ chọn</button>
          </div>
        </div>
      )}

      {/* Import preview */}
      {importPreview && (
        <div className="wty-section">
          <div className="wty-section-header">
            <span className="wty-section-title">Xem trước ({importPreview.length} serial linh kiện)</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="wty-btn wty-btn-secondary" onClick={() => setImportPreview(null)}>Hủy</button>
              <button className="wty-btn wty-btn-primary" onClick={confirmImport} disabled={importing}>
                {importing ? 'Đang thêm...' : 'Xác nhận'}
              </button>
            </div>
          </div>
          <div className="import-preview">
            <table>
              <thead>
                <tr><th>Tên linh kiện</th><th>Hãng</th><th>Model</th><th>Serial</th><th>BH từ</th><th>BH đến</th><th>Thuộc máy</th></tr>
              </thead>
              <tbody>
                {importPreview.map((it, i) => (
                  <tr key={i}>
                    <td>{it.name}</td><td>{it.brand}</td><td>{it.model}</td><td>{it.serial_no}</td>
                    <td>{it.warranty_from}</td><td>{it.warranty_to}</td><td>{it.parent_serial_no || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isMobile ? (
        <SerialMobile
          rows={filtered} allSerials={all}
          val={val} setF={setF} save={save} saving={saving} del={del}
          onReplace={setReplaceFor} statuses={SERIAL_STATUSES} warrantyStatus={warrantyStatus}
        />
      ) : (
      <div className="wty-section">
        <div className="wty-table-wrap">
          <table className="wty-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}><input type="checkbox" checked={allChecked} onChange={toggleAll} title="Chọn tất cả (theo bộ lọc)" /></th>
                <th style={{ width: 36 }}>#</th>
                <th>Loại thiết bị</th>
                <th>Serial</th>
                <th>Hãng / Model</th>
                <th style={{ width: 140 }}>BH từ</th>
                <th style={{ width: 140 }}>BH đến</th>
                <th style={{ width: 130 }}>Tình trạng</th>
                <th style={{ width: 180 }}>Thuộc máy</th>
                <th style={{ width: 70 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="10" className="wty-empty">
                  Chưa có serial nào. Nhấn <strong>Thêm linh kiện</strong> hoặc <strong>Import Excel</strong>.
                </td></tr>
              ) : filtered.map((row, idx) => {
                const ws = warrantyStatus(val(row, 'warranty_to') || row.effTo)
                const inactive = INACTIVE_STATUSES.includes(row.status)
                return (
                  <tr key={row.id} className={`${dirty(row.id) ? 'row-dirty' : ''}${inactive ? ' row-inactive' : ''}`}>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleOne(row.id)} />
                    </td>
                    <td style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>{idx + 1}</td>
                    <td><strong>{row.eqName}</strong></td>
                    <td>
                      <input className="ser-inp" value={val(row, 'serial_no')}
                        onChange={e => setF(row.id, 'serial_no', e.target.value)} />
                      {row.replaced_by_serial_id && (
                        <div className="ser-replaced-by" title="Đã thay bằng serial mới">
                          ↳ thay bằng {snById.get(String(row.replaced_by_serial_id)) || `#${row.replaced_by_serial_id}`}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{row.brand || '—'}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{row.model || '—'}</div>
                    </td>
                    <td>
                      <DateInput className="ser-inp" value={(val(row, 'warranty_from') || '').slice(0, 10)}
                        placeholder={!val(row, 'warranty_from') && row.effFrom ? isoToDisplay(row.effFrom) : 'dd/mm/yyyy'}
                        title={row.effFrom && !val(row, 'warranty_from') ? 'Đang kế thừa hạn của thiết bị' : ''}
                        onChange={e => setF(row.id, 'warranty_from', e.target.value)} />
                    </td>
                    <td>
                      <DateInput className="ser-inp" value={(val(row, 'warranty_to') || '').slice(0, 10)}
                        placeholder={!val(row, 'warranty_to') && row.effTo ? isoToDisplay(row.effTo) : 'dd/mm/yyyy'}
                        title={row.effTo && !val(row, 'warranty_to') ? 'Đang kế thừa hạn của thiết bị' : ''}
                        onChange={e => setF(row.id, 'warranty_to', e.target.value)} />
                      <span className={`wty-badge ${ws.cls}`} style={{ marginTop: 3 }}>{ws.label}</span>
                    </td>
                    <td>
                      <select className="ser-inp" value={val(row, 'status') || 'Đang hoạt động'}
                        onChange={e => setF(row.id, 'status', e.target.value)}>
                        {SERIAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="ser-inp" value={val(row, 'parent_serial_id') || ''}
                        title={val(row, 'parent_serial_id') ? parentLabel(val(row, 'parent_serial_id')) : ''}
                        onChange={e => setF(row.id, 'parent_serial_id', e.target.value)}>
                        <option value="">— Rời / chưa rõ —</option>
                        {all.filter(o => o.id !== row.id)
                            .map(o => <option key={o.id} value={o.id}>{o.eqName} – {o.serial_no}</option>)}
                      </select>
                    </td>
                    <td>
                      <div className="wty-actions">
                        {dirty(row.id) && (
                          <button className="wty-act edit" onClick={() => save(row)} disabled={saving[row.id]} title="Lưu">
                            {saving[row.id] ? '…' : (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
                            )}
                          </button>
                        )}
                        {!row.replaced_by_serial_id && (
                          <button className="wty-act replace" onClick={() => setReplaceFor(row)} title="Thay thế serial sau bảo hành">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 6V3L8 7l4 4V8c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l1.52 1.52A6.96 6.96 0 0 0 19 13c0-3.87-3.13-7-7-7zm0 12c-2.76 0-5-2.24-5-5 0-.65.13-1.26.36-1.83L5.84 9.65A6.96 6.96 0 0 0 5 13c0 3.87 3.13 7 7 7v3l4-4-4-4v3z"/></svg>
                          </button>
                        )}
                        <button className="wty-act delete" onClick={() => del(row)} title="Xóa">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {showAdd && (
        <ComponentModal equipment={equipment} serials={all} onClose={() => setShowAdd(false)} onSave={addComponent} />
      )}
      {showBulk && (
        <WarrantyBulkDateModal count={selected.size} onClose={() => setShowBulk(false)} onApply={applyBulk} />
      )}
      {replaceFor && (
        <ReplaceSerialModal
          serial={replaceFor}
          endpoint={`${API}/serials/${replaceFor.id}/replace`}
          onClose={() => setReplaceFor(null)}
          onDone={async () => { setReplaceFor(null); await reload() }}
        />
      )}
    </>
  )
}
