import { useState } from 'react'
import DateInput from './DateInput'

import { API } from '../../config/api'
import { CURRENCIES, PURCHASE_TYPES, STATUSES, statusCfg } from './contractInUtils'

// ── Thông tin tab (edit form) ─────────────────────────────────────────────────

export default function ContractInInfoTab({ item, suppliers, onUpdate, onDelete }) {
  const [form, setForm] = useState({
    contract_no:   item.contract_no   || '',
    goods_type:    item.goods_type    || '',
    contract_date: item.contract_date?.slice(0, 10) || '',
    supplier_id:   item.supplier_id   || '',
    amount:        item.amount        || '',
    currency_code: item.currency_code || 'VND',
    exchange_rate: item.exchange_rate || '',
    purchase_type: item.purchase_type || 'Trong nước',
    status:        item.status        || 'Active',
    note:          item.note          || '',
  })
  const [saving, setSaving] = useState(false)

  const s = f => setForm(p => ({ ...p, ...f }))

  async function handleSave() {
    setSaving(true)
    try {
      const res  = await fetch(`${API}/contract-ins/${item.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Lỗi lưu'); return }
      onUpdate(data)
      alert('Cập nhật thành công!')
    } catch (e) { alert('Lỗi: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', margin: 0 }}>Thông tin hợp đồng nhập</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => onDelete(item)}
            style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#b91c1c', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
          >
            Xóa HĐ nhập
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
          >
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>

      <div className="contract-form-section">
        <div className="form-row">
          <div className="form-group">
            <label>Số hợp đồng nhập</label>
            <input type="text" value={form.contract_no}
              onChange={e => s({ contract_no: e.target.value })}
              placeholder="VD: HD-NCC-2026-001" />
          </div>
          <div className="form-group">
            <label>Ngày hợp đồng</label>
            <DateInput value={form.contract_date}
              onChange={e => s({ contract_date: e.target.value })} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group full-width">
            <label>Loại hàng hóa</label>
            <input type="text" value={form.goods_type}
              onChange={e => s({ goods_type: e.target.value })}
              placeholder="VD: Thiết bị điện, Cáp nguồn, Phần mềm bản quyền..." />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group full-width">
            <label>Nhà cung cấp (Supplier)</label>
            <select value={form.supplier_id} onChange={e => s({ supplier_id: e.target.value })}>
              <option value="">-- Chọn nhà cung cấp --</option>
              {suppliers.map(sp => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}{sp.code ? ` (${sp.code})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label>Giá trị hợp đồng</label>
            <input type="number" value={form.amount} min="0"
              onChange={e => s({ amount: e.target.value })} placeholder="0" />
          </div>
          <div className="form-group">
            <label>Đơn vị tiền tệ</label>
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
              {STATUSES.map(st => (
                <option key={st} value={st}>{statusCfg[st]?.label || st}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group full-width">
            <label>Ghi chú</label>
            <textarea rows="3" value={form.note}
              onChange={e => s({ note: e.target.value })}
              placeholder="Ghi chú thêm về hợp đồng nhập..." />
          </div>
        </div>
      </div>
    </div>
  )
}
