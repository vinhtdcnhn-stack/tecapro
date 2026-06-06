import { useState } from 'react'
import * as XLSX from 'xlsx'

import { API } from '../../config/api'
import { fmtDate, toISODate, warrantyStatus, warrantyCounts } from './warrantyUtils'
import EquipmentModal from './WarrantyEquipmentModal'
import WarrantyBulkDateModal from './WarrantyBulkDateModal'

// ── Equipment Sub-tab ─────────────────────────────────────────────────────────

export default function EquipmentSubTab({ contractId, equipment, setEquipment, reload }) {
  const [search, setSearch]     = useState('')
  const [expanded, setExpanded] = useState(new Set())
  const [modalOpen, setModal]   = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [showBulk, setShowBulk] = useState(false)

  const filtered = equipment.filter(e => {
    const t = search.toLowerCase()
    return !t || e.name?.toLowerCase().includes(t) || e.brand?.toLowerCase().includes(t) ||
      e.model?.toLowerCase().includes(t) || e.location?.toLowerCase().includes(t)
  })

  // Summary — tính theo TỪNG serial (serial có hạn riêng; thiết bị không serial tính theo hạn thiết bị)
  const { totalSerials, expiring, expired } = warrantyCounts(equipment)

  // ── Chọn & sửa bảo hành hàng loạt ──
  const filteredIds = filtered.map(e => e.id)
  const allChecked  = filteredIds.length > 0 && filteredIds.every(id => selected.has(id))
  const toggleOne = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSelected(prev => {
    const n = new Set(prev)
    if (allChecked) filteredIds.forEach(id => n.delete(id))
    else filteredIds.forEach(id => n.add(id))
    return n
  })
  async function applyBulk({ warranty_from, warranty_to }) {
    const res = await fetch(`${API}/equipment/bulk-warranty`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selected], warranty_from, warranty_to }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    setShowBulk(false); setSelected(new Set())
    await reload()
  }

  function toggleExpand(id) {
    setExpanded(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  async function handleDelete(e) {
    if (!confirm(`Xóa thiết bị "${e.name}"? Các serial và liên kết bảo hành sẽ bị xóa.`)) return
    await fetch(`${API}/equipment/${e.id}`, { method: 'DELETE' })
    setEquipment(prev => prev.filter(x => x.id !== e.id))
  }

  async function handleSave(form, isEdit) {
    const url = isEdit ? `${API}/equipment/${editItem.id}` : `${API}/contracts/${contractId}/equipment`
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    if (isEdit) setEquipment(prev => prev.map(x => x.id === editItem.id ? data : x))
    else setEquipment(prev => [...prev, data])
    setModal(false)
  }

  async function handleAddSerial(equipmentId, serialNo) {
    const res = await fetch(`${API}/equipment/${equipmentId}/serials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serial_no: serialNo }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    setEquipment(prev => prev.map(e =>
      e.id === equipmentId ? { ...e, serials: [...(e.serials||[]), data], has_serial: true } : e
    ))
  }

  async function handleDeleteSerial(equipmentId, serialId) {
    if (!confirm('Xóa serial này?')) return
    await fetch(`${API}/serials/${serialId}`, { method: 'DELETE' })
    setEquipment(prev => prev.map(e =>
      e.id === equipmentId ? { ...e, serials: e.serials.filter(s => s.id !== serialId) } : e
    ))
  }

  // Excel template download
  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Tên thiết bị', 'Hãng', 'Model', 'Serial', 'Số lượng', 'Vị trí lắp đặt', 'BH từ (YYYY-MM-DD)', 'BH đến (YYYY-MM-DD)'],
      ['Rectifier', 'Megmeet', 'R483000G1', 'MM001', '1', 'BTS Hà Đông', '2025-01-01', '2026-12-31'],
      ['Rectifier', 'Megmeet', 'R483000G1', 'MM002', '1', 'BTS Hà Đông', '2025-01-01', '2026-12-31'],
      ['Pin Lithium', 'EVE', 'LF100', 'EVE123', '1', 'BTS Hà Đông', '2025-01-01', '2026-12-31'],
      ['Cáp DC 16mm²', 'Cadivi', 'CV-16', '', '500', 'BTS Hà Đông', '2025-01-01', '2026-12-31'],
    ])
    ws['!cols'] = [20,14,16,12,8,18,18,18].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Thiết bị')
    XLSX.writeFile(wb, 'mau_thiet_bi_bh.xlsx')
  }

  // Parse Excel file
  function handleImportFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const wb   = XLSX.read(new Uint8Array(ev.target.result), { type: 'array', cellDates: true })
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      // Group by (name, brand, model, location, warranty_from, warranty_to)
      const grouped = new Map()
      for (const row of rows) {
        const name  = String(row['Tên thiết bị'] || '').trim()
        const brand = String(row['Hãng'] || '').trim()
        const model = String(row['Model'] || '').trim()
        const loc   = String(row['Vị trí lắp đặt'] || '').trim()
        const wFrom = toISODate(row['BH từ (YYYY-MM-DD)'])
        const wTo   = toISODate(row['BH đến (YYYY-MM-DD)'])
        if (!name) continue
        const key   = `${name}||${model}||${loc}`
        if (!grouped.has(key)) {
          grouped.set(key, { name, brand, model, quantity: parseFloat(row['Số lượng'])||1,
            location: loc, warranty_from: wFrom, warranty_to: wTo, serials: [] })
        }
        const sn = String(row['Serial'] || '').trim()
        if (sn) sn.split(';').map(s => s.trim()).filter(Boolean).forEach(s => grouped.get(key).serials.push(s))
      }
      setImportPreview([...grouped.values()])
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  async function confirmImport() {
    if (!importPreview?.length) return
    setImporting(true)
    try {
      const res = await fetch(`${API}/contracts/${contractId}/equipment/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importPreview),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      alert(`Import thành công ${data.imported} thiết bị!`)
      setImportPreview(null)
      await reload()
    } catch (e) { alert('Lỗi: ' + e.message) }
    finally { setImporting(false) }
  }

  return (
    <>
      {/* Summary */}
      <div className="wty-summary">
        <div className="wty-card wty-card--blue">
          <div className="wty-card-label">Tổng thiết bị</div>
          <div className="wty-card-value">{equipment.length}</div>
          <div className="wty-card-sub">loại thiết bị</div>
        </div>
        <div className="wty-card wty-card--green">
          <div className="wty-card-label">Tổng Serial</div>
          <div className="wty-card-value">{totalSerials}</div>
          <div className="wty-card-sub">đã quản lý</div>
        </div>
        <div className="wty-card wty-card--orange">
          <div className="wty-card-label">Sắp hết BH</div>
          <div className="wty-card-value">{expiring}</div>
          <div className="wty-card-sub">≤ 30 ngày</div>
        </div>
        <div className="wty-card wty-card--red">
          <div className="wty-card-label">Hết bảo hành</div>
          <div className="wty-card-value">{expired}</div>
          <div className="wty-card-sub">thiết bị</div>
        </div>
      </div>

      {/* Import preview */}
      {importPreview && (
        <div className="wty-section">
          <div className="wty-section-header">
            <span className="wty-section-title">Xem trước dữ liệu import ({importPreview.length} thiết bị)</span>
            <div style={{ display:'flex', gap:8 }}>
              <button className="wty-btn wty-btn-secondary" onClick={() => setImportPreview(null)}>Hủy</button>
              <button className="wty-btn wty-btn-primary" onClick={confirmImport} disabled={importing}>
                {importing ? 'Đang import...' : 'Xác nhận import'}
              </button>
            </div>
          </div>
          <div className="import-preview">
            <table>
              <thead>
                <tr><th>Tên</th><th>Hãng</th><th>Model</th><th>SL</th><th>Serial</th><th>Vị trí</th><th>BH từ</th><th>BH đến</th></tr>
              </thead>
              <tbody>
                {importPreview.map((item, i) => (
                  <tr key={i}>
                    <td>{item.name}</td>
                    <td>{item.brand}</td>
                    <td>{item.model}</td>
                    <td>{item.serials.length || item.quantity}</td>
                    <td>{item.serials.length > 0 ? item.serials.join(', ') : '—'}</td>
                    <td>{item.location}</td>
                    <td>{item.warranty_from}</td>
                    <td>{item.warranty_to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="wty-toolbar">
        <input className="wty-search" placeholder="🔍 Tìm tên, hãng, model, vị trí..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <div className="wty-toolbar-right">
          <button className="wty-btn wty-btn-secondary" onClick={downloadTemplate}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            Tải mẫu Excel
          </button>
          <label className="wty-btn wty-btn-blue" style={{ cursor:'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>
            Import Excel
            <input type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={handleImportFile} />
          </label>
          <button className="wty-btn wty-btn-primary" onClick={() => { setEditItem(null); setModal(true) }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Thêm thiết bị
          </button>
        </div>
      </div>

      {/* Thanh chọn hàng loạt */}
      {selected.size > 0 && (
        <div className="wty-bulk-bar">
          <span>Đã chọn <strong>{selected.size}</strong> thiết bị</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="wty-btn wty-btn-primary" onClick={() => setShowBulk(true)}>Sửa bảo hành hàng loạt</button>
            <button className="wty-btn wty-btn-secondary" onClick={() => setSelected(new Set())}>Bỏ chọn</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="wty-section">
        <div className="wty-table-wrap">
          <table className="wty-table">
            <thead>
              <tr>
                <th style={{ width:32 }}><input type="checkbox" checked={allChecked} onChange={toggleAll} title="Chọn tất cả (theo bộ lọc)" /></th>
                <th style={{ width:36 }}>#</th>
                <th>Tên thiết bị</th>
                <th>Hãng / Model</th>
                <th style={{ width:80 }}>SL</th>
                <th>Serial</th>
                <th>Vị trí lắp đặt</th>
                <th style={{ width:120 }}>BH từ</th>
                <th style={{ width:120 }}>BH đến</th>
                <th style={{ width:120 }}>Tình trạng BH</th>
                <th style={{ width:80 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="11" className="wty-empty">
                  Chưa có thiết bị nào. Nhấn <strong>Thêm thiết bị</strong> hoặc <strong>Import Excel</strong>.
                </td></tr>
              ) : filtered.map((eq, idx) => {
                const ws   = warrantyStatus(eq.warranty_to)
                const isEx = expanded.has(eq.id)
                return [
                  <tr key={eq.id} className={isEx ? 'row-expanded' : ''}>
                    <td style={{ textAlign:'center' }}>
                      <input type="checkbox" checked={selected.has(eq.id)} onChange={() => toggleOne(eq.id)} />
                    </td>
                    <td style={{ textAlign:'center', color:'#9ca3af', fontSize:12 }}>{idx+1}</td>
                    <td><strong>{eq.name}</strong>{eq.note && <div style={{ fontSize:11, color:'#9ca3af' }}>{eq.note}</div>}</td>
                    <td><div style={{ fontSize:13 }}>{eq.brand||'—'}</div><div style={{ fontSize:11, color:'#6b7280' }}>{eq.model||'—'}</div></td>
                    <td>{eq.quantity}</td>
                    <td>
                      {eq.has_serial && eq.serials?.length > 0 ? (
                        <button className="serial-count-btn" onClick={() => toggleExpand(eq.id)}>
                          {eq.serials.length} serial {isEx ? '▲' : '▼'}
                        </button>
                      ) : eq.has_serial ? (
                        <button className="serial-count-btn" onClick={() => toggleExpand(eq.id)}>+ Thêm serial</button>
                      ) : (
                        <span style={{ fontSize:12, color:'#d1d5db' }}>Không có serial</span>
                      )}
                    </td>
                    <td>{eq.location||'—'}</td>
                    <td>{fmtDate(eq.warranty_from)}</td>
                    <td>{fmtDate(eq.warranty_to)}</td>
                    <td><span className={`wty-badge ${ws.cls}`}>{ws.label}</span></td>
                    <td>
                      <div className="wty-actions">
                        <button className="wty-act expand" onClick={() => toggleExpand(eq.id)} title="Quản lý serial">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>
                        </button>
                        <button className="wty-act edit" onClick={() => { setEditItem(eq); setModal(true) }} title="Sửa">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.46a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                        </button>
                        <button className="wty-act delete" onClick={() => handleDelete(eq)} title="Xóa">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>,
                  isEx && (
                    <tr key={`${eq.id}_expand`} className="wty-expand-row">
                      <td colSpan="11">
                        <SerialInlineManager
                          equipment={eq}
                          onAddSerial={sn => handleAddSerial(eq.id, sn)}
                          onDeleteSerial={sId => handleDeleteSerial(eq.id, sId)}
                        />
                      </td>
                    </tr>
                  )
                ]
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <EquipmentModal
          item={editItem}
          onSave={handleSave}
          onClose={() => setModal(false)}
        />
      )}
      {showBulk && (
        <WarrantyBulkDateModal count={selected.size} onClose={() => setShowBulk(false)} onApply={applyBulk} />
      )}
    </>
  )
}

// ── Inline serial manager ─────────────────────────────────────────────────────

function SerialInlineManager({ equipment, onAddSerial, onDeleteSerial }) {
  const [newSN, setNewSN] = useState('')

  function submit() {
    if (!newSN.trim()) return
    onAddSerial(newSN.trim())
    setNewSN('')
  }

  return (
    <div className="wty-expand-inner">
      <div className="wty-serial-list">
        {equipment.serials?.map(s => (
          <div key={s.id} className="wty-serial-row">
            <span className="sn">{s.serial_no}</span>
            <span className="ss">{s.status}</span>
            <button className="wty-act delete" style={{ width:24, height:24 }}
              onClick={() => onDeleteSerial(s.id)} title="Xóa serial">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
          </div>
        ))}
        <div className="wty-serial-add-row">
          <input placeholder="Nhập số serial mới..." value={newSN}
            onChange={e => setNewSN(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()} />
          <button className="wty-btn wty-btn-primary" style={{ padding:'5px 12px', fontSize:12 }} onClick={submit}>
            + Thêm
          </button>
        </div>
      </div>
    </div>
  )
}
