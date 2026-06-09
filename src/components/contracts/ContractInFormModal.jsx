import { useState } from 'react'
import DateInput from './DateInput'
import CustomerSelect from '../common/CustomerSelect'

import { CURRENCIES, PURCHASE_TYPES, STATUSES, statusCfg } from './contractInUtils'

// ── Modal thêm HĐ nhập mới ────────────────────────────────────────────────────

export default function ContractInFormModal({ suppliers, onSave, onClose }) {
  const [form, setForm] = useState({
    contract_no: '', goods_type: '', contract_date: '',
    supplier_id: '', amount: '', currency_code: 'VND',
    exchange_rate: '', purchase_type: 'Trong nước', status: 'Active', note: '',
  })
  const [saving, setSaving] = useState(false)
  const s = f => setForm(p => ({ ...p, ...f }))

  async function handleSubmit() {
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal contract-modal" style={{ width: 680, maxWidth: '95vw' }}>
        <div className="modal-header">
          <h2>THÊM HỢP ĐỒNG NHẬP</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="contract-form-section">
            <div className="form-row">
              <div className="form-group">
                <label>Số hợp đồng nhập</label>
                <input type="text" value={form.contract_no} onChange={e => s({ contract_no: e.target.value })} placeholder="VD: HD-NCC-2026-001" />
              </div>
              <div className="form-group">
                <label>Ngày hợp đồng</label>
                <DateInput value={form.contract_date} onChange={e => s({ contract_date: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group full-width">
                <label>Loại hàng hóa</label>
                <input type="text" value={form.goods_type} onChange={e => s({ goods_type: e.target.value })} placeholder="VD: Thiết bị điện, Phần mềm bản quyền..." />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group full-width">
                <label>Nhà cung cấp</label>
                <CustomerSelect
                  customers={suppliers}
                  selectedId={form.supplier_id}
                  onChange={id => s({ supplier_id: id })}
                  placeholder="-- Chọn nhà cung cấp --"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label>Giá trị hợp đồng</label>
                <input type="text" value="Tự động từ bảng giá nhập" readOnly disabled
                  title="Giá trị HĐ nhập được tính tự động từ tổng bảng giá mua sau khi nhập bảng giá"
                  style={{ fontStyle: 'italic', color: '#6b7280' }} />
              </div>
              <div className="form-group">
                <label>Tiền tệ</label>
                <select value={form.currency_code} onChange={e => s({ currency_code: e.target.value })}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Tỷ giá</label>
                <input type="number" value={form.exchange_rate} min="0" step="0.0001"
                  placeholder={form.currency_code === 'VND' ? '1' : 'Nhập tỷ giá'}
                  onChange={e => s({ exchange_rate: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Loại mua hàng</label>
                <select value={form.purchase_type} onChange={e => s({ purchase_type: e.target.value })}>
                  {PURCHASE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Trạng thái</label>
                <select value={form.status} onChange={e => s({ status: e.target.value })}>
                  {STATUSES.map(st => <option key={st} value={st}>{statusCfg[st]?.label || st}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group full-width">
                <label>Ghi chú</label>
                <textarea rows="3" value={form.note} onChange={e => s({ note: e.target.value })} placeholder="Ghi chú thêm..." />
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>Hủy</button>
          <button className="save-btn" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  )
}
