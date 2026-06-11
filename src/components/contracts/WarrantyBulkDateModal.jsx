import { useState } from 'react'
import Modal from '../common/Modal'
import DateInput from './DateInput'

// Modal đặt BH từ / BH đến cho nhiều dòng. Để trống trường nào thì giữ nguyên trường đó.
export default function WarrantyBulkDateModal({ count, onClose, onApply }) {
  const [from, setFrom] = useState('')
  const [to, setTo]     = useState('')
  const [saving, setSaving] = useState(false)

  async function apply() {
    if (!from && !to) { alert('Nhập ít nhất một trong hai ngày (BH từ / BH đến).'); return }
    setSaving(true)
    await onApply({ warranty_from: from || undefined, warranty_to: to || undefined })
    setSaving(false)
  }

  return (
    <Modal
      onClose={onClose}
      overlayClassName="wty-modal-overlay"
      contentClassName="wty-modal"
      labelledBy="wty-bulk-title"
    >
        <div className="wty-modal-header">
          <h3 id="wty-bulk-title">Sửa bảo hành hàng loạt</h3>
          <button className="wty-modal-close" onClick={onClose} aria-label="Đóng">✕</button>
        </div>
        <div className="wty-modal-body">
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
            Áp dụng cho <strong>{count}</strong> dòng đã chọn. Để trống trường nào thì giữ nguyên trường đó.
          </p>
          <div className="wty-form-row">
            <div className="wty-form-group"><label>Bảo hành từ</label>
              <DateInput value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div className="wty-form-group"><label>Bảo hành đến</label>
              <DateInput value={to} onChange={e => setTo(e.target.value)} /></div>
          </div>
        </div>
        <div className="wty-modal-footer">
          <button className="wty-modal-btn cancel" onClick={onClose}>Hủy</button>
          <button className="wty-modal-btn save" onClick={apply} disabled={saving}>
            {saving ? 'Đang cập nhật...' : `Cập nhật ${count} dòng`}
          </button>
        </div>
    </Modal>
  )
}
