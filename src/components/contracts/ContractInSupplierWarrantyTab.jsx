import { useState, useEffect, useCallback } from 'react'

import { API } from '../../config/api'
import { apiGet } from '../../lib/api'
import { fmtDate, fmtDateInput, claimStatusStyle, warrantyExpiry, th, td } from './supplierWarrantyUtils'
import WarrantyRow from './SupplierWarrantyRow'
import { BulkUpdateModal, WarrantyModal, ClaimModal } from './SupplierWarrantyModals'
import useIsMobile from './useIsMobile'
import { ClaimCardList, WarrantyCardList } from './SupplierWarrantyMobile'
import EditGuard from './EditGuard'
import { auditRowAttrs } from '../common/rowAudit'

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
      const [wData, cData] = await Promise.all([
        apiGet(`/contract-ins/${contractInId}/supplier-warranty`, { conditional: true }),
        apiGet(`/contract-ins/${contractInId}/warranty-claims`, { conditional: true }),
      ])
      setWarranties(Array.isArray(wData) ? wData : [])
      setClaims(Array.isArray(cData) ? cData : [])
    } catch (e) { console.error('load warranty:', e) }
    finally { setLoading(false) }
  }, [contractInId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() là async: setState xảy ra SAU await, không phải cascade đồng bộ
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

  const isMobile = useIsMobile()

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Đang tải...</div>

  const expiredCount = warranties.filter(w => w.warranty_end && new Date(w.warranty_end) < new Date()).length
  const activeCount  = warranties.filter(w => w.warranty_end && new Date(w.warranty_end) >= new Date()).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

      {/* Summary — ẩn trên mobile */}
      {!isMobile && warranties.length > 0 && (
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
          <EditGuard>
            <button
              onClick={() => setCModal('add')}
              style={{ padding: '7px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            >
              + Thêm claim
            </button>
          </EditGuard>
        </div>

        <EditGuard>
        {isMobile ? (
          <ClaimCardList rows={claims} onEdit={setCModal} onDelete={handleDeleteClaim} />
        ) : claims.length === 0 ? (
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
                    <tr key={c.id} {...auditRowAttrs('contract_in_warranty_claim', c.id)} style={{ borderBottom: '1px solid #f3f4f6' }}>
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
        </EditGuard>
      </div>

      {/* ── Section 2: Warranty list ── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10, background: '#f9fafb' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Bảo hành theo chủng loại hàng</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Thời hạn bảo hành NCC cho từng loại hàng đã nhận</div>
          </div>
          <EditGuard>
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
          </EditGuard>
        </div>

        {isMobile ? (
          <EditGuard><WarrantyCardList rows={warranties} onEdit={setWModal} onDelete={handleDeleteWarranty} /></EditGuard>
        ) : warranties.length === 0 ? (
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
                    <EditGuard>
                      <input type="checkbox"
                        checked={selected.size === warranties.length && warranties.length > 0}
                        onChange={toggleAll} />
                    </EditGuard>
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
