import { useState } from 'react'

import { CLAIM_STATUSES, fmtDateInput, inputStyle } from './supplierWarrantyUtils'

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

// ── Bulk update modal ─────────────────────────────────────────────────────────

export function BulkUpdateModal({ count, onSave, onClose }) {
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

export function WarrantyModal({ warranty, onSave, onClose }) {
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

export function ClaimModal({ claim, warranties, onSave, onClose }) {
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
