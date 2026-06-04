import { useState, useEffect, useCallback } from 'react'
import './ContractProgressTab.css'

import { API } from '../../config/api'

function dateDiff(planned, actual) {
  if (!planned || !actual) return null
  return Math.round((new Date(actual) - new Date(planned)) / 86400000)
}

function getStatusInfo(planned, actual) {
  if (!actual) {
    if (!planned) return { type: 'unknown', label: '—' }
    const daysLeft = dateDiff(new Date().toISOString().slice(0,10), planned)
    if (daysLeft < 0) return { type: 'overdue', label: `Quá hạn ${Math.abs(daysLeft)} ngày` }
    return { type: 'pending', label: 'Chưa hoàn thành' }
  }
  const diff = dateDiff(planned, actual)
  if (diff === null) return { type: 'done', label: 'Hoàn thành' }
  if (diff <= 0)     return { type: 'ok',   label: 'Đúng hạn' }
  return              { type: 'late', label: `Trễ ${diff} ngày` }
}

let _ctr = 0
const tmpId = () => `tmp_${++_ctr}`

export default function ContractInProgressTab({ contractInId }) {
  const [rows, setRows]           = useState([])
  const [bbTypes, setBBTypes]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [showBBMgr, setShowBBMgr] = useState(false)

  const load = useCallback(async () => {
    try {
      const [pRes, tRes] = await Promise.all([
        fetch(`${API}/contract-ins/${contractInId}/progress`),
        fetch(`${API}/bb-types`),
      ])
      const [pData, tData] = await Promise.all([pRes.json(), tRes.json()])
      setRows((Array.isArray(pData) ? pData : []).map(r => toLocal(r)))
      setBBTypes(Array.isArray(tData) ? tData : [])
    } catch (e) { console.error('load progress in:', e) }
    finally { setLoading(false) }
  }, [contractInId])

  useEffect(() => { load() }, [load])

  const toLocal = (r) => ({ ...r, _key: String(r.id), _dirty: false, _isNew: false, _saving: false })
  const emptyRow = () => ({
    id: null, _key: tmpId(), _dirty: true, _isNew: true, _saving: false,
    bb_type_id: '', planned_date: '', actual_date: '', reason: '', penalty_note: '', bb_code: '', bb_name: '',
  })
  const set = (key, field, value) =>
    setRows(prev => prev.map(r => r._key === key ? { ...r, [field]: value, _dirty: true } : r))

  const saveRow = async (row) => {
    setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: true } : r))
    const body = {
      bb_type_id:   row.bb_type_id || null,
      planned_date: row.planned_date || null,
      actual_date:  row.actual_date  || null,
      reason:       row.reason,
      penalty_note: row.penalty_note,
    }
    try {
      const url    = row._isNew ? `${API}/contract-ins/${contractInId}/progress` : `${API}/progress-in/${row.id}`
      const method = row._isNew ? 'POST' : 'PUT'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const saved  = await res.json()
      if (!res.ok) throw new Error(saved.error || 'Save failed')
      setRows(prev => prev.map(r => r._key === row._key ? { ...toLocal(saved), _key: row._key } : r))
    } catch (e) {
      alert('Lỗi: ' + e.message)
      setRows(prev => prev.map(r => r._key === row._key ? { ...r, _saving: false } : r))
    }
  }

  const deleteRow = async (row) => {
    if (row._isNew) { setRows(prev => prev.filter(r => r._key !== row._key)); return }
    const label = bbTypes.find(t => String(t.id) === String(row.bb_type_id))?.code || 'biên bản này'
    if (!confirm(`Xóa "${label}"?`)) return
    try {
      await fetch(`${API}/progress-in/${row.id}`, { method: 'DELETE' })
      setRows(prev => prev.filter(r => r._key !== row._key))
    } catch { alert('Không thể xóa.') }
  }

  const savedRows = rows.filter(r => !r._isNew)
  const doneCount = savedRows.filter(r => r.actual_date).length
  const lateCount = savedRows.filter(r => ['late','overdue'].includes(getStatusInfo(r.planned_date, r.actual_date).type)).length

  if (loading) return <div className="prog-loading">Đang tải...</div>

  return (
    <div className="prog-tab">
      {/* Toolbar */}
      <div className="prog-toolbar">
        <div className="prog-toolbar-left">
          <button className="prog-btn prog-btn-primary" onClick={() => setRows(p => [...p, emptyRow()])}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Thêm biên bản
          </button>
          <button className="prog-btn" onClick={() => setShowBBMgr(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
            Quản lý loại BB
          </button>
        </div>
        <div className="prog-stats">
          <span className="stat-chip stat-total">{savedRows.length} biên bản</span>
          <span className="stat-chip stat-done">{doneCount} hoàn thành</span>
          {lateCount > 0 && <span className="stat-chip stat-late">{lateCount} trễ hạn</span>}
        </div>
      </div>

      {/* Table */}
      <div className="prog-table-wrapper">
        <table className="prog-table">
          <thead>
            <tr>
              <th className="th-stt">#</th>
              <th className="th-type">Loại biên bản</th>
              <th className="th-date">Ngày theo HĐ</th>
              <th className="th-date">Ngày thực tế</th>
              <th className="th-status">Trạng thái</th>
              <th className="th-reason">Nguyên nhân chậm trễ</th>
              <th className="th-penalty">Biên bản phạt</th>
              <th className="th-action"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan="8" className="prog-empty">
                Chưa có biên bản nào. Nhấn <strong>Thêm biên bản</strong> để bắt đầu.
              </td></tr>
            ) : rows.map((row, idx) => {
              const status = getStatusInfo(row.planned_date, row.actual_date)
              const isLate = status.type === 'late' || status.type === 'overdue'
              return (
                <tr key={row._key} className={[
                  `status-${status.type}`,
                  row._dirty  ? 'row-dirty'  : '',
                  row._isNew  ? 'row-new'    : '',
                  row._saving ? 'row-saving' : '',
                ].filter(Boolean).join(' ')}>
                  <td className="td-stt">
                    {row._dirty && <span className="dirty-dot" title="Chưa lưu" />}
                    <span>{idx + 1}</span>
                  </td>
                  <td className="td-type">
                    <select value={row.bb_type_id || ''}
                      onChange={e => set(row._key, 'bb_type_id', e.target.value)}>
                      <option value="">— Chọn loại —</option>
                      {bbTypes.map(t => (
                        <option key={t.id} value={t.id}>{t.code} – {t.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="td-date">
                    <input type="date" value={row.planned_date?.slice(0,10) || ''}
                      onChange={e => set(row._key, 'planned_date', e.target.value)} />
                  </td>
                  <td className="td-date">
                    <input type="date" value={row.actual_date?.slice(0,10) || ''}
                      onChange={e => set(row._key, 'actual_date', e.target.value)} />
                  </td>
                  <td className="td-status">
                    <span className={`status-badge badge-${status.type}`}>
                      {status.type === 'ok'      && '✓ '}
                      {status.type === 'late'    && '⚠ '}
                      {status.type === 'overdue' && '⚠ '}
                      {status.type === 'pending' && '⏳ '}
                      {status.label}
                    </span>
                  </td>
                  <td className="td-reason">
                    <input type="text" value={row.reason || ''}
                      placeholder={isLate ? 'Nhập nguyên nhân...' : ''}
                      className={isLate && !row.reason ? 'input-warn' : ''}
                      onChange={e => set(row._key, 'reason', e.target.value)} />
                  </td>
                  <td className="td-penalty">
                    <input type="text" value={row.penalty_note || ''}
                      placeholder="Số/ký hiệu BB phạt..."
                      onChange={e => set(row._key, 'penalty_note', e.target.value)} />
                  </td>
                  <td className="td-action">
                    <div className="action-group">
                      {row._dirty && (
                        <button className="act save" onClick={() => saveRow(row)} disabled={row._saving} title="Lưu">
                          {row._saving
                            ? <span className="spin">⟳</span>
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
                          }
                        </button>
                      )}
                      <button className="act delete" onClick={() => deleteRow(row)} title="Xóa">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* BB Type Manager — reuses shared component */}
      {showBBMgr && (
        <BBTypeManager
          types={bbTypes}
          onClose={() => setShowBBMgr(false)}
          onUpdated={(updated) => setBBTypes(updated)}
        />
      )}
    </div>
  )
}

// ── BB Type Manager (same as ContractProgressTab) ─────────────────────────────

function BBTypeManager({ types, onClose, onUpdated }) {
  const [list, setList]           = useState(types)
  const [newCode, setNewCode]     = useState('')
  const [newName, setNewName]     = useState('')
  const [adding, setAdding]       = useState(false)
  const [editId, setEditId]       = useState(null)
  const [editCode, setEditCode]   = useState('')
  const [editName, setEditName]   = useState('')

  const refresh = async () => {
    const res  = await fetch(`${API}/bb-types`)
    const data = await res.json()
    if (Array.isArray(data)) { setList(data); onUpdated(data) }
  }

  const handleAdd = async () => {
    if (!newCode.trim() || !newName.trim()) return
    setAdding(true)
    try {
      const res = await fetch(`${API}/bb-types`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: newCode, name: newName }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error); return }
      setNewCode(''); setNewName('')
      await refresh()
    } catch { alert('Lỗi') } finally { setAdding(false) }
  }

  const handleEdit = async (id) => {
    const res = await fetch(`${API}/bb-types/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: editCode, name: editName }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    setEditId(null)
    await refresh()
  }

  const handleDelete = async (id) => {
    if (!confirm('Xóa loại BB này?')) return
    const res  = await fetch(`${API}/bb-types/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    await refresh()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bbmgr-modal" onClick={e => e.stopPropagation()}>
        <div className="bbmgr-header">
          <h3>Quản lý loại Biên bản</h3>
          <button className="btn-close-preview" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        <div className="bbmgr-body">
          <table className="bbmgr-table">
            <thead>
              <tr>
                <th style={{ width:90 }}>Mã</th>
                <th>Tên đầy đủ</th>
                <th style={{ width:80 }}></th>
              </tr>
            </thead>
            <tbody>
              {list.map(t => (
                <tr key={t.id}>
                  <td>{editId===t.id ? <input className="bbmgr-input" value={editCode} onChange={e=>setEditCode(e.target.value)} /> : <strong>{t.code}</strong>}</td>
                  <td>{editId===t.id ? <input className="bbmgr-input bbmgr-input-wide" value={editName} onChange={e=>setEditName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleEdit(t.id)} /> : t.name}</td>
                  <td>
                    {editId===t.id ? (
                      <div className="bbmgr-actions">
                        <button className="bbmgr-btn bbmgr-btn-save" onClick={()=>handleEdit(t.id)}>✓</button>
                        <button className="bbmgr-btn" onClick={()=>setEditId(null)}>✕</button>
                      </div>
                    ) : (
                      <div className="bbmgr-actions">
                        <button className="bbmgr-btn" onClick={()=>{setEditId(t.id);setEditCode(t.code);setEditName(t.name)}}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                        </button>
                        <button className="bbmgr-btn bbmgr-btn-del" onClick={()=>handleDelete(t.id)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="bbmgr-add-row">
                <td><input className="bbmgr-input" value={newCode} onChange={e=>setNewCode(e.target.value.toUpperCase())} placeholder="VD: FAT" maxLength={20} /></td>
                <td><input className="bbmgr-input bbmgr-input-wide" value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Tên đầy đủ..." onKeyDown={e=>e.key==='Enter'&&handleAdd()} /></td>
                <td><button className="bbmgr-btn bbmgr-btn-save" onClick={handleAdd} disabled={adding}>{adding?'...':'+ Thêm'}</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
