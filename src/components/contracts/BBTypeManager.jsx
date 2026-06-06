import { useState } from 'react'
import { API } from '../../config/api'

// ── Quản lý loại Biên bản (master toàn cục) ───────────────────────────────────

export default function BBTypeManager({ types, onClose, onUpdated }) {
  const [list, setList]       = useState(types)
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [adding, setAdding]   = useState(false)
  const [editId, setEditId]   = useState(null)
  const [editCode, setEditCode] = useState('')
  const [editName, setEditName] = useState('')

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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: newCode, name: newName }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error); return }
      setNewCode(''); setNewName('')
      await refresh()
    } catch { alert('Lỗi khi thêm loại BB') } finally { setAdding(false) }
  }

  const startEdit = (t) => { setEditId(t.id); setEditCode(t.code); setEditName(t.name) }

  const handleEdit = async (id) => {
    try {
      const res = await fetch(`${API}/bb-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: editCode, name: editName }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error); return }
      setEditId(null)
      await refresh()
    } catch { alert('Lỗi khi cập nhật') }
  }

  const handleDelete = async (id) => {
    if (!confirm('Xóa loại BB này?')) return
    try {
      const res = await fetch(`${API}/bb-types/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { alert(data.error); return }
      await refresh()
    } catch { alert('Lỗi khi xóa') }
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
                <th style={{width:90}}>Mã</th>
                <th>Tên đầy đủ</th>
                <th style={{width:80}}></th>
              </tr>
            </thead>
            <tbody>
              {list.map(t => (
                <tr key={t.id}>
                  <td>
                    {editId === t.id
                      ? <input className="bbmgr-input" value={editCode} onChange={e => setEditCode(e.target.value)} />
                      : <strong>{t.code}</strong>}
                  </td>
                  <td>
                    {editId === t.id
                      ? <input className="bbmgr-input bbmgr-input-wide" value={editName} onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleEdit(t.id)} />
                      : t.name}
                  </td>
                  <td>
                    {editId === t.id ? (
                      <div className="bbmgr-actions">
                        <button className="bbmgr-btn bbmgr-btn-save" onClick={() => handleEdit(t.id)}>✓</button>
                        <button className="bbmgr-btn" onClick={() => setEditId(null)}>✕</button>
                      </div>
                    ) : (
                      <div className="bbmgr-actions">
                        <button className="bbmgr-btn" title="Sửa" onClick={() => startEdit(t)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                        </button>
                        <button className="bbmgr-btn bbmgr-btn-del" title="Xóa" onClick={() => handleDelete(t.id)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}

              {/* Add row */}
              <tr className="bbmgr-add-row">
                <td>
                  <input className="bbmgr-input" value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())}
                    placeholder="VD: FAT" maxLength={20} />
                </td>
                <td>
                  <input className="bbmgr-input bbmgr-input-wide" value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="Tên đầy đủ của loại biên bản..."
                    onKeyDown={e => e.key === 'Enter' && handleAdd()} />
                </td>
                <td>
                  <button className="bbmgr-btn bbmgr-btn-save" onClick={handleAdd} disabled={adding}>
                    {adding ? '...' : '+ Thêm'}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
