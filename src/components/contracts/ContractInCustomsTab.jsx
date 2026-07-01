import { useState, useEffect, useCallback } from 'react'
import { API } from '../../config/api'
import DateInput from './DateInput'
import useIsMobile from './useIsMobile'
import CustomsMobile from './CustomsMobile'
import EditGuard from './EditGuard'
import { useContractPerm } from '../../context/ContractPermContext'
import { auditRowAttrs } from '../common/rowAudit'

const SHIPMENT_TYPES   = ['Nhập khẩu', 'Xuất khẩu']
const CUSTOMS_STATUSES = ['Chưa khai báo', 'Đang làm thủ tục', 'Đã thông quan', 'Bị tạm giữ']
const fmtVND  = (n) => { const num = parseFloat(n) || 0; return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: num % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 }).format(num) }
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'
const sliceDate = (d) => d ? d.slice(0, 10) : ''
function customsStatusStyle(s) {
  if (s === 'Đã thông quan')     return { bg: '#dcfce7', color: '#15803d' }
  if (s === 'Đang làm thủ tục')  return { bg: '#dbeafe', color: '#1d4ed8' }
  if (s === 'Bị tạm giữ')        return { bg: '#fee2e2', color: '#b91c1c' }
  return { bg: '#f3f4f6', color: '#6b7280' }
}
function totalCost(row) {
  return (parseFloat(row.shipping_cost) || 0)
       + (parseFloat(row.tax_amount)    || 0)
       + (parseFloat(row.other_fees)    || 0)
}
// ── Main component ────────────────────────────────────────────────────────────
export default function ContractInCustomsTab({ contractInId }) {
  const { canSection } = useContractPerm()
  const showAmounts = canSection('ci.customs.amounts')
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null) // null | 'add' | row-object
  const load = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/contract-ins/${contractInId}/customs`)
      const data = await res.json()
      setRows(Array.isArray(data) ? data : [])
    } catch (e) { console.error('load customs:', e) }
    finally { setLoading(false) }
  }, [contractInId])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() là async: setState xảy ra SAU await, không phải cascade đồng bộ
  useEffect(() => { load() }, [load])
  async function handleSave(form) {
    const isEdit = modal && modal !== 'add'
    const url    = isEdit ? `${API}/contract-in-customs/${modal.id}` : `${API}/contract-ins/${contractInId}/customs`
    const method = isEdit ? 'PUT' : 'POST'
    const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data   = await res.json()
    if (!res.ok) { alert(data.error || 'Lỗi lưu'); return }
    setRows(prev => isEdit ? prev.map(r => r.id === modal.id ? data : r) : [...prev, data])
    setModal(null)
  }
  async function handleDelete(row) {
    if (!confirm(`Xóa lô hàng "${row.bl_awb_no || row.declaration_no || '#' + row.id}"?`)) return
    await fetch(`${API}/contract-in-customs/${row.id}`, { method: 'DELETE' })
    setRows(prev => prev.filter(r => r.id !== row.id))
  }
  // Stats
  const cleared   = rows.filter(r => r.customs_status === 'Đã thông quan').length
  const inProcess = rows.filter(r => r.customs_status === 'Đang làm thủ tục').length
  const held      = rows.filter(r => r.customs_status === 'Bị tạm giữ').length
  const grandTotal = rows.reduce((s, r) => s + totalCost(r), 0)
  const isMobile = useIsMobile()
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Đang tải...</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
      {/* Summary — ẩn trên mobile */}
      {!isMobile && rows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          {[
            { label: 'Tổng lô hàng',      value: rows.length,              color: '#3b82f6', sub: 'lô' },
            { label: 'Đã thông quan',      value: cleared,                  color: '#16a34a', sub: 'lô' },
            { label: 'Đang làm thủ tục',   value: inProcess,                color: '#2563eb', sub: 'lô' },
            { label: 'Bị tạm giữ',         value: held,                     color: '#dc2626', sub: 'lô' },
            { label: 'Tổng chi phí',       value: showAmounts ? fmtVND(grandTotal) : '•••', color: '#d97706', sub: 'VNĐ', wide: true },
          ].map((s, i) => (
            <div key={i} style={{
              background: '#fff', border: '1px solid #e5e7eb',
              borderLeft: `4px solid ${s.color}`, borderRadius: 8, padding: '12px 14px',
              gridColumn: s.wide ? 'span 2' : undefined,
            }}>
              <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.3px' }}>{s.label}</div>
              <div style={{ fontSize: s.wide ? 18 : 22, fontWeight: 700, color: '#111827', marginTop: 2 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}
      {/* Table section */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10, background: '#f9fafb' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Danh sách lô hàng xuất nhập khẩu</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Tờ khai hải quan, vận đơn, lịch tàu và chi phí logistics</div>
          </div>
          <EditGuard>
            <button
              onClick={() => setModal('add')}
              style={{ padding: '7px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              Thêm lô hàng
            </button>
          </EditGuard>
        </div>
        <EditGuard>
        {isMobile ? (
          <CustomsMobile rows={rows} onEdit={setModal} onDelete={handleDelete}
            fmtVND={fmtVND} fmtDate={fmtDate} customsStatusStyle={customsStatusStyle} totalCost={totalCost} showAmounts={showAmounts} />
        ) : rows.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center', color: '#9ca3af' }}>
            <div style={{ marginBottom: 8 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            Chưa có lô hàng nào. Nhấn <strong>Thêm lô hàng</strong> để bắt đầu.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {[
                    ['#',              32,    'center'],
                    ['Loại',           80,    'center'],
                    ['Số tờ khai',     130,   'left'],
                    ['Ngày TK',        100,   'left'],
                    ['Số vận đơn',     160,   'left'],
                    ['ETD',            100,   'left'],
                    ['ETA',            100,   'left'],
                    ['Cảng đi → đến',  200,   'left'],
                    ['Trạng thái',     130,   'center'],
                    ['Tổng chi phí',   130,   'right'],
                    ['',               80,    'center'],
                  ].map(([h, w, align]) => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: align, fontSize: 11, fontWeight: 600, color: '#4b5563', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', width: w, minWidth: w }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const st = customsStatusStyle(row.customs_status)
                  const cost = totalCost(row)
                  return (
                    <tr key={row.id} {...auditRowAttrs('contract_in_customs', row.id)} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={td('center', { color: '#9ca3af', fontSize: 12 })}>{idx + 1}</td>
                      <td style={td('center')}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                          background: row.shipment_type === 'Nhập khẩu' ? '#dbeafe' : '#fef9c3',
                          color:      row.shipment_type === 'Nhập khẩu' ? '#1d4ed8' : '#a16207',
                        }}>{row.shipment_type}</span>
                      </td>
                      <td style={td('left', { fontWeight: 600 })}>{row.declaration_no || '—'}</td>
                      <td style={td('left', { color: '#6b7280' })}>{fmtDate(row.declaration_date)}</td>
                      <td style={td('left', { fontWeight: 500 })}>{row.bl_awb_no || '—'}</td>
                      <td style={td('left', { color: '#6b7280', whiteSpace: 'nowrap' })}>{fmtDate(row.etd)}</td>
                      <td style={td('left', { color: '#6b7280', whiteSpace: 'nowrap' })}>{fmtDate(row.eta)}</td>
                      <td style={td('left', { maxWidth: 200 })}>
                        {row.port_of_loading || row.port_of_discharge ? (
                          <span>
                            <span style={{ color: '#374151' }}>{row.port_of_loading || '—'}</span>
                            <span style={{ color: '#9ca3af', margin: '0 4px' }}>→</span>
                            <span style={{ color: '#374151' }}>{row.port_of_discharge || '—'}</span>
                          </span>
                        ) : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={td('center')}>
                        <span style={{ ...st, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: st.bg }}>{row.customs_status}</span>
                      </td>
                      <td style={td('right', { fontWeight: 600, color: cost > 0 ? '#111827' : '#d1d5db' })}>
                        {!showAmounts ? '•••' : (cost > 0 ? fmtVND(cost) : '—')}
                      </td>
                      <td style={td('center')}>
                        <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                          <button onClick={() => setModal(row)}
                            style={{ padding: '3px 10px', background: '#f3f4f6', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Sửa</button>
                          <button onClick={() => handleDelete(row)}
                            style={{ padding: '3px 10px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Xóa</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#f9fafb' }}>
                    <td colSpan="9" style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, color: '#374151', textAlign: 'right' }}>TỔNG CHI PHÍ LOGISTICS</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#111827' }}>{showAmounts ? fmtVND(grandTotal) : '•••'}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
        </EditGuard>
      </div>
      {/* Modal */}
      {modal !== null && (
        <CustomsModal
          row={modal === 'add' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
function td(align = 'left', extra = {}) {
  return { padding: '10px 12px', textAlign: align, borderBottom: '1px solid #f3f4f6', fontSize: 13, verticalAlign: 'middle', ...extra }
}
// ── Add / Edit modal ──────────────────────────────────────────────────────────
function CustomsModal({ row, onSave, onClose }) {
  const { canSection } = useContractPerm()
  const showAmounts = canSection('ci.customs.amounts')
  const isEdit = !!row
  const isMobile = useIsMobile()
  const g2 = isMobile ? gridCol : grid2
  const g3 = isMobile ? gridCol : grid3
  const [form, setForm] = useState({
    shipment_type:     row?.shipment_type     || 'Nhập khẩu',
    declaration_no:    row?.declaration_no    || '',
    declaration_date:  sliceDate(row?.declaration_date),
    bl_awb_no:         row?.bl_awb_no         || '',
    etd:               sliceDate(row?.etd),
    eta:               sliceDate(row?.eta),
    port_of_loading:   row?.port_of_loading   || '',
    port_of_discharge: row?.port_of_discharge || '',
    customs_status:    row?.customs_status    || 'Chưa khai báo',
    shipping_cost:     row?.shipping_cost     || '',
    tax_amount:        row?.tax_amount        || '',
    other_fees:        row?.other_fees        || '',
    note:              row?.note              || '',
  })
  const [saving, setSaving] = useState(false)
  const s = f => setForm(p => ({ ...p, ...f }))
  const total = (parseFloat(form.shipping_cost) || 0)
              + (parseFloat(form.tax_amount)    || 0)
              + (parseFloat(form.other_fees)    || 0)
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
      <div style={{ background: '#fff', borderRadius: 12, width: 680, maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.2)', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>
            {isEdit ? 'Cập nhật lô hàng' : 'Thêm lô hàng xuất nhập khẩu'}
          </h3>
          <button onClick={onClose} style={{ width: 28, height: 28, border: 'none', background: '#f3f4f6', borderRadius: 6, cursor: 'pointer', fontSize: 14, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        {/* Body */}
        <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto' }}>
          {/* Section 1: Thông tin lô hàng */}
          <Section title="Thông tin lô hàng">
            <div style={g2}>
              <Field label="Loại">
                <select value={form.shipment_type} onChange={e => s({ shipment_type: e.target.value })} style={inp}>
                  {SHIPMENT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Số vận đơn (B/L / AWB)">
                <input type="text" value={form.bl_awb_no} onChange={e => s({ bl_awb_no: e.target.value })}
                  placeholder="VD: COSCO123456789" style={inp} />
              </Field>
              <Field label="Ngày ETD (Khởi hành)">
                <DateInput value={form.etd} onChange={e => s({ etd: e.target.value })} style={inp} />
              </Field>
              <Field label="Ngày ETA (Dự kiến đến)">
                <DateInput value={form.eta} onChange={e => s({ eta: e.target.value })} style={inp} />
              </Field>
              <Field label="Cảng đi (POL)">
                <input type="text" value={form.port_of_loading} onChange={e => s({ port_of_loading: e.target.value })}
                  placeholder="VD: Cảng Thượng Hải, Shanghai" style={inp} />
              </Field>
              <Field label="Cảng đến (POD)">
                <input type="text" value={form.port_of_discharge} onChange={e => s({ port_of_discharge: e.target.value })}
                  placeholder="VD: Cảng Hải Phòng, Cát Lái" style={inp} />
              </Field>
            </div>
          </Section>
          {/* Section 2: Tờ khai hải quan */}
          <Section title="Tờ khai hải quan">
            <div style={g3}>
              <Field label="Số tờ khai">
                <input type="text" value={form.declaration_no} onChange={e => s({ declaration_no: e.target.value })}
                  placeholder="VD: 101234567890" style={inp} />
              </Field>
              <Field label="Ngày tờ khai">
                <DateInput value={form.declaration_date} onChange={e => s({ declaration_date: e.target.value })} style={inp} />
              </Field>
              <Field label="Trạng thái thông quan">
                <select value={form.customs_status} onChange={e => s({ customs_status: e.target.value })} style={inp}>
                  {CUSTOMS_STATUSES.map(st => <option key={st}>{st}</option>)}
                </select>
              </Field>
            </div>
          </Section>
          {/* Section 3: Chi phí logistics */}
          <Section title="Chi phí logistics">
            {showAmounts ? (
            <div style={g3}>
              <Field label="Chi phí vận chuyển (VNĐ)">
                <input type="number" value={form.shipping_cost} min="0" placeholder="0"
                  onChange={e => s({ shipping_cost: e.target.value })} style={inp} />
              </Field>
              <Field label="Thuế nhập/xuất khẩu (VNĐ)">
                <input type="number" value={form.tax_amount} min="0" placeholder="0"
                  onChange={e => s({ tax_amount: e.target.value })} style={inp} />
              </Field>
              <Field label="Phí khác (VNĐ)">
                <input type="number" value={form.other_fees} min="0" placeholder="0"
                  onChange={e => s({ other_fees: e.target.value })} style={inp} />
              </Field>
            </div>
            ) : <div className="recv-masked" style={{ padding: '8px 0' }}>••• (không có quyền xem chi phí)</div>}
            {showAmounts && total > 0 && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: '#f0fdf4', borderRadius: 7, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Tổng chi phí logistics</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#15803d' }}>{fmtVND(total)} VNĐ</span>
              </div>
            )}
          </Section>
          {/* Ghi chú */}
          <Field label="Ghi chú">
            <textarea rows="2" value={form.note} onChange={e => s({ note: e.target.value })}
              placeholder="Ghi chú thêm về lô hàng..." style={{ ...inp, resize: 'vertical' }} />
          </Field>
        </div>
        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: '#f3f4f6', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Hủy</button>
          <button onClick={handleSubmit} disabled={saving}
            style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? .7 : 1 }}>
            {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm lô hàng'}
          </button>
        </div>
      </div>
    </div>
  )
}
// ── Small helpers ─────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #e5e7eb' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  )
}
function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}
const inp   = { width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
const grid3 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }
const gridCol = { display: 'grid', gridTemplateColumns: '1fr', gap: 12 }
