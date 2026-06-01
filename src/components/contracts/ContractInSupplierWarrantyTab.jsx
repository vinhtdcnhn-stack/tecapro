import { useState, useEffect, useCallback } from 'react'

const API = (() => (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5174').replace(/\/$/, ''))() + '/api'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'
const fmtDateInput = (d) => {
  if (!d) return ''
  const s = typeof d === 'string' ? d : new Date(d).toISOString()
  return s.slice(0, 10)
}

const CLAIM_STATUSES = ['Tiếp nhận', 'Đang xử lý', 'Đã giải quyết', 'Từ chối']

function claimStatusStyle(s) {
  if (s === 'Đã giải quyết') return { background: '#dcfce7', color: '#15803d' }
  if (s === 'Từ chối')       return { background: '#fee2e2', color: '#b91c1c' }
  if (s === 'Đang xử lý')   return { background: '#dbeafe', color: '#1d4ed8' }
  return { background: '#f3f4f6', color: '#6b7280' }
}

function warrantyExpiry(row) {
  if (!row.warranty_end) return null
  const daysLeft = Math.ceil((new Date(row.warranty_end) - new Date()) / 86400000)
  if (daysLeft < 0)   return { label: 'Hết hạn', bg: '#fee2e2', color: '#b91c1c' }
  if (daysLeft <= 30) return { label: `Còn ${daysLeft} ngày`, bg: '#fef9c3', color: '#a16207' }
  return { label: `Còn ${daysLeft} ngày`, bg: '#dcfce7', color: '#15803d' }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ContractInSupplierWarrantyTab({ contractInId }) {
  const [warranties, setWarranties] = useState([])
  const [claims, setClaims]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState(new Set())
  const [initing, setIniting]       = useState(false)
  const [bulkModal, setBulkModal]   = useState(false)
  const [warrantyModal, setWModal]  = useState(null) // null | 'add' | warranty-object
  const [claimModal, setCModal]     = useState(null) // null | 'add' | claim-object

  const load = useCallback(async () => {
    try {
      const [wRes, cRes] = await Promise.all([
        fetch(`${API}/contract-ins/${contractInId}/supplier-warranty`),
        fetch(`${API}/contract-ins/${contractInId}/warranty-claims`),
      ])
      const [wData, cData] = await Promise.all([wRes.json(), cRes.json()])
      setWarranties(Array.isArray(wData) ? wData : [])
      setClaims(Array.isArray(cData) ? cData : [])
    } catch (e) { console.error('load warranty:', e) }
    finally { setLoading(false) }
  }, [contractInId])

  useEffect(() => { load() }, [load])

  async function handleInit() {
    if (!confirm('Tự động tạo bảo hành từ tất cả chủng loại hàng đã nhận chưa có bảo hành?')) return
    setIniting(true)
    try {
      const res  = await fetch(`${API}/contract-ins/${contractInId}/supplier-warranty/init`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Lỗi'); return }
      if (data.created === 0) alert(data.message || 'Tất cả hàng nhận đã có bảo hành')
      else { alert(`Đã tạo ${data.created} dòng bảo hành`); await load() }
    } catch (e) { alert('Lỗi: ' + e.message) }
    finally { setIniting(false) }
  }

  async function handleBulkUpdate(warrantyStart, warrantyEnd) {
    const res = await fetch(`${API}/contract-ins/${contractInId}/supplier-warranty/bulk-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selected], warranty_start: warrantyStart, warranty_end: warrantyEnd }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error || 'Lỗi'); return }
    setBulkModal(false)
    setSelected(new Set())
    await load()
  }

  async function handleWarrantySave(form) {
    const isEdit = warrantyModal && warrantyModal !== 'add'
    const url    = isEdit ? `${API}/supplier-warranty/${warrantyModal.id}` : `${API}/contract-ins/${contractInId}/supplier-warranty`
    const method = isEdit ? 'PUT' : 'POST'
    const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data   = await res.json()
    if (!res.ok) { alert(data.error || 'Lỗi'); return }
    setWarranties(prev => isEdit ? prev.map(x => x.id === warrantyModal.id ? data : x) : [...prev, data])
    setWModal(null)
  }

  async function handleWarrantyFieldUpdate(w, field, value) {
    const body = {
      item_name: w.item_name, warranty_period_text: w.warranty_period_text,
      warranty_start: fmtDateInput(w.warranty_start), warranty_end: fmtDateInput(w.warranty_end),
      has_guarantee: w.has_guarantee, note: w.note,
      [field]: value,
    }
    const res  = await fetch(`${API}/supplier-warranty/${w.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error || 'Lỗi'); return }
    setWarranties(prev => prev.map(x => x.id === w.id ? data : x))
  }

  async function handleDeleteWarranty(w) {
    if (!confirm(`Xóa bảo hành "${w.item_name}"?`)) return
    await fetch(`${API}/supplier-warranty/${w.id}`, { method: 'DELETE' })
    setWarranties(prev => prev.filter(x => x.id !== w.id))
    setSelected(prev => { const n = new Set(prev); n.delete(w.id); return n })
  }

  async function handleClaimSave(form) {
    const isEdit = claimModal && claimModal !== 'add'
    const url    = isEdit ? `${API}/warranty-claims/${claimModal.id}` : `${API}/contract-ins/${contractInId}/warranty-claims`
    const method = isEdit ? 'PUT' : 'POST'
    const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data   = await res.json()
    if (!res.ok) { alert(data.error || 'Lỗi'); return }
    if (isEdit) {
      setClaims(prev => prev.map(x => x.id === claimModal.id ? { ...x, ...data } : x))
    } else {
      setClaims(prev => [data, ...prev])
    }
    setCModal(null)
  }

  async function handleDeleteClaim(c) {
    if (!confirm(`Xóa claim "${c.title}"?`)) return
    await fetch(`${API}/warranty-claims/${c.id}`, { method: 'DELETE' })
    setClaims(prev => prev.filter(x => x.id !== c.id))
  }

  function toggleSelect(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleAll() {
    setSelected(selected.size === warranties.length && warranties.length > 0 ? new Set() : new Set(warranties.map(w => w.id)))
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Đang tải...</div>

  const expiredCount = warranties.filter(w => w.warranty_end && new Date(w.warranty_end) < new Date()).length
  const activeCount  = warranties.filter(w => w.warranty_end && new Date(w.warranty_end) >= new Date()).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Summary */}
      {warranties.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
          {[
            { label: 'Tổng chủng loại', value: warranties.length, color: '#3b82f6' },
            { label: 'Còn hiệu lực',    value: activeCount,       color: '#16a34a' },
            { label: 'Hết hạn BH',      value: expiredCount,      color: '#dc2626' },
            { label: 'Claim BH',         value: claims.length,     color: '#d97706' },
          ].map((s, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderLeft: `4px solid ${s.color}`, borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.3px' }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Section 1: Claims ── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10, background: '#f9fafb' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Claim bảo hành với NCC</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Theo dõi các yêu cầu bảo hành gửi đến nhà cung cấp</div>
          </div>
          <button
            onClick={() => setCModal('add')}
            style={{ padding: '7px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            + Thêm claim
          </button>
        </div>

        {claims.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>Chưa có claim bảo hành nào.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['#', 'Mã claim', 'Tiêu đề', 'Hàng hóa liên quan', 'Ngày báo', 'Trạng thái', 'Ngày giải quyết', 'Ghi chú', ''].map((h, i) => (
                    <th key={i} style={th(null, i === 0 ? 'center' : 'left')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {claims.map((c, idx) => {
                  const cs = claimStatusStyle(c.status)
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={td('center', { color: '#9ca3af', fontSize: 12 })}>{idx + 1}</td>
                      <td style={td('left', { fontWeight: 600 })}>{c.claim_no || '—'}</td>
                      <td style={td('left', { maxWidth: 220 })}>{c.title}</td>
                      <td style={td('left', { color: '#6b7280', maxWidth: 180 })}>{c.warranty_item_name || '—'}</td>
                      <td style={td('left', { whiteSpace: 'nowrap', color: '#6b7280' })}>{fmtDate(c.reported_date)}</td>
                      <td style={td()}>
                        <span style={{ ...cs, padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{c.status}</span>
                      </td>
                      <td style={td('left', { whiteSpace: 'nowrap', color: '#6b7280' })}>{fmtDate(c.resolved_date)}</td>
                      <td style={td('left', { color: '#9ca3af', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>{c.note || '—'}</td>
                      <td style={td()}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => setCModal(c)}
                            style={{ padding: '3px 8px', background: '#f3f4f6', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Sửa</button>
                          <button onClick={() => handleDeleteClaim(c)}
                            style={{ padding: '3px 8px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Xóa</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section 2: Warranty list ── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10, background: '#f9fafb' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Bảo hành theo chủng loại hàng</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Thời hạn bảo hành NCC cho từng loại hàng đã nhận</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {selected.size > 0 && (
              <button
                onClick={() => setBulkModal(true)}
                style={{ padding: '7px 14px', background: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
              >
                Nhập nhanh ({selected.size} dòng)
              </button>
            )}
            <button
              onClick={handleInit}
              disabled={initing}
              style={{ padding: '7px 14px', background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            >
              {initing ? 'Đang tạo...' : 'Khởi tạo từ nhận hàng'}
            </button>
            <button
              onClick={() => setWModal('add')}
              style={{ padding: '7px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            >
              + Thêm thủ công
            </button>
          </div>
        </div>

        {warranties.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>
            Chưa có dữ liệu bảo hành.{' '}
            Nhấn <strong>Khởi tạo từ nhận hàng</strong> để tự động tạo từ danh sách đã nhận.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={th(36, 'center')}>
                    <input type="checkbox"
                      checked={selected.size === warranties.length && warranties.length > 0}
                      onChange={toggleAll} />
                  </th>
                  <th style={th(32, 'center')}>#</th>
                  <th style={th(null, 'left')}>Chủng loại hàng hóa</th>
                  <th style={th(100, 'center')}>Serial</th>
                  <th style={th(110, 'left')}>Thời hạn BH</th>
                  <th style={th(130, 'left')}>Bắt đầu BH</th>
                  <th style={th(130, 'left')}>Hết hạn BH</th>
                  <th style={th(110, 'center')}>Tình trạng</th>
                  <th style={th(90, 'center')}>Bảo lãnh BH</th>
                  <th style={th(160, 'left')}>Ghi chú</th>
                  <th style={th(90)}></th>
                </tr>
              </thead>
              <tbody>
                {warranties.map((w, idx) => (
                  <WarrantyRow
                    key={w.id}
                    idx={idx}
                    w={w}
                    selected={selected.has(w.id)}
                    onToggle={() => toggleSelect(w.id)}
                    onFieldUpdate={(field, value) => handleWarrantyFieldUpdate(w, field, value)}
                    onEdit={() => setWModal(w)}
                    onDelete={() => handleDeleteWarranty(w)}
                    expiryInfo={warrantyExpiry(w)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {bulkModal && (
        <BulkUpdateModal count={selected.size} onSave={handleBulkUpdate} onClose={() => setBulkModal(false)} />
      )}
      {warrantyModal !== null && (
        <WarrantyModal
          warranty={warrantyModal === 'add' ? null : warrantyModal}
          onSave={handleWarrantySave}
          onClose={() => setWModal(null)}
        />
      )}
      {claimModal !== null && (
        <ClaimModal
          claim={claimModal === 'add' ? null : claimModal}
          warranties={warranties}
          onSave={handleClaimSave}
          onClose={() => setCModal(null)}
        />
      )}
    </div>
  )
}

// ── Style helpers ─────────────────────────────────────────────────────────────

function th(w, align = 'left') {
  return {
    padding: '8px 12px', textAlign: align, fontSize: 11, fontWeight: 600,
    color: '#4b5563', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap',
    ...(w ? { width: w, minWidth: w } : {}),
  }
}
function td(align = 'left', extra = {}) {
  return { padding: '9px 12px', textAlign: align, borderBottom: '1px solid #f3f4f6', fontSize: 13, verticalAlign: 'middle', ...extra }
}

// ── Warranty row ──────────────────────────────────────────────────────────────

function WarrantyRow({ idx, w, selected, onToggle, onFieldUpdate, onEdit, onDelete, expiryInfo }) {
  const [editField, setEditField] = useState(null) // 'start' | 'end'
  const [tempVal, setTempVal]     = useState('')
  const [showSerials, setShowSerials] = useState(false)

  const serials = Array.isArray(w.serials) ? w.serials : []

  function startEdit(field, currentVal) {
    setEditField(field)
    setTempVal(fmtDateInput(currentVal))
  }

  async function commitEdit(field) {
    const apiField = field === 'start' ? 'warranty_start' : 'warranty_end'
    await onFieldUpdate(apiField, tempVal || null)
    setEditField(null)
  }

  function DateCell({ field, value }) {
    if (editField === field) {
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input type="date" value={tempVal} onChange={e => setTempVal(e.target.value)} autoFocus
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(field); if (e.key === 'Escape') setEditField(null) }}
            style={{ padding: '3px 6px', border: '1px solid #3b82f6', borderRadius: 4, fontSize: 12 }} />
          <button onClick={() => commitEdit(field)}
            style={{ padding: '2px 8px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>✓</button>
          <button onClick={() => setEditField(null)}
            style={{ padding: '2px 8px', background: '#f3f4f6', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>✕</button>
        </div>
      )
    }
    return (
      <span
        onClick={() => startEdit(field, value)}
        title="Nhấn để sửa"
        style={{
          cursor: 'pointer', padding: '2px 8px', borderRadius: 4, fontSize: 12, whiteSpace: 'nowrap',
          background: value ? '#f0fdf4' : '#f9fafb',
          color: value ? '#15803d' : '#9ca3af',
          fontWeight: value ? 600 : 400,
        }}
      >
        {value ? fmtDate(value) : 'Nhấn để nhập ✎'}
      </span>
    )
  }

  return (
    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
      <td style={td('center')}>
        <input type="checkbox" checked={selected} onChange={onToggle} />
      </td>
      <td style={td('center', { color: '#9ca3af', fontSize: 12 })}>{idx + 1}</td>
      <td style={td('left', { fontWeight: 500 })}>{w.item_name}</td>
      <td style={td('center')}>
        {serials.length > 0 ? (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              onClick={() => setShowSerials(!showSerials)}
              style={{ padding: '2px 8px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >
              {serials.length} serial {showSerials ? '▲' : '▼'}
            </button>
            {showSerials && (
              <div style={{
                position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                zIndex: 100, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                padding: '10px 12px', boxShadow: '0 4px 12px rgba(0,0,0,.12)',
                display: 'flex', flexWrap: 'wrap', gap: 4, minWidth: 200, maxWidth: 300, marginTop: 4,
              }}>
                {serials.map(s => (
                  <span key={s.id} style={{ padding: '2px 8px', background: '#eff6ff', color: '#1d4ed8', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                    {s.serial_no}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>
        )}
      </td>
      <td style={td('left', { color: '#6b7280' })}>{w.warranty_period_text || '—'}</td>
      <td style={td()}><DateCell field="start" value={w.warranty_start} /></td>
      <td style={td()}><DateCell field="end"   value={w.warranty_end} /></td>
      <td style={td('center')}>
        {expiryInfo
          ? <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: expiryInfo.bg, color: expiryInfo.color }}>{expiryInfo.label}</span>
          : <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>
        }
      </td>
      <td style={td('center')}>
        <button
          onClick={() => onFieldUpdate('has_guarantee', !w.has_guarantee)}
          style={{
            padding: '3px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
            background: w.has_guarantee ? '#dcfce7' : '#f3f4f6',
            color: w.has_guarantee ? '#15803d' : '#9ca3af',
          }}
        >
          {w.has_guarantee ? 'Có' : 'Không'}
        </button>
      </td>
      <td style={td('left', { color: '#9ca3af', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>
        {w.note || '—'}
      </td>
      <td style={td()}>
        <div style={{ display: 'flex', gap: 5 }}>
          <button onClick={onEdit}
            style={{ padding: '3px 8px', background: '#f3f4f6', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Sửa</button>
          <button onClick={onDelete}
            style={{ padding: '3px 8px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Xóa</button>
        </div>
      </td>
    </tr>
  )
}

// ── Bulk update modal ─────────────────────────────────────────────────────────

function BulkUpdateModal({ count, onSave, onClose }) {
  const [startDate, setStart] = useState('')
  const [endDate, setEnd]     = useState('')
  const [saving, setSaving]   = useState(false)

  async function handleSave() {
    if (!startDate && !endDate) { alert('Vui lòng nhập ít nhất một ngày'); return }
    setSaving(true)
    await onSave(startDate || null, endDate || null)
    setSaving(false)
  }

  return (
    <ModalShell title={`Nhập nhanh bảo hành cho ${count} dòng`} onClose={onClose} width={420}>
      <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
          Áp dụng cho <strong>{count} dòng</strong> đang được chọn. Trường nào để trống sẽ không thay đổi.
        </p>
        <FormField label="Ngày bắt đầu bảo hành">
          <input type="date" value={startDate} onChange={e => setStart(e.target.value)} style={inputStyle} />
        </FormField>
        <FormField label="Ngày hết hạn bảo hành">
          <input type="date" value={endDate} onChange={e => setEnd(e.target.value)} style={inputStyle} />
        </FormField>
      </div>
      <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} saveLabel={`Cập nhật ${count} dòng`} />
    </ModalShell>
  )
}

// ── Warranty add/edit modal ───────────────────────────────────────────────────

function WarrantyModal({ warranty, onSave, onClose }) {
  const isEdit = !!warranty
  const [form, setForm] = useState({
    item_name:            warranty?.item_name            || '',
    warranty_period_text: warranty?.warranty_period_text || '',
    warranty_start:       fmtDateInput(warranty?.warranty_start),
    warranty_end:         fmtDateInput(warranty?.warranty_end),
    has_guarantee:        warranty?.has_guarantee        || false,
    note:                 warranty?.note                 || '',
  })
  const [saving, setSaving] = useState(false)
  const s = f => setForm(p => ({ ...p, ...f }))

  async function handleSubmit() {
    if (!form.item_name.trim()) { alert('Vui lòng nhập tên chủng loại hàng'); return }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <ModalShell title={isEdit ? 'Cập nhật bảo hành' : 'Thêm bảo hành thủ công'} onClose={onClose} width={520}>
      <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 13 }}>
        <FormField label="Chủng loại hàng hóa *">
          <input type="text" value={form.item_name} onChange={e => s({ item_name: e.target.value })}
            placeholder="VD: UPS Vertiv 350KVA" style={inputStyle} />
        </FormField>
        <FormField label="Thời hạn bảo hành (theo BoQ IN)">
          <input type="text" value={form.warranty_period_text} onChange={e => s({ warranty_period_text: e.target.value })}
            placeholder="VD: 12 tháng, 24 months..." style={inputStyle} />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Ngày bắt đầu BH">
            <input type="date" value={form.warranty_start} onChange={e => s({ warranty_start: e.target.value })} style={inputStyle} />
          </FormField>
          <FormField label="Ngày hết hạn BH">
            <input type="date" value={form.warranty_end} onChange={e => s({ warranty_end: e.target.value })} style={inputStyle} />
          </FormField>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Bảo lãnh bảo hành:</span>
          <button type="button" onClick={() => s({ has_guarantee: !form.has_guarantee })}
            style={{
              padding: '4px 16px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: form.has_guarantee ? '#dcfce7' : '#f3f4f6',
              color: form.has_guarantee ? '#15803d' : '#9ca3af',
            }}>
            {form.has_guarantee ? 'Có' : 'Không'}
          </button>
        </div>
        <FormField label="Ghi chú">
          <textarea rows="2" value={form.note} onChange={e => s({ note: e.target.value })}
            placeholder="Ghi chú thêm..." style={{ ...inputStyle, resize: 'vertical' }} />
        </FormField>
      </div>
      <ModalFooter onClose={onClose} onSave={handleSubmit} saving={saving} saveLabel={isEdit ? 'Cập nhật' : 'Thêm'} />
    </ModalShell>
  )
}

// ── Claim add/edit modal ──────────────────────────────────────────────────────

function ClaimModal({ claim, warranties, onSave, onClose }) {
  const isEdit = !!claim
  const [form, setForm] = useState({
    warranty_id:   claim?.warranty_id   || '',
    claim_no:      claim?.claim_no      || '',
    title:         claim?.title         || '',
    description:   claim?.description   || '',
    reported_date: claim?.reported_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    status:        claim?.status        || 'Tiếp nhận',
    resolved_date: claim?.resolved_date?.slice(0, 10) || '',
    note:          claim?.note          || '',
  })
  const [saving, setSaving] = useState(false)
  const s = f => setForm(p => ({ ...p, ...f }))

  async function handleSubmit() {
    if (!form.title.trim()) { alert('Vui lòng nhập tiêu đề claim'); return }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <ModalShell title={isEdit ? 'Cập nhật claim bảo hành' : 'Thêm claim bảo hành'} onClose={onClose} width={560}>
      <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 13, overflowY: 'auto', maxHeight: '65vh' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Mã claim">
            <input type="text" value={form.claim_no} onChange={e => s({ claim_no: e.target.value })}
              placeholder="VD: CLM-2026-001" style={inputStyle} />
          </FormField>
          <FormField label="Ngày báo">
            <input type="date" value={form.reported_date} onChange={e => s({ reported_date: e.target.value })} style={inputStyle} />
          </FormField>
        </div>
        <FormField label="Tiêu đề *">
          <input type="text" value={form.title} onChange={e => s({ title: e.target.value })}
            placeholder="Mô tả ngắn gọn vấn đề bảo hành..." style={inputStyle} />
        </FormField>
        <FormField label="Hàng hóa liên quan">
          <select value={form.warranty_id} onChange={e => s({ warranty_id: e.target.value })} style={inputStyle}>
            <option value="">-- Chọn chủng loại hàng --</option>
            {warranties.map(w => <option key={w.id} value={w.id}>{w.item_name}</option>)}
          </select>
        </FormField>
        <FormField label="Mô tả chi tiết">
          <textarea rows="3" value={form.description} onChange={e => s({ description: e.target.value })}
            placeholder="Chi tiết lỗi hỏng hóc, yêu cầu xử lý..." style={{ ...inputStyle, resize: 'vertical' }} />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Trạng thái">
            <select value={form.status} onChange={e => s({ status: e.target.value })} style={inputStyle}>
              {CLAIM_STATUSES.map(st => <option key={st}>{st}</option>)}
            </select>
          </FormField>
          <FormField label="Ngày giải quyết">
            <input type="date" value={form.resolved_date} onChange={e => s({ resolved_date: e.target.value })} style={inputStyle} />
          </FormField>
        </div>
        <FormField label="Ghi chú">
          <textarea rows="2" value={form.note} onChange={e => s({ note: e.target.value })}
            placeholder="Ghi chú thêm..." style={{ ...inputStyle, resize: 'vertical' }} />
        </FormField>
      </div>
      <ModalFooter onClose={onClose} onSave={handleSubmit} saving={saving} saveLabel={isEdit ? 'Cập nhật' : 'Thêm claim'} />
    </ModalShell>
  )
}

// ── Shared modal components ───────────────────────────────────────────────────

function ModalShell({ title, onClose, width, children }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 12, width, maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.2)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 24px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>{title}</h3>
          <button onClick={onClose} style={{ width: 28, height: 28, border: 'none', background: '#f3f4f6', borderRadius: 6, cursor: 'pointer', fontSize: 14, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalFooter({ onClose, onSave, saving, saveLabel }) {
  return (
    <div style={{ padding: '12px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
      <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: '#f3f4f6', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Hủy</button>
      <button onClick={onSave} disabled={saving} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? .7 : 1 }}>
        {saving ? 'Đang lưu...' : saveLabel}
      </button>
    </div>
  )
}

function FormField({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '7px 10px', border: '1px solid #d1d5db',
  borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
}
