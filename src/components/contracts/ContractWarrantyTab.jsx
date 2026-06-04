import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import './ContractWarrantyTab.css'

import { API } from '../../config/api'

const CASE_STATUSES = ['Tiếp nhận', 'Đang xử lý', 'Chờ phụ kiện', 'Hoàn thành', 'Đóng']
const PRIORITIES    = ['Thấp', 'Bình thường', 'Cao', 'Khẩn']
const ACTIVITY_TYPES= ['Tiếp nhận', 'Kiểm tra hiện trường', 'Khắc phục', 'Thay thế thiết bị', 'Cập nhật tình trạng', 'Hoàn thành', 'Khác']
const SERIAL_STATUSES = ['Đang hoạt động', 'Lỗi', 'Đã thay thế', 'Ngừng sử dụng']

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'

function toISODate(val) {
  if (!val && val !== 0) return null
  if (val instanceof Date) {
    return `${val.getFullYear()}-${String(val.getMonth()+1).padStart(2,'0')}-${String(val.getDate()).padStart(2,'0')}`
  }
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  if (!isNaN(n) && n > 1) {
    // Excel serial → UTC date (Excel epoch = Dec 30, 1899; Unix epoch offset = 25569 days)
    const d = new Date(Math.round((n - 25569) * 864e5))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
  }
  return String(val).trim() || null
}
const fmtDT   = (d) => d ? new Date(d).toLocaleString('vi-VN') : '—'

function warrantyStatus(to) {
  if (!to) return { label: 'Không xác định', cls: 'wty-badge--none' }
  const days = Math.ceil((new Date(to) - new Date(new Date().toDateString())) / 86400000)
  if (days < 0)  return { label: 'Hết bảo hành', cls: 'wty-badge--expired' }
  if (days <= 30) return { label: `Còn ${days} ngày`, cls: 'wty-badge--expiring' }
  return { label: 'Còn bảo hành', cls: 'wty-badge--active' }
}

