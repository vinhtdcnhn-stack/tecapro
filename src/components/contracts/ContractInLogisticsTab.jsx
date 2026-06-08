import { useState, useEffect, useCallback } from 'react'

import { API } from '../../config/api'

const STATUSES = ['Chờ vận chuyển', 'Đang vận chuyển', 'Đã về kho', 'Giao hàng thành công']

const fmtDateTime = (d) => {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('vi-VN') + ' ' + dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function statusStyle(s) {
  if (s === 'Giao hàng thành công') return { bg: '#dcfce7', color: '#15803d', dot: '#16a34a' }
  if (s === 'Đã về kho')            return { bg: '#d1fae5', color: '#065f46', dot: '#059669' }
  if (s === 'Đang vận chuyển')      return { bg: '#dbeafe', color: '#1d4ed8', dot: '#2563eb' }
  return { bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ContractInLogisticsTab({ contractInId }) {
  const [list, setList]       = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null)   // null | 'add' | record
  const [expandedId, setExpanded] = useState(null)

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/contract-ins/${contractInId}/logistics`)
      const data = await res.json()
      setList(Array.isArray(data) ? data : [])
    } catch (e) { console.error('load logistics:', e) }
    finally { setLoading(false) }
  }, [contractInId])

  useEffect(() => { load() }, [load])

  async function handleSave(form) {
    const isEdit = modal && modal !== 'add'
    const url    = isEdit ? `${API}/contract-in-logistics/${modal.id}` : `${API}/contract-ins/${contractInId}/logistics`
    const method = isEdit ? 'PUT' : 'POST'
    const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data   = await res.json()
    if (!res.ok) { alert(data.error || 'Lỗi lưu'); return }
    if (isEdit) {
      setList(prev => prev.map(r => r.id === modal.id ? { ...r, ...data } : r))
    } else {
      setList(prev => [...prev, data])
      setExpanded(data.id)
    }
    setModal(null)
  }

  async function handleDelete(rec) {
    if (!confirm(`Xóa lô vận chuyển "${rec.carrier || rec.tracking_no || '#' + rec.id}"?`)) return
    await fetch(`${API}/contract-in-logistics/${rec.id}`, { method: 'DELETE' })
    setList(prev => prev.filter(r => r.id !== rec.id))
    if (expandedId === rec.id) setExpanded(null)
  }

  function patchRecord(id, patch) {
    setList(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  // Stats
  const inTransit  = list.filter(r => r.status === 'Đang vận chuyển').length
  const arrived    = list.filter(r => r.status === 'Đã về kho' || r.status === 'Giao hàng thành công').length
  const insured    = list.filter(r => r.has_insurance).length

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Đang tải...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>

      {/* Summary */}
      {list.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
          {[
            { label: 'Tổng lô',           value: list.length, color: '#3b82f6' },
            { label: 'Đang vận chuyển',   value: inTransit,   color: '#2563eb' },
            { label: 'Đã về kho / xong',  value: arrived,     color: '#16a34a' },
            { label: 'Có bảo hiểm',       value: insured,     color: '#d97706' },
          ].map((s, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderLeft: `4px solid ${s.color}`, borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.3px' }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setModal('add')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Thêm lô vận chuyển
        </button>
      </div>

      {/* Logistics cards */}
      {list.length === 0 ? (
        <div style={{ padding: 56, textAlign: 'center', color: '#9ca3af', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}>
          Chưa có lô vận chuyển nào. Nhấn <strong>Thêm lô vận chuyển</strong> để bắt đầu.
        </div>
      ) : list.map(rec => (
        <LogisticsCard
          key={rec.id}
          rec={rec}
          isExpanded={expandedId === rec.id}
          onToggle={() => setExpanded(prev => prev === rec.id ? null : rec.id)}
          onEdit={() => setModal(rec)}
          onDelete={() => handleDelete(rec)}
          onUpdateCountChange={(delta) => patchRecord(rec.id, { update_count: (parseInt(rec.update_count) || 0) + delta })}
          onLastUpdate={(desc, time) => patchRecord(rec.id, { last_description: desc, last_update_time: time })}
        />
      ))}

      {/* Modal */}
      {modal !== null && (
        <LogisticsModal
          rec={modal === 'add' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ── Logistics card ────────────────────────────────────────────────────────────

function LogisticsCard({ rec, isExpanded, onToggle, onEdit, onDelete, onUpdateCountChange, onLastUpdate }) {
  const [updates, setUpdates]     = useState([])
  const [loaded, setLoaded]       = useState(false)
  const [loadingU, setLoadingU]   = useState(false)
  const [addForm, setAddForm]     = useState({ description: '', location: '', update_time: '' })
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    if (isExpanded && !loaded) {
      setLoadingU(true)
      fetch(`${API}/contract-in-logistics/${rec.id}/updates`)
        .then(r => r.json())
        .then(d => { setUpdates(Array.isArray(d) ? d : []); setLoaded(true) })
        .catch(console.error)
        .finally(() => setLoadingU(false))
    }
  }, [isExpanded, rec.id, loaded])

  async function handleAddUpdate() {
    if (!addForm.description.trim()) return
    setSaving(true)
    try {
      const res  = await fetch(`${API}/contract-in-logistics/${rec.id}/updates`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Lỗi'); return }
      setUpdates(prev => [data, ...prev])
      onUpdateCountChange(1)
      onLastUpdate(data.description, data.update_time)
      setAddForm({ description: '', location: '', update_time: '' })
    } catch (e) { alert('Lỗi: ' + e.message) }
    finally { setSaving(false) }
  }

  async function handleDeleteUpdate(u) {
    if (!confirm('Xóa mục cập nhật này?')) return
    await fetch(`${API}/contract-in-logistics-updates/${u.id}`, { method: 'DELETE' })
    setUpdates(prev => prev.filter(x => x.id !== u.id))
    onUpdateCountChange(-1)
  }

  const st = statusStyle(rec.status)

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>

      {/* Card header */}
      <div
        onClick={onToggle}
        style={{ padding: '14px 18px', background: '#f9fafb', borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
      >
        {/* Chevron */}
        <span style={{ color: '#9ca3af', fontSize: 11, transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform .18s', display: 'inline-block', flexShrink: 0 }}>▶</span>

        {/* Status dot */}
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />

        {/* Main info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 14, color: '#111827' }}>{rec.carrier || '(Chưa có đơn vị vận chuyển)'}</strong>
            {rec.tracking_no && (
              <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace', background: '#f3f4f6', padding: '1px 8px', borderRadius: 4 }}>
                {rec.tracking_no}
              </span>
            )}
            <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>{rec.status}</span>
            <span style={{
              padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
              background: rec.has_insurance ? '#fef9c3' : '#f3f4f6',
              color:      rec.has_insurance ? '#a16207' : '#9ca3af',
            }}>
              {rec.has_insurance ? '🛡 Có bảo hiểm' : 'Không có BH'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {rec.last_description && (
              <span>Cập nhật cuối: <span style={{ color: '#6b7280' }}>{rec.last_description}</span></span>
            )}
            {rec.last_update_time && <span>{fmtDateTime(rec.last_update_time)}</span>}
            <span>{parseInt(rec.update_count) || 0} cập nhật</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={onEdit}
            style={{ padding: '4px 12px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
            Sửa
          </button>
          <button onClick={onDelete}
            style={{ padding: '4px 12px', borderRadius: 5, border: 'none', background: '#fee2e2', color: '#b91c1c', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
            Xóa
          </button>
        </div>
      </div>

      {/* Expanded: timeline */}
      {isExpanded && (
        <div style={{ padding: '18px 24px' }}>
          {rec.note && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 7, fontSize: 13, color: '#92400e' }}>
              <strong>Ghi chú:</strong> {rec.note}
            </div>
          )}
          {rec.insurance_note && rec.has_insurance && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fefce8', border: '1px solid #fef08a', borderRadius: 7, fontSize: 13, color: '#713f12' }}>
              <strong>Thông tin bảo hiểm:</strong> {rec.insurance_note}
            </div>
          )}

          {/* Add update form */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d', marginBottom: 10 }}>Thêm cập nhật vận chuyển</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <label style={lbl}>Mô tả cập nhật *</label>
                <input type="text" value={addForm.description}
                  onChange={e => setAddForm(p => ({ ...p, description: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAddUpdate()}
                  placeholder="VD: Hàng đã đến cảng Hải Phòng..."
                  style={inp} />
              </div>
              <div>
                <label style={lbl}>Địa điểm</label>
                <input type="text" value={addForm.location}
                  onChange={e => setAddForm(p => ({ ...p, location: e.target.value }))}
                  placeholder="VD: Cảng Hải Phòng" style={inp} />
              </div>
              <div>
                <label style={lbl}>Thời điểm (để trống = ngay bây giờ)</label>
                <input type="datetime-local" value={addForm.update_time}
                  onChange={e => setAddForm(p => ({ ...p, update_time: e.target.value }))}
                  style={inp} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleAddUpdate} disabled={saving || !addForm.description.trim()}
                style={{ padding: '6px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, opacity: saving ? .7 : 1 }}>
                {saving ? 'Đang lưu...' : '+ Thêm cập nhật'}
              </button>
            </div>
          </div>

          {/* Timeline */}
          {loadingU ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>Đang tải...</div>
          ) : updates.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '16px 0', fontSize: 13 }}>
              Chưa có cập nhật nào. Thêm cập nhật đầu tiên bên trên.
            </div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: 24 }}>
              {/* vertical line */}
              <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, background: '#e5e7eb' }} />
              {updates.map((u, idx) => (
                <div key={u.id} style={{ position: 'relative', marginBottom: idx < updates.length - 1 ? 20 : 0 }}>
                  {/* dot */}
                  <div style={{ position: 'absolute', left: -21, top: 4, width: 10, height: 10, borderRadius: '50%', background: idx === 0 ? '#16a34a' : '#d1d5db', border: '2px solid #fff', boxShadow: '0 0 0 2px ' + (idx === 0 ? '#16a34a' : '#d1d5db') }} />
                  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{u.description}</div>
                        {u.location && (
                          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 3 }}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                            {u.location}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{fmtDateTime(u.update_time)}</div>
                      </div>
                      <button onClick={() => handleDeleteUpdate(u)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
                        title="Xóa cập nhật">×</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const lbl = { fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }
const inp = { width: '100%', padding: '6px 9px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 12, boxSizing: 'border-box' }

// ── Add / Edit modal ──────────────────────────────────────────────────────────

function LogisticsModal({ rec, onSave, onClose }) {
  const isEdit = !!rec
  const [form, setForm] = useState({
    carrier:        rec?.carrier        || '',
    tracking_no:    rec?.tracking_no    || '',
    has_insurance:  rec?.has_insurance  || false,
    insurance_note: rec?.insurance_note || '',
    status:         rec?.status         || 'Chờ vận chuyển',
    note:           rec?.note           || '',
  })
  const [saving, setSaving] = useState(false)
  const s = f => setForm(p => ({ ...p, ...f }))

  async function handleSubmit() {
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 12, width: 540, maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.2)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 24px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>
            {isEdit ? 'Cập nhật lô vận chuyển' : 'Thêm lô vận chuyển'}
          </h3>
          <button onClick={onClose} style={{ width: 28, height: 28, border: 'none', background: '#f3f4f6', borderRadius: 6, cursor: 'pointer', fontSize: 14, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <MField label="Đơn vị vận chuyển">
              <input type="text" value={form.carrier} onChange={e => s({ carrier: e.target.value })}
                placeholder="VD: Maersk, COSCO, DHL, FedEx..." style={minp} />
            </MField>
            <MField label="Mã theo dõi (Tracking No.)">
              <input type="text" value={form.tracking_no} onChange={e => s({ tracking_no: e.target.value })}
                placeholder="VD: MSKU1234567" style={minp} />
            </MField>
          </div>

          <MField label="Trạng thái vận chuyển">
            <select value={form.status} onChange={e => s({ status: e.target.value })} style={minp}>
              {STATUSES.map(st => <option key={st}>{st}</option>)}
            </select>
          </MField>

          <div style={{ padding: '12px 14px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: form.has_insurance ? 10 : 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Bảo hiểm vận chuyển:</span>
              <button type="button" onClick={() => s({ has_insurance: !form.has_insurance })}
                style={{
                  padding: '4px 16px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: form.has_insurance ? '#fef9c3' : '#f3f4f6',
                  color:      form.has_insurance ? '#a16207' : '#9ca3af',
                }}>
                {form.has_insurance ? '🛡 Đã mua' : 'Chưa mua'}
              </button>
            </div>
            {form.has_insurance && (
              <input type="text" value={form.insurance_note} onChange={e => s({ insurance_note: e.target.value })}
                placeholder="Số hợp đồng BH, giá trị bảo hiểm, công ty BH..."
                style={{ ...minp, marginTop: 0 }} />
            )}
          </div>

          <MField label="Ghi chú">
            <textarea rows="2" value={form.note} onChange={e => s({ note: e.target.value })}
              placeholder="Ghi chú thêm về lô hàng vận chuyển..."
              style={{ ...minp, resize: 'vertical' }} />
          </MField>
        </div>

        <div style={{ padding: '12px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: '#f3f4f6', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Hủy</button>
          <button onClick={handleSubmit} disabled={saving}
            style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? .7 : 1 }}>
            {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MField({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

const minp = { width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }
