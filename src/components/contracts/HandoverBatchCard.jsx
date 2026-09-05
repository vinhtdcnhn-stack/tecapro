import { useState } from 'react'

import { API } from '../../config/api'
import { fmtDate, warrantyStatus } from './warrantyUtils'
import { parseEquipmentRows } from './warrantyImportUtils'
import EquipmentModal from './WarrantyEquipmentModal'
import WarrantyBulkDateModal from './WarrantyBulkDateModal'
import SerialComponentsModal from './SerialComponentsModal'
import HandoverSerialExportModal from './HandoverSerialExportModal'
import { buildBatchSerialData } from './handoverSerialExport'
import EditGuard from './EditGuard'
import { auditRowAttrs } from '../common/rowAudit'

// Thiết bị linh-kiện (mọi serial đều có parent_serial_id) không hiện ở tab bàn giao.
const isComponentEquipment = (e) =>
  Array.isArray(e.serials) && e.serials.length > 0 &&
  e.serials.every(s => s.parent_serial_id != null)

// ── Card 1 đợt giao hàng: header + bảng thiết bị của đợt (mở rộng) ───────────────
export default function HandoverBatchCard({
  contractId, delivery, equipment, setEquipment, reload, search, isExpanded, onToggle, onEdit, onDelete,
}) {
  const [modalOpen, setModal]   = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [showBulk, setShowBulk] = useState(false)
  const [showExport, setShowExport] = useState(false)   // modal chọn linh kiện để xuất serial
  const [expanded, setExpanded] = useState(new Set())   // equipment_id đang mở serial

  // Thiết bị CHA của đợt này
  const batchAll = equipment.filter(e => String(e.delivery_id) === String(delivery.id) && !isComponentEquipment(e))
  const t = search.trim().toLowerCase()
  const filtered = batchAll.filter(e => !t ||
    e.name?.toLowerCase().includes(t) || e.brand?.toLowerCase().includes(t) ||
    e.model?.toLowerCase().includes(t) || e.location?.toLowerCase().includes(t))

  // ── Chọn & sửa bảo hành hàng loạt ──
  const filteredIds = filtered.map(e => e.id)
  const allChecked  = filteredIds.length > 0 && filteredIds.every(id => selected.has(id))
  const toggleOne = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSelected(prev => {
    const n = new Set(prev)
    if (allChecked) filteredIds.forEach(id => n.delete(id)); else filteredIds.forEach(id => n.add(id))
    return n
  })
  async function applyBulk(payload) {
    const res = await fetch(`${API}/equipment/bulk-warranty`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selected], ...payload }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    if (data.skipped_linked > 0) {
      alert(`${data.skipped_linked} thiết bị đang lấy bảo hành từ BẢNG GIÁ nên được bỏ qua.\n`
        + 'Muốn đổi hạn bảo hành của chúng thì sửa ở tab Bảng giá (hoặc trong ô sửa từng thiết bị).')
    }
    setShowBulk(false); setSelected(new Set()); await reload()
  }

  function toggleExpand(id) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function handleDelete(e) {
    if (!confirm(`Xóa thiết bị "${e.name}"? Các serial và liên kết bảo hành sẽ bị xóa.`)) return
    await fetch(`${API}/equipment/${e.id}`, { method: 'DELETE' })
    setEquipment(prev => prev.filter(x => x.id !== e.id))
  }

  async function handleBulkDelete() {
    if (!confirm(`Xóa ${selected.size} thiết bị đã chọn? Toàn bộ serial và liên kết bảo hành sẽ bị xóa.`)) return
    await Promise.all([...selected].map(id => fetch(`${API}/equipment/${id}`, { method: 'DELETE' })))
    setSelected(new Set()); await reload()
  }

  async function handleSave(form, isEdit) {
    const url = isEdit ? `${API}/equipment/${editItem.id}` : `${API}/contracts/${contractId}/equipment`
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isEdit ? form : { ...form, delivery_id: delivery.id }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    if (isEdit) setEquipment(prev => prev.map(x => x.id === editItem.id ? data : x))
    else setEquipment(prev => [...prev, data])
    setModal(false)
  }

  // Trả về các serial CHƯA có trong hệ thống nhập (để cảnh báo trước khi lưu).
  async function missingInImport(serialList) {
    try {
      const res = await fetch(`${API}/serials/check-import`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serials: serialList }),
      })
      const data = await res.json()
      return res.ok ? (data.missing || []) : []
    } catch { return [] }
  }

  async function handleAddSerial(equipmentId, serialNo) {
    const missing = await missingInImport([serialNo])
    if (missing.length && !confirm(`Serial "${serialNo}" chưa có trong hệ thống nhập.\nVẫn tiếp tục cập nhật?`)) return
    const res = await fetch(`${API}/equipment/${equipmentId}/serials`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serial_no: serialNo }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    if (data.pulled_components > 0) {
      alert(`Đã tự thêm ${data.pulled_components} linh kiện kèm theo từ phía nhập.`)
      await reload(); return
    }
    setEquipment(prev => prev.map(e =>
      e.id === equipmentId ? { ...e, serials: [...(e.serials || []), data], has_serial: true } : e))
  }

  async function handleDeleteSerial(equipmentId, serialId) {
    if (!confirm('Xóa serial này?')) return
    await fetch(`${API}/serials/${serialId}`, { method: 'DELETE' })
    setEquipment(prev => prev.map(e =>
      e.id === equipmentId ? { ...e, serials: e.serials.filter(s => s.id !== serialId) } : e))
  }

  // ── Excel ──
  async function downloadTemplate() {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([
      ['Tên thiết bị', 'Hãng', 'Model', 'Serial', 'Số lượng', 'Vị trí lắp đặt', 'BH từ (YYYY-MM-DD)', 'BH đến (YYYY-MM-DD)'],
      ['Rectifier', 'Megmeet', 'R483000G1', 'MM001', '2', 'BTS Hà Đông', '2025-01-01', '2026-12-31'],
      ['', '', '', 'MM002', '', '', '', ''],
      ['Pin Lithium', 'EVE', 'LF100', 'EVE123', '1', 'BTS Hà Đông', '2025-01-01', '2026-12-31'],
      ['Cáp DC 16mm²', 'Cadivi', 'CV-16', '', '500', 'BTS Hà Đông', '2025-01-01', '2026-12-31'],
    ])
    ws['!cols'] = [20, 14, 16, 18, 8, 18, 18, 18].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Thiết bị')
    XLSX.writeFile(wb, 'mau_thiet_bi_bh.xlsx')
  }

  function handleImportFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const XLSX = await import('xlsx')
      const wb   = XLSX.read(new Uint8Array(ev.target.result), { type: 'array', cellDates: true })
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      setImportPreview(parseEquipmentRows(rows))
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  const hasBlocking = !!importPreview && (importPreview.dupInFile.length > 0 || importPreview.qtyMismatch.length > 0)

  async function confirmImport() {
    if (!importPreview?.items?.length || hasBlocking) return
    // Cảnh báo các serial chưa có trong hệ thống nhập trước khi cập nhật.
    const allSerials = importPreview.items.flatMap(it => it.serials || [])
    if (allSerials.length) {
      const missing = await missingInImport(allSerials)
      if (missing.length && !confirm(`Có ${missing.length} thiết bị (serial) chưa có trong hệ thống nhập.\nVẫn tiếp tục cập nhật?`)) return
    }
    setImporting(true)
    try {
      const res = await fetch(`${API}/contracts/${contractId}/equipment/import`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery_id: delivery.id, items: importPreview.items }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      alert(`Import thành công ${data.imported} thiết bị!` +
        (data.pulled_components > 0 ? ` Tự thêm ${data.pulled_components} linh kiện kèm theo từ phía nhập.` : ''))
      setImportPreview(null); await reload()
    } catch (e) { alert('Lỗi: ' + e.message) }
    finally { setImporting(false) }
  }

  return (
    <div className="hbatch-card" {...auditRowAttrs('contract_out_delivery', delivery.id)}>
      {/* Header */}
      <div className="hbatch-head" onClick={onToggle}>
        <div className="hbatch-head-main">
          <span className="hbatch-caret">{isExpanded ? '▾' : '▸'}</span>
          <strong>{delivery.batch_name || '(Chưa đặt tên)'}</strong>
          {delivery.delivery_date && <span className="hbatch-date">· Giao {fmtDate(delivery.delivery_date)}</span>}
          <span className="hbatch-count">· {batchAll.length} thiết bị</span>
        </div>
        <div className="wty-actions" onClick={e => e.stopPropagation()} style={{ alignItems: 'center' }}>
          <button className="wty-btn wty-btn-blue hide-on-mobile" onClick={() => setShowExport(true)} title="Xuất serial bàn giao của đợt này ra Excel">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            Export serial bàn giao
          </button>
          <EditGuard>
            <button className="wty-act edit" onClick={onEdit} title="Sửa đợt">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.46a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            </button>
            <button className="wty-act delete" onClick={onDelete} title="Xóa đợt">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
          </EditGuard>
        </div>
      </div>

      {isExpanded && (
        <div className="hbatch-body">
          {/* Toolbar */}
          <div className="wty-toolbar">
            <div />
            <div className="wty-toolbar-right">
              <button className="wty-btn wty-btn-secondary hide-on-mobile" onClick={downloadTemplate}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                Tải mẫu Excel
              </button>
              <EditGuard>
                <label className="wty-btn wty-btn-blue hide-on-mobile" style={{ cursor: 'pointer' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>
                  Import Excel
                  <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportFile} />
                </label>
                <button className="wty-btn wty-btn-primary" onClick={() => { setEditItem(null); setModal(true) }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                  Thêm thiết bị
                </button>
              </EditGuard>
            </div>
          </div>

          {/* Import preview */}
          {importPreview && (
            <div className="wty-section">
              <div className="wty-section-header">
                <span className="wty-section-title">Xem trước import ({importPreview.items.length} thiết bị)</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {hasBlocking && <span style={{ fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>Sửa lỗi bên dưới rồi import lại</span>}
                  <button className="wty-btn wty-btn-secondary" onClick={() => setImportPreview(null)}>Hủy</button>
                  {!hasBlocking && (
                    <EditGuard>
                      <button className="wty-btn wty-btn-primary" onClick={confirmImport} disabled={importing}>
                        {importing ? 'Đang import...' : 'Xác nhận import'}
                      </button>
                    </EditGuard>
                  )}
                </div>
              </div>
              {importPreview.dupInFile.length > 0 && (
                <div className="wty-import-alert wty-import-alert--error">
                  <strong>⛔ Serial bị lặp trong file ({importPreview.dupInFile.length}):</strong> {importPreview.dupInFile.join(', ')}.
                </div>
              )}
              {importPreview.qtyMismatch.length > 0 && (
                <div className="wty-import-alert wty-import-alert--error">
                  <strong>⛔ Số serial không khớp "Số lượng" ({importPreview.qtyMismatch.length}):</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {importPreview.qtyMismatch.map((m, i) => (
                      <li key={i}>{m.name}{m.model ? ` / ${m.model}` : ''}: khai <strong>{m.declared}</strong>, có <strong>{m.actual}</strong></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Bulk bar */}
          {selected.size > 0 && (
            <div className="wty-bulk-bar">
              <span>Đã chọn <strong>{selected.size}</strong> thiết bị</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <EditGuard>
                  <button className="wty-btn wty-btn-primary" onClick={() => setShowBulk(true)}>Sửa bảo hành hàng loạt</button>
                  <button className="wty-btn wty-btn-danger" onClick={handleBulkDelete}>Xóa đã chọn ({selected.size})</button>
                </EditGuard>
                <button className="wty-btn wty-btn-secondary" onClick={() => setSelected(new Set())}>Bỏ chọn</button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="wty-table-wrap">
            <table className="wty-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
                  <th style={{ width: 36 }}>#</th>
                  <th>Tên thiết bị</th>
                  <th>Hãng / Model</th>
                  <th style={{ width: 80 }}>SL</th>
                  <th>Serial</th>
                  <th>Vị trí lắp đặt</th>
                  <th style={{ width: 120 }}>BH từ</th>
                  <th style={{ width: 120 }}>BH đến</th>
                  <th style={{ width: 120 }}>Tình trạng BH</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="11" className="wty-empty">
                    Chưa có thiết bị nào trong đợt này. Nhấn <strong>Thêm thiết bị</strong> hoặc <strong>Import Excel</strong>.
                  </td></tr>
                ) : filtered.map((eq, idx) => {
                  const ws   = warrantyStatus(eq.warranty_to)
                  const isEx = expanded.has(eq.id)
                  return [
                    <tr key={eq.id} {...auditRowAttrs('contract_equipment', eq.id)} className={isEx ? 'row-expanded' : ''}>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={selected.has(eq.id)} onChange={() => toggleOne(eq.id)} />
                      </td>
                      <td style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>{idx + 1}</td>
                      <td>
                        <strong>{eq.name}</strong>
                        {eq.boq_id != null && (
                          <span className="wty-boq-tag" title="Tên và hạn bảo hành lấy từ dòng bảng giá">🔗 bảng giá</span>
                        )}
                        {eq.note && <div style={{ fontSize: 11, color: '#9ca3af' }}>{eq.note}</div>}
                      </td>
                      <td><div style={{ fontSize: 13 }}>{eq.brand || '—'}</div><div style={{ fontSize: 11, color: '#6b7280' }}>{eq.model || '—'}</div></td>
                      <td>{eq.quantity}</td>
                      <td>
                        {eq.has_serial && eq.serials?.length > 0 ? (
                          <button className="serial-count-btn" onClick={() => toggleExpand(eq.id)}>{eq.serials.length} serial {isEx ? '▲' : '▼'}</button>
                        ) : eq.has_serial ? (
                          <button className="serial-count-btn" onClick={() => toggleExpand(eq.id)}>+ Thêm serial</button>
                        ) : (
                          <span style={{ fontSize: 12, color: '#d1d5db' }}>Không có serial</span>
                        )}
                      </td>
                      <td>{eq.location || '—'}</td>
                      <td>{fmtDate(eq.warranty_from)}</td>
                      <td>{fmtDate(eq.warranty_to)}</td>
                      <td><span className={`wty-badge ${ws.cls}`}>{ws.label}</span></td>
                      <td>
                        <div className="wty-actions">
                          <button className="wty-act expand" onClick={() => toggleExpand(eq.id)} title="Quản lý serial">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>
                          </button>
                          <EditGuard>
                            <button className="wty-act edit" onClick={() => { setEditItem(eq); setModal(true) }} title="Sửa">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.46a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                            </button>
                            <button className="wty-act delete" onClick={() => handleDelete(eq)} title="Xóa">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                            </button>
                          </EditGuard>
                        </div>
                      </td>
                    </tr>,
                    isEx && (
                      <tr key={`${eq.id}_expand`} className="wty-expand-row">
                        <td colSpan="11">
                          <SerialInlineManager equipment={eq}
                            onAddSerial={sn => handleAddSerial(eq.id, sn)}
                            onDeleteSerial={sId => handleDeleteSerial(eq.id, sId)} />
                        </td>
                      </tr>
                    )
                  ]
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <EquipmentModal contractId={contractId} item={editItem} onSave={handleSave} onClose={() => setModal(false)} />
      )}
      {showBulk && (
        <WarrantyBulkDateModal contractId={contractId} count={selected.size} onClose={() => setShowBulk(false)} onApply={applyBulk} />
      )}
      {showExport && (
        <HandoverSerialExportModal
          batchName={delivery.batch_name || 'Đợt giao hàng'}
          sheetData={buildBatchSerialData(equipment, delivery.id)}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  )
}

// ── Inline serial manager ─────────────────────────────────────────────────────
// Serial hiển thị gọn dạng chip (như phía nhập). Click số serial → xem linh kiện con
// + trạng thái của máy đó trong SerialComponentsModal.
function SerialInlineManager({ equipment, onAddSerial, onDeleteSerial }) {
  const [newSN, setNewSN] = useState('')
  const [compSerial, setCompSerial] = useState(null)   // serial đang xem linh kiện
  function submit() {
    if (!newSN.trim()) return
    onAddSerial(newSN.trim()); setNewSN('')
  }
  return (
    <div className="wty-expand-inner">
      <EditGuard>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {equipment.serials?.map(s => (
            <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: '#fff', border: '1px solid #86efac', borderRadius: 99, fontSize: 12, fontWeight: 600, color: '#15803d' }}>
              <span
                onClick={() => setCompSerial(s)}
                title="Xem linh kiện của máy này"
                style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 2 }}
              >
                {s.serial_no}
              </span>
              {s.status && s.status !== 'Đang hoạt động' && (
                <span style={{ fontSize: 10, color: '#b45309', background: '#fef3c7', borderRadius: 4, padding: '0 5px' }}>{s.status}</span>
              )}
              <button onClick={() => onDeleteSerial(s.id)} title="Xóa serial" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
            </span>
          ))}
          {(!equipment.serials || equipment.serials.length === 0) && (
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Chưa có serial nào.</span>
          )}
        </div>
        <div className="wty-serial-add-row">
          <input placeholder="Nhập số serial mới..." value={newSN}
            onChange={e => setNewSN(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          <button className="wty-btn wty-btn-primary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={submit}>+ Thêm</button>
        </div>
      </EditGuard>

      {compSerial && (
        <SerialComponentsModal
          serialId={compSerial.id}
          itemName={equipment.name}
          side="out"
          onClose={() => setCompSerial(null)}
        />
      )}
    </div>
  )
}
