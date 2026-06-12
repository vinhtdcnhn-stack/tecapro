import { useState, useEffect, useCallback, useMemo } from 'react'
import { API } from '../../config/api'
import { SERIAL_STATUSES } from './warrantyUtils'
import ContractInSerialRow from './ContractInSerialRow'
import useCtrlSave from './useCtrlSave'
import useIsMobile from './useIsMobile'
import InSerialMobile from './InSerialMobile'
import { AddComponentModal, ImportSerialModal, ReplaceSerialModal } from './ContractInSerialModals'

// ── Quản lý serial tập trung cho hợp đồng NHẬP ─────────────────────────────────
// Gom mọi serial của mọi đợt nhận vào 1 bảng: tìm kiếm/lọc, sửa inline, gắn linh
// kiện vào máy cha (parent), thay thế, chọn nhiều & xóa hàng loạt, import Excel.

export default function ContractInSerialTab({ contractInId }) {
  const [serials, setSerials] = useState([])
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch]         = useState('')
  const [filterItem, setFilterItem] = useState('')   // lọc theo tên chủng loại
  const [filterStatus, setFStatus]  = useState('')

  const [edits, setEdits]   = useState({})   // { [id]: { field: value } }
  const [saving, setSaving] = useState({})   // { [id]: true }
  const [selected, setSelected] = useState(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const [showAdd, setShowAdd]       = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [replaceFor, setReplaceFor] = useState(null)

  const load = useCallback(async () => {
    try {
      const [sRes, iRes] = await Promise.all([
        fetch(`${API}/contract-ins/${contractInId}/all-serials`),
        fetch(`${API}/contract-ins/${contractInId}/all-items`),
      ])
      const [sData, iData] = await Promise.all([sRes.json(), iRes.json()])
      setSerials(Array.isArray(sData) ? sData : [])
      setItems(Array.isArray(iData) ? iData : [])
      setEdits({})
      setSelected(new Set())
    } catch (e) { console.error('load serials:', e) }
    finally { setLoading(false) }
  }, [contractInId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() là async: setState xảy ra SAU await, không phải cascade đồng bộ
  useEffect(() => { load() }, [load])

  // ── Edit helpers ────────────────────────────────────────────────────────────
  const val   = (row, f) => (edits[row.id] && f in edits[row.id]) ? edits[row.id][f] : (row[f] ?? '')
  const dirty = (id) => !!edits[id]
  const setF  = (id, f, v) => setEdits(prev => ({ ...prev, [id]: { ...prev[id], [f]: v } }))

  async function save(row) {
    setSaving(p => ({ ...p, [row.id]: true }))
    const body = {
      serial_no:        val(row, 'serial_no'),
      status:           val(row, 'status') || 'Đang hoạt động',
      note:             val(row, 'note'),
      parent_serial_id: val(row, 'parent_serial_id') || null,
    }
    try {
      const res  = await fetch(`${API}/delivery-serials/${row.id}`, {
        method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Lỗi lưu'); return }
      setSerials(prev => prev.map(s => s.id === row.id ? { ...s, ...data } : s))
      setEdits(prev => { const n = { ...prev }; delete n[row.id]; return n })
    } catch (e) { alert('Lỗi: ' + e.message) }
    finally { setSaving(p => { const n = { ...p }; delete n[row.id]; return n }) }
  }

  async function del(row) {
    if (!confirm(`Xóa serial "${row.serial_no}"?`)) return
    await fetch(`${API}/delivery-serials/${row.id}`, { method:'DELETE' })
    setSerials(prev => prev.filter(s => s.id !== row.id))
    setSelected(prev => { const n = new Set(prev); n.delete(row.id); return n })
  }

  // Ctrl+S: lưu tất cả dòng đang sửa
  useCtrlSave(() => Object.keys(edits).forEach(id => {
    if (saving[id]) return
    const row = serials.find(s => String(s.id) === String(id))
    if (row) save(row)
  }))

  // ── Filtering ─────────────────────────────────────────────────────────────────
  const itemNames = useMemo(
    () => [...new Set(serials.map(s => s.item_name).filter(Boolean))].sort(),
    [serials]
  )

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return serials.filter(s => {
      if (filterItem && s.item_name !== filterItem) return false
      if (filterStatus && (s.status || 'Đang hoạt động') !== filterStatus) return false
      if (!kw) return true
      return [s.serial_no, s.item_name, s.batch_name].some(v => v?.toLowerCase().includes(kw))
    })
  }, [serials, search, filterItem, filterStatus])

  const isFiltering = search.trim() !== '' || filterItem !== '' || filterStatus !== ''

  const parentOptions = useMemo(
    () => serials.map(s => ({ id: s.id, label: `${s.item_name} – ${s.serial_no}` })),
    [serials]
  )

  // ── Selection ─────────────────────────────────────────────────────────────────
  const toggle = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const visibleIds = filtered.map(s => s.id)
  const allSel = visibleIds.length > 0 && visibleIds.every(id => selected.has(id))
  const toggleAll = () => setSelected(prev => {
    if (allSel) { const n = new Set(prev); visibleIds.forEach(id => n.delete(id)); return n }
    return new Set([...prev, ...visibleIds])
  })

  async function bulkDelete() {
    const ids = [...selected]
    if (!ids.length) return
    if (!confirm(`Xóa ${ids.length} serial đã chọn?`)) return
    setBulkDeleting(true)
    try {
      const res = await fetch(`${API}/delivery-serials/bulk-delete`, {
        method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ ids }),
      })
      if (!res.ok) throw new Error()
      setSerials(prev => prev.filter(s => !selected.has(s.id)))
      setSelected(new Set())
    } catch { alert('Không thể xóa các serial đã chọn.') }
    finally { setBulkDeleting(false) }
  }

  const isMobile = useIsMobile()

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Đang tải...</div>

  const selBox   = { padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:7, fontSize:13, fontFamily:'inherit', background:'#fff', color:'#374151', cursor:'pointer', outline:'none' }
  const th       = { padding:'9px 10px', textAlign:'left', fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'.04em', background:'#f1f5f9', borderBottom:'2px solid #e2e8f0', whiteSpace:'nowrap' }

  return (
    <div style={{ padding:'20px 24px', minWidth:0 }}>
      {/* Toolbar */}
      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', marginBottom:14 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Tìm serial, chủng loại, đợt nhận..."
          style={{ ...selBox, minWidth:260, cursor:'text' }}
        />
        <select style={selBox} value={filterItem} onChange={e => setFilterItem(e.target.value)}>
          <option value="">— Tất cả chủng loại —</option>
          {itemNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select style={selBox} value={filterStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">— Tất cả tình trạng —</option>
          {SERIAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {isFiltering && <span style={{ fontSize:12, color:'#6b7280' }}>Hiển thị {filtered.length}/{serials.length}</span>}

        <div style={{ flex:1 }} />

        {selected.size > 0 && (
          <>
            <span style={{ fontSize:13, fontWeight:600, color:'#b91c1c' }}>Đã chọn {selected.size}</span>
            <button onClick={bulkDelete} disabled={bulkDeleting}
              style={{ padding:'8px 14px', background:'#dc2626', color:'#fff', border:'none', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer' }}>
              {bulkDeleting ? 'Đang xóa…' : `Xóa ${selected.size} dòng`}
            </button>
          </>
        )}
        <button onClick={() => setShowImport(true)}
          style={{ padding:'8px 14px', background:'#e0f2fe', color:'#0369a1', border:'1px solid #bae6fd', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer' }}>
          Import Excel
        </button>
        <button onClick={() => setShowAdd(true)}
          style={{ padding:'8px 14px', background:'#16a34a', color:'#fff', border:'none', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer' }}>
          + Thêm linh kiện
        </button>
      </div>

      {/* Table (desktop) / Cards (mobile) */}
      {isMobile ? (
        <InSerialMobile
          rows={filtered} val={val} setF={setF} save={save} saving={saving} del={del}
          onReplace={setReplaceFor} statuses={SERIAL_STATUSES} parentOptions={parentOptions}
        />
      ) : (
      <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width:36, textAlign:'center' }}>
                <input type="checkbox" checked={allSel} onChange={toggleAll} disabled={visibleIds.length === 0} style={{ cursor:'pointer', accentColor:'#2563eb' }} />
              </th>
              <th style={{ ...th, width:40, textAlign:'center' }}>#</th>
              <th style={th}>Chủng loại hàng</th>
              <th style={{ ...th, width:200 }}>Serial</th>
              <th style={{ ...th, width:150 }}>Đợt nhận</th>
              <th style={{ ...th, width:150 }}>Tình trạng</th>
              <th style={{ ...th, width:200 }}>Thuộc máy</th>
              <th style={th}>Ghi chú</th>
              <th style={{ ...th, width:130, textAlign:'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {serials.length === 0 ? (
              <tr><td colSpan="9" style={{ padding:48, textAlign:'center', color:'#9ca3af' }}>
                Chưa có serial nào. Thêm serial trong tab <strong>Nhận hàng</strong> hoặc nhấn <strong>+ Thêm linh kiện</strong>.
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="9" style={{ padding:32, textAlign:'center', color:'#9ca3af' }}>Không có serial khớp bộ lọc.</td></tr>
            ) : filtered.map((row, i) => (
              <ContractInSerialRow
                key={row.id}
                row={row} idx={i}
                selected={selected.has(row.id)}
                onToggleSelect={toggle}
                val={val} dirty={dirty} setF={setF}
                onSave={save} saving={!!saving[row.id]}
                parentOptions={parentOptions}
                onReplace={setReplaceFor}
                onDelete={del}
              />
            ))}
          </tbody>
        </table>
      </div>
      )}

      {showAdd && (
        <AddComponentModal items={items} parentOptions={parentOptions}
          onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load() }} />
      )}
      {showImport && (
        <ImportSerialModal items={items}
          onClose={() => setShowImport(false)} onSaved={() => { setShowImport(false); load() }} />
      )}
      {replaceFor && (
        <ReplaceSerialModal serial={replaceFor}
          onClose={() => setReplaceFor(null)} onSaved={() => { setReplaceFor(null); load() }} />
      )}
    </div>
  )
}