function caseStatusCls(s) {
  return s === 'Tiếp nhận' ? 'cs--receive' : s === 'Đang xử lý' ? 'cs--progress' :
    s === 'Chờ phụ kiện' ? 'cs--waiting' : s === 'Hoàn thành' ? 'cs--done' : 'cs--closed'
}
function caseStatusModalCls(s) {
  return s === 'Tiếp nhận' ? 'sel-receive' : s === 'Đang xử lý' ? 'sel-progress' :
    s === 'Chờ phụ kiện' ? 'sel-waiting' : s === 'Hoàn thành' ? 'sel-done' : 'sel-closed'
}
function priorityCls(p) {
  return p === 'Thấp' ? 'priority--low' : p === 'Bình thường' ? 'priority--normal' :
    p === 'Cao' ? 'priority--high' : 'priority--urgent'
}
function activityIcon(type) {
  return type === 'Tiếp nhận' ? '📥' : type === 'Kiểm tra hiện trường' ? '🔍' :
    type === 'Khắc phục' ? '🔧' : type === 'Thay thế thiết bị' ? '🔄' :
    type === 'Hoàn thành' ? '✅' : '📝'
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ContractWarrantyTab({ contractId }) {
  const [subTab, setSubTab]       = useState('equipment')
  const [equipment, setEquipment] = useState([])
  const [cases, setCases]         = useState([])
  const [allActivities, setAllAct]= useState([])
  const [loading, setLoading]     = useState(true)

  const loadEquipment = useCallback(async () => {
    const res = await fetch(`${API}/contracts/${contractId}/equipment`)
    const d   = await res.json()
    setEquipment(Array.isArray(d) ? d : [])
  }, [contractId])

  const loadCases = useCallback(async () => {
    const res = await fetch(`${API}/contracts/${contractId}/warranty-cases`)
    const d   = await res.json()
    setCases(Array.isArray(d) ? d : [])
  }, [contractId])

  const loadAllActivities = useCallback(async () => {
    const res = await fetch(`${API}/contracts/${contractId}/warranty-activities`)
    const d   = await res.json()
    setAllAct(Array.isArray(d) ? d : [])
  }, [contractId])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadEquipment(), loadCases(), loadAllActivities()])
      .finally(() => setLoading(false))
  }, [loadEquipment, loadCases, loadAllActivities])

  const SUBTABS = [
    { key: 'equipment', label: 'Thiết bị bàn giao' },
    { key: 'serials',   label: 'Quản lý Serial' },
    { key: 'cases',     label: `Case bảo hành${cases.filter(c=>c.status!=='Đóng'&&c.status!=='Hoàn thành').length>0 ? ` (${cases.filter(c=>c.status!=='Đóng'&&c.status!=='Hoàn thành').length})` : ''}` },
    { key: 'activities',label: 'Nhật ký xử lý' },
  ]

  if (loading) return <div className="wty-loading">Đang tải dữ liệu bảo hành...</div>

  return (
    <div className="wty-tab">
      <div className="wty-subtab-bar">
        {SUBTABS.map(t => (
          <button key={t.key} className={`wty-subtab-btn ${subTab===t.key?'active':''}`} onClick={()=>setSubTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="wty-body">
        {subTab === 'equipment' && (
          <EquipmentSubTab
            contractId={contractId}
            equipment={equipment}
            setEquipment={setEquipment}
            reload={loadEquipment}
          />
        )}
        {subTab === 'serials' && (
          <SerialSubTab equipment={equipment} reload={loadEquipment} />
        )}
        {subTab === 'cases' && (
          <CasesSubTab
            contractId={contractId}
            cases={cases}
            setCases={setCases}
            equipment={equipment}
            reload={() => { loadCases(); loadAllActivities() }}
          />
        )}
        {subTab === 'activities' && (
          <ActivitiesSubTab activities={allActivities} cases={cases} />
        )}
      </div>
    </div>
  )
}

// ── Equipment Sub-tab ─────────────────────────────────────────────────────────

function EquipmentSubTab({ contractId, equipment, setEquipment, reload }) {
  const [search, setSearch]     = useState('')
  const [expanded, setExpanded] = useState(new Set())
  const [modalOpen, setModal]   = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [importing, setImporting] = useState(false)

  const filtered = equipment.filter(e => {
    const t = search.toLowerCase()
    return !t || e.name?.toLowerCase().includes(t) || e.brand?.toLowerCase().includes(t) ||
      e.model?.toLowerCase().includes(t) || e.location?.toLowerCase().includes(t)
  })

  // Summary
  const expired  = equipment.filter(e => e.warranty_to && new Date(e.warranty_to) < new Date()).length
  const expiring = equipment.filter(e => {
    if (!e.warranty_to) return false
    const d = Math.ceil((new Date(e.warranty_to) - new Date()) / 86400000)
    return d >= 0 && d <= 30
  }).length
  const totalSerials = equipment.reduce((s, e) => s + (e.serials?.length || 0), 0)

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

      {/* Table */}
      <div className="wty-section">
        <div className="wty-table-wrap">
          <table className="wty-table">
            <thead>
              <tr>
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
                <tr><td colSpan="10" className="wty-empty">
                  Chưa có thiết bị nào. Nhấn <strong>Thêm thiết bị</strong> hoặc <strong>Import Excel</strong>.
                </td></tr>
              ) : filtered.map((eq, idx) => {
                const ws   = warrantyStatus(eq.warranty_to)
                const isEx = expanded.has(eq.id)
                return [
                  <tr key={eq.id} className={isEx ? 'row-expanded' : ''}>
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
                      <td colSpan="10">
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

// ── Serial Sub-tab ────────────────────────────────────────────────────────────

function SerialSubTab({ equipment, reload }) {
  const withSerials = equipment.filter(e => e.has_serial && e.serials?.length > 0)
  const total = equipment.reduce((s, e) => s + (e.serials?.length || 0), 0)

  return (
    <>
      <div style={{ fontSize: 13, color: '#6b7280' }}>
        Tổng cộng <strong>{total}</strong> serial từ <strong>{withSerials.length}</strong> loại thiết bị.
      </div>
      {withSerials.length === 0 ? (
        <div className="wty-empty">Chưa có serial nào được đăng ký. Vào tab <strong>Thiết bị bàn giao</strong> để thêm.</div>
      ) : withSerials.map(eq => {
        const ws = warrantyStatus(eq.warranty_to)
        return (
          <div key={eq.id} className="serial-group">
            <div className="serial-group-header">
              <span className="serial-group-name">
                {eq.name}
                <span className={`wty-badge ${ws.cls}`} style={{ marginLeft: 10 }}>{ws.label}</span>
              </span>
              <span className="serial-group-model">{eq.brand} {eq.model} — {eq.location||'Chưa có vị trí'}</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>BH: {fmtDate(eq.warranty_from)} → {fmtDate(eq.warranty_to)}</span>
            </div>
            <div style={{ padding: '10px 16px' }}>
              <div className="serial-chips">
                {eq.serials.map(s => (
                  <span key={s.id} className="serial-chip" title={`Trạng thái: ${s.status}`}>
                    {s.serial_no}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}

// ── Cases Sub-tab ─────────────────────────────────────────────────────────────

function CasesSubTab({ contractId, cases, setCases, equipment, reload }) {
  const [modalOpen, setModal]     = useState(false)
  const [editCase, setEditCase]   = useState(null)
  const [detailCase, setDetail]   = useState(null)

  // Summary
  const open     = cases.filter(c => c.status !== 'Đóng' && c.status !== 'Hoàn thành').length
  const done     = cases.filter(c => c.status === 'Hoàn thành').length
  const urgent   = cases.filter(c => c.priority === 'Khẩn' && c.status !== 'Đóng').length

  async function handleSaveCase(form, isEdit) {
    const url = isEdit ? `${API}/warranty-cases/${editCase.id}` : `${API}/contracts/${contractId}/warranty-cases`
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    if (isEdit) setCases(prev => prev.map(c => c.id === editCase.id ? { ...c, ...data } : c))
    else setCases(prev => [data, ...prev])
    setModal(false)
  }

  async function handleDelete(c) {
    if (!confirm(`Xóa case "${c.case_no||c.title}"? Tất cả nhật ký liên quan sẽ bị xóa.`)) return
    await fetch(`${API}/warranty-cases/${c.id}`, { method: 'DELETE' })
    setCases(prev => prev.filter(x => x.id !== c.id))
  }

  // Auto-generate case number
  const nextCaseNo = `BH-${new Date().getFullYear()}-${String(cases.length + 1).padStart(3, '0')}`

  return (
    <>
      <div className="wty-summary">
        <div className="wty-card wty-card--purple">
          <div className="wty-card-label">Tổng case</div>
          <div className="wty-card-value">{cases.length}</div>
          <div className="wty-card-sub">bảo hành</div>
        </div>
        <div className="wty-card wty-card--blue">
          <div className="wty-card-label">Đang mở</div>
          <div className="wty-card-value">{open}</div>
          <div className="wty-card-sub">cần xử lý</div>
        </div>
        <div className="wty-card wty-card--green">
          <div className="wty-card-label">Hoàn thành</div>
          <div className="wty-card-value">{done}</div>
          <div className="wty-card-sub">case</div>
        </div>
        <div className="wty-card wty-card--red">
          <div className="wty-card-label">Khẩn cấp</div>
          <div className="wty-card-value">{urgent}</div>
          <div className="wty-card-sub">cần ưu tiên</div>
        </div>
      </div>

      <div className="wty-toolbar">
        <div />
        <button className="wty-btn wty-btn-primary" onClick={() => { setEditCase(null); setModal(true) }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Tạo case bảo hành
        </button>
      </div>

      <div className="wty-section">
        <div className="wty-table-wrap">
          <table className="wty-table">
            <thead>
              <tr>
                <th style={{ width:100 }}>Mã case</th>
                <th>Nội dung sự cố</th>
                <th style={{ width:90 }}>Ưu tiên</th>
                <th style={{ width:110 }}>Ngày báo</th>
                <th style={{ width:80 }}>TB liên quan</th>
                <th style={{ width:120 }}>Trạng thái</th>
                <th style={{ width:90 }}></th>
              </tr>
            </thead>
            <tbody>
              {cases.length === 0 ? (
                <tr><td colSpan="7" className="wty-empty">Chưa có case bảo hành nào. Nhấn <strong>Tạo case</strong> khi có sự cố.</td></tr>
              ) : cases.map(c => (
                <tr key={c.id}>
                  <td><strong style={{ color:'#2563eb' }}>{c.case_no||'—'}</strong></td>
                  <td>
                    <div style={{ fontWeight:600 }}>{c.title}</div>
                    {c.reported_by && <div style={{ fontSize:11, color:'#6b7280' }}>Báo bởi: {c.reported_by}</div>}
                  </td>
                  <td><span className={`priority-badge ${priorityCls(c.priority)}`}>{c.priority}</span></td>
                  <td>{fmtDate(c.reported_date)}</td>
                  <td style={{ textAlign:'center' }}>
                    <span style={{ fontWeight:600, color: parseInt(c.equipment_count)>0 ? '#1d4ed8' : '#9ca3af' }}>
                      {c.equipment_count}
                    </span>
                  </td>
                  <td><span className={`case-status ${caseStatusCls(c.status)}`}>{c.status}</span></td>
                  <td>
                    <div className="wty-actions">
                      <button className="wty-btn wty-btn-blue" style={{ padding:'4px 10px', fontSize:12 }}
                        onClick={() => setDetail(c)}>
                        Chi tiết
                      </button>
                      <button className="wty-act delete" onClick={() => handleDelete(c)} title="Xóa">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <CaseFormModal
          caseData={editCase}
          defaultCaseNo={nextCaseNo}
          onSave={handleSaveCase}
          onClose={() => setModal(false)}
        />
      )}

      {detailCase && (
        <CaseDetailModal
          caseId={detailCase.id}
          caseData={detailCase}
          equipment={equipment}
          onUpdate={(updated) => { setCases(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c)); reload() }}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  )
}

// ── Case detail modal ─────────────────────────────────────────────────────────

function CaseDetailModal({ caseId, caseData, equipment, onUpdate, onClose }) {
  const [linkedEquip, setLinked] = useState([])
  const [activities, setActs]    = useState([])
  const [form, setForm]          = useState({ ...caseData })
  const [saving, setSaving]      = useState(false)
  const [linkForm, setLinkForm]  = useState({ equipment_id: '', serial_id: '' })
  const [actForm, setActForm]    = useState({ activity_type: 'Tiếp nhận', description: '', performed_by: '', performed_at: new Date().toISOString().slice(0,16) })

  useEffect(() => {
    fetch(`${API}/warranty-cases/${caseId}/equipment`).then(r=>r.json()).then(d => setLinked(Array.isArray(d)?d:[]))
    fetch(`${API}/warranty-cases/${caseId}/activities`).then(r=>r.json()).then(d => setActs(Array.isArray(d)?d:[]))
  }, [caseId])

  const selectedEquip = equipment.find(e => String(e.id) === String(linkForm.equipment_id))

  async function saveInfo() {
    setSaving(true)
    const res = await fetch(`${API}/warranty-cases/${caseId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); setSaving(false); return }
    onUpdate(data)
    setSaving(false)
    alert('Đã lưu thông tin case.')
  }

  async function linkEquip() {
    if (!linkForm.equipment_id) return
    const res = await fetch(`${API}/warranty-cases/${caseId}/equipment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equipment_id: linkForm.equipment_id, serial_id: linkForm.serial_id||null }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    const eq = equipment.find(e => String(e.id) === String(linkForm.equipment_id))
    const sn = eq?.serials?.find(s => String(s.id) === String(linkForm.serial_id))
    setLinked(prev => [...prev, {
      link_id: data.link_id, equipment_id: eq?.id, name: eq?.name,
      brand: eq?.brand, model: eq?.model, serial_id: sn?.id||null, serial_no: sn?.serial_no||null,
    }])
    setLinkForm({ equipment_id: '', serial_id: '' })
  }

  async function unlinkEquip(linkId) {
    if (!confirm('Xóa liên kết thiết bị này?')) return
    await fetch(`${API}/warranty-case-equipment/${linkId}`, { method: 'DELETE' })
    setLinked(prev => prev.filter(l => l.link_id !== linkId))
  }

  async function addActivity() {
    if (!actForm.description.trim()) { alert('Vui lòng nhập mô tả hoạt động'); return }
    const res = await fetch(`${API}/warranty-cases/${caseId}/activities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(actForm),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    setActs(prev => [data, ...prev])
    setActForm({ activity_type: 'Cập nhật tình trạng', description: '', performed_by: actForm.performed_by, performed_at: new Date().toISOString().slice(0,16) })
  }

  async function deleteActivity(id) {
    if (!confirm('Xóa nhật ký này?')) return
    await fetch(`${API}/warranty-activities/${id}`, { method: 'DELETE' })
    setActs(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="wty-modal-overlay" onClick={e => { if(e.target===e.currentTarget) onClose() }}>
      <div className="wty-modal wty-modal--wide">
        <div className="wty-modal-header">
          <div>
            <h3>{form.case_no||'Case'} — {form.title}</h3>
            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              <span className={`case-status ${caseStatusCls(form.status)}`}>{form.status}</span>
              <span className={`priority-badge ${priorityCls(form.priority)}`}>{form.priority}</span>
            </div>
          </div>
          <button className="wty-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="wty-modal-body">
          {/* Section 1: Thông tin case */}
          <div style={{ fontWeight:700, fontSize:13, color:'#374151', marginBottom:8 }}>Thông tin case</div>
          <div className="wty-form-row">
            <div className="wty-form-group">
              <label>Mã case</label>
              <input value={form.case_no||''} onChange={e=>setForm(p=>({...p,case_no:e.target.value}))} />
            </div>
            <div className="wty-form-group">
              <label>Ngày báo</label>
              <input type="date" value={form.reported_date?.slice(0,10)||''} onChange={e=>setForm(p=>({...p,reported_date:e.target.value}))} />
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group full">
              <label>Tiêu đề / Nội dung sự cố</label>
              <input value={form.title||''} onChange={e=>setForm(p=>({...p,title:e.target.value}))} />
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group full">
              <label>Mô tả chi tiết</label>
              <textarea rows={2} value={form.description||''} onChange={e=>setForm(p=>({...p,description:e.target.value}))} />
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group">
              <label>Người báo cáo</label>
              <input value={form.reported_by||''} onChange={e=>setForm(p=>({...p,reported_by:e.target.value}))} />
            </div>
            <div className="wty-form-group">
              <label>Ưu tiên</label>
              <select value={form.priority||'Bình thường'} onChange={e=>setForm(p=>({...p,priority:e.target.value}))}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="wty-form-group full">
            <label>Trạng thái</label>
            <div className="status-pill-group">
              {CASE_STATUSES.map(s => (
                <div key={s} className={`status-pill-opt ${form.status===s ? caseStatusModalCls(s) : ''}`}
                  onClick={() => setForm(p => ({...p, status:s}))}>
                  {s}
                </div>
              ))}
            </div>
          </div>
          {form.status === 'Hoàn thành' && (
            <div className="wty-form-group">
              <label>Ngày hoàn thành</label>
              <input type="date" value={form.resolved_date?.slice(0,10)||''} onChange={e=>setForm(p=>({...p,resolved_date:e.target.value}))} />
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button className="wty-btn wty-btn-primary" onClick={saveInfo} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu thông tin'}
            </button>
          </div>

          {/* Section 2: Thiết bị liên quan */}
          <div style={{ borderTop:'2px solid #f3f4f6', paddingTop:16 }}>
            <div style={{ fontWeight:700, fontSize:13, color:'#374151', marginBottom:10 }}>
              Thiết bị liên quan ({linkedEquip.length})
            </div>
            <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap' }}>
              <select style={{ flex:1, padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:6, fontSize:13 }}
                value={linkForm.equipment_id} onChange={e => setLinkForm({equipment_id:e.target.value, serial_id:''})}>
                <option value="">-- Chọn thiết bị --</option>
                {equipment.map(e => <option key={e.id} value={e.id}>{e.name} {e.model ? `(${e.model})` : ''}</option>)}
              </select>
              {selectedEquip?.serials?.length > 0 && (
                <select style={{ flex:1, padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:6, fontSize:13 }}
                  value={linkForm.serial_id} onChange={e => setLinkForm(p=>({...p,serial_id:e.target.value}))}>
                  <option value="">-- Tất cả serial --</option>
                  {selectedEquip.serials.map(s => <option key={s.id} value={s.id}>{s.serial_no}</option>)}
                </select>
              )}
              <button className="wty-btn wty-btn-primary" onClick={linkEquip} disabled={!linkForm.equipment_id}>
                + Thêm
              </button>
            </div>
            {linkedEquip.length === 0 ? (
              <div style={{ fontSize:12, color:'#9ca3af', padding:'8px 0' }}>Chưa có thiết bị nào được liên kết với case này.</div>
            ) : (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {linkedEquip.map(l => (
                  <div key={l.link_id} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px',
                    background:'#eff6ff', borderRadius:6, border:'1px solid #bfdbfe', fontSize:12 }}>
                    <strong>{l.name}</strong>
                    {l.serial_no && <span className="serial-chip">{l.serial_no}</span>}
                    <button onClick={() => unlinkEquip(l.link_id)}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', fontSize:14, lineHeight:1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Nhật ký xử lý */}
          <div style={{ borderTop:'2px solid #f3f4f6', paddingTop:16 }}>
            <div style={{ fontWeight:700, fontSize:13, color:'#374151', marginBottom:10 }}>
              Nhật ký xử lý ({activities.length})
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'10px', background:'#f9fafb', borderRadius:8, marginBottom:12 }}>
              <div className="wty-form-row">
                <div className="wty-form-group">
                  <label>Loại hoạt động</label>
                  <select value={actForm.activity_type} onChange={e=>setActForm(p=>({...p,activity_type:e.target.value}))}>
                    {ACTIVITY_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="wty-form-group">
                  <label>Người thực hiện</label>
                  <input value={actForm.performed_by} onChange={e=>setActForm(p=>({...p,performed_by:e.target.value}))} placeholder="Tên người thực hiện..." />
                </div>
              </div>
              <div className="wty-form-row">
                <div className="wty-form-group">
                  <label>Thời gian thực hiện</label>
                  <input type="datetime-local" value={actForm.performed_at} onChange={e=>setActForm(p=>({...p,performed_at:e.target.value}))} />
                </div>
              </div>
              <div className="wty-form-group full">
                <label>Mô tả</label>
                <textarea rows={2} value={actForm.description} onChange={e=>setActForm(p=>({...p,description:e.target.value}))} placeholder="Mô tả hoạt động..." />
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end' }}>
                <button className="wty-btn wty-btn-primary" onClick={addActivity}>+ Ghi nhật ký</button>
              </div>
            </div>
            <div className="activity-timeline">
              {activities.length === 0 ? (
                <div style={{ fontSize:12, color:'#9ca3af', padding:'8px 0' }}>Chưa có nhật ký xử lý nào.</div>
              ) : activities.map(a => (
                <div key={a.id} className="activity-item">
                  <div className="activity-dot">{activityIcon(a.activity_type)}</div>
                  <div className="activity-content">
                    <div><span className="activity-type-tag">{a.activity_type||'Cập nhật'}</span>{a.description}</div>
                    <div className="activity-meta">
                      {a.performed_by && <strong>{a.performed_by}</strong>}
                      {a.performed_by && ' — '}
                      {fmtDT(a.performed_at)}
                    </div>
                  </div>
                  <button className="wty-act delete" onClick={() => deleteActivity(a.id)} title="Xóa">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="wty-modal-footer">
          <button className="wty-modal-btn cancel" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  )
}

// ── Activities Sub-tab ────────────────────────────────────────────────────────

function ActivitiesSubTab({ activities, cases }) {
  return (
    <>
      <div style={{ fontSize: 13, color: '#6b7280' }}>
        Tổng cộng <strong>{activities.length}</strong> nhật ký từ <strong>{cases.length}</strong> case bảo hành.
      </div>
      {activities.length === 0 ? (
        <div className="wty-empty">Chưa có nhật ký xử lý nào. Mở một case bảo hành để bắt đầu ghi nhật ký.</div>
      ) : (
        <div className="wty-section">
          <div className="wty-section-header">
            <span className="wty-section-title">Nhật ký xử lý tổng hợp</span>
          </div>
          <div style={{ padding: '8px 18px' }}>
            <div className="activity-timeline">
              {activities.map(a => (
                <div key={a.id} className="activity-item">
                  <div className="activity-dot">{activityIcon(a.activity_type)}</div>
                  <div className="activity-content">
                    <div>
                      <span className="activity-case-ref">{a.case_no||'Case'}</span>
                      <span style={{ margin:'0 6px', color:'#d1d5db' }}>|</span>
                      <span className="activity-type-tag">{a.activity_type||'Cập nhật'}</span>
                      {a.description}
                    </div>
                    <div className="activity-meta" style={{ fontSize:11 }}>
                      <span style={{ color:'#6b7280' }}>{a.case_title}</span>
                      {a.performed_by && <> — <strong>{a.performed_by}</strong></>}
                      {' — '}{fmtDT(a.performed_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Equipment Form Modal ──────────────────────────────────────────────────────

function EquipmentModal({ item, onSave, onClose }) {
  const isEdit = !!item
  const [form, setForm] = useState({
    name: item?.name||'', brand: item?.brand||'', model: item?.model||'',
    quantity: item?.quantity||1, location: item?.location||'',
    warranty_from: item?.warranty_from?.slice(0,10)||'',
    warranty_to: item?.warranty_to?.slice(0,10)||'',
    has_serial: item?.has_serial||false, note: item?.note||'',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  async function handleSubmit() {
    if (!form.name.trim()) { setErr('Tên thiết bị không được để trống'); return }
    setSaving(true)
    await onSave(form, isEdit)
    setSaving(false)
  }

  const s = f => setForm(p=>({...p,...f}))

  return (
    <div className="wty-modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="wty-modal">
        <div className="wty-modal-header">
          <h3>{isEdit ? 'Cập nhật thiết bị' : 'Thêm thiết bị bàn giao'}</h3>
          <button className="wty-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="wty-modal-body">
          <div className="wty-form-row">
            <div className="wty-form-group full">
              <label>Tên thiết bị *</label>
              <input className={err?'err':''} value={form.name} onChange={e=>s({name:e.target.value})} placeholder="VD: Rectifier, UPS, Pin Lithium..." />
              {err && <span className="wty-form-err">{err}</span>}
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group">
              <label>Hãng sản xuất</label>
              <input value={form.brand} onChange={e=>s({brand:e.target.value})} placeholder="VD: Megmeet, ABB..." />
            </div>
            <div className="wty-form-group">
              <label>Model</label>
              <input value={form.model} onChange={e=>s({model:e.target.value})} placeholder="VD: R483000G1..." />
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group">
              <label>Số lượng</label>
              <input type="number" min="0.01" step="0.01" value={form.quantity} onChange={e=>s({quantity:e.target.value})} />
            </div>
            <div className="wty-form-group">
              <label>Vị trí lắp đặt</label>
              <input value={form.location} onChange={e=>s({location:e.target.value})} placeholder="VD: Tầng 3, Rack A..." />
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group">
              <label>Bảo hành từ</label>
              <input type="date" value={form.warranty_from} onChange={e=>s({warranty_from:e.target.value})} />
            </div>
            <div className="wty-form-group">
              <label>Bảo hành đến</label>
              <input type="date" value={form.warranty_to} onChange={e=>s({warranty_to:e.target.value})} />
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group">
              <label>Có serial?</label>
              <select value={form.has_serial?'1':'0'} onChange={e=>s({has_serial:e.target.value==='1'})}>
                <option value="1">Có — quản lý theo serial</option>
                <option value="0">Không — chỉ quản lý số lượng</option>
              </select>
            </div>
            <div className="wty-form-group">
              <label>Ghi chú</label>
              <input value={form.note} onChange={e=>s({note:e.target.value})} placeholder="Ghi chú thêm..." />
            </div>
          </div>
        </div>
        <div className="wty-modal-footer">
          <button className="wty-modal-btn cancel" onClick={onClose}>Hủy</button>
          <button className="wty-modal-btn save" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm thiết bị'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Case Form Modal ───────────────────────────────────────────────────────────

function CaseFormModal({ caseData, defaultCaseNo, onSave, onClose }) {
  const isEdit = !!caseData
  const [form, setForm] = useState({
    case_no: caseData?.case_no||defaultCaseNo,
    title:   caseData?.title||'',
    description: caseData?.description||'',
    reported_by: caseData?.reported_by||'',
    reported_date: caseData?.reported_date?.slice(0,10)||new Date().toISOString().slice(0,10),
    priority: caseData?.priority||'Bình thường',
    status:   caseData?.status||'Tiếp nhận',
    note:     caseData?.note||'',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  async function handleSubmit() {
    if (!form.title.trim()) { setErr('Tiêu đề sự cố không được để trống'); return }
    setSaving(true)
    await onSave(form, isEdit)
    setSaving(false)
  }

  const s = f => setForm(p=>({...p,...f}))

  return (
    <div className="wty-modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="wty-modal">
        <div className="wty-modal-header">
          <h3>{isEdit ? 'Cập nhật case' : 'Tạo case bảo hành mới'}</h3>
          <button className="wty-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="wty-modal-body">
          <div className="wty-form-row">
            <div className="wty-form-group">
              <label>Mã case</label>
              <input value={form.case_no} onChange={e=>s({case_no:e.target.value})} placeholder="VD: BH-2026-001" />
            </div>
            <div className="wty-form-group">
              <label>Ngày báo cáo</label>
              <input type="date" value={form.reported_date} onChange={e=>s({reported_date:e.target.value})} />
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group full">
              <label>Tiêu đề / Nội dung sự cố *</label>
              <input className={err?'err':''} value={form.title}
                onChange={e=>s({title:e.target.value})}
                placeholder="VD: Hệ thống nguồn hoạt động bất thường sau cơn giông..." />
              {err && <span className="wty-form-err">{err}</span>}
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group full">
              <label>Mô tả chi tiết</label>
              <textarea rows={3} value={form.description} onChange={e=>s({description:e.target.value})}
                placeholder="Mô tả chi tiết tình trạng sự cố..." />
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group">
              <label>Người báo cáo</label>
              <input value={form.reported_by} onChange={e=>s({reported_by:e.target.value})} placeholder="Tên người báo cáo..." />
            </div>
            <div className="wty-form-group">
              <label>Mức độ ưu tiên</label>
              <select value={form.priority} onChange={e=>s({priority:e.target.value})}>
                {PRIORITIES.map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="wty-form-group full">
            <label>Trạng thái ban đầu</label>
            <div className="status-pill-group">
              {CASE_STATUSES.map(st => (
                <div key={st} className={`status-pill-opt ${form.status===st?caseStatusModalCls(st):''}`}
                  onClick={() => s({status:st})}>
                  {st}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="wty-modal-footer">
          <button className="wty-modal-btn cancel" onClick={onClose}>Hủy</button>
          <button className="wty-modal-btn save" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo case'}
          </button>
        </div>
      </div>
    </div>
  )
}
