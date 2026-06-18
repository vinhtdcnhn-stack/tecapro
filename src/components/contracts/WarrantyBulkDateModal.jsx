import { useState } from 'react'
import Modal from '../common/Modal'
import DateInput, { isoToDisplay } from './DateInput'
import useBienBanOptions from './useBienBanOptions'

// Modal đặt BH từ / BH đến cho nhiều dòng. Để trống trường nào thì giữ nguyên trường đó.
// Cùng nguyên tắc với modal sửa 1 thiết bị:
//   - BH từ: nhập ngày trực tiếp hoặc theo biên bản (ngày thực tế).
//   - BH đến: nhập ngày, hoặc số tháng — server cộng từ BH từ (mới hoặc của từng dòng).
export default function WarrantyBulkDateModal({ contractId, count, onClose, onApply }) {
  const [from, setFrom]     = useState('')        // iso 'BH từ'
  const [to, setTo]         = useState('')        // iso 'BH đến' (chế độ nhập ngày)
  const [fromSource, setFromSource] = useState('') // '' = nhập ngày, còn lại = id biên bản
  const [toMode, setToMode] = useState('manual')   // 'manual' | 'months'
  const [months, setMonths] = useState('')
  const [saving, setSaving] = useState(false)
  const bbList = useBienBanOptions(contractId)

  function handleFromSource(val) {
    setFromSource(val)
    if (val) {
      const bb = bbList.find(b => b.id === val)
      setFrom(bb ? bb.date : '')
    }
  }

  async function apply() {
    const useMonths = toMode === 'months' && months !== ''
    if (!from && !to && !useMonths) {
      alert('Nhập ít nhất một trong: BH từ, BH đến, hoặc số tháng bảo hành.')
      return
    }
    const payload = {}
    if (from) {
      payload.warranty_from = from
      // biên bản → lưu mốc; nhập ngày trực tiếp → xóa mốc biên bản cũ.
      payload.warranty_bb_id = fromSource || null
    }
    if (useMonths) payload.warranty_months = parseInt(months, 10)
    else if (to) payload.warranty_to = to
    setSaving(true)
    await onApply(payload)
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
            <div className="wty-form-group">
              <label>Bảo hành từ</label>
              <div className="wty-datecell">
                <select value={fromSource} onChange={e => handleFromSource(e.target.value)}>
                  <option value="">Nhập ngày</option>
                  {bbList.map(b => <option key={b.id} value={b.id}>BB: {b.label}</option>)}
                </select>
                {fromSource
                  ? <span className={`wty-dc-resolved${from ? '' : ' empty'}`}>→ {isoToDisplay(from) || '—'}</span>
                  : <DateInput value={from} onChange={e => setFrom(e.target.value)} />}
              </div>
            </div>
            <div className="wty-form-group">
              <label>Bảo hành đến</label>
              <div className="wty-datecell">
                <select value={toMode} onChange={e => setToMode(e.target.value)}>
                  <option value="manual">Nhập ngày</option>
                  <option value="months">Theo số tháng</option>
                </select>
                {toMode === 'months' ? (
                  <div className="wty-dc-row">
                    <input className="wty-dc-days" type="number" min="0" step="1"
                      value={months} onChange={e => setMonths(e.target.value)} placeholder="0" />
                    <span className="wty-dc-unit">tháng kể từ BH từ của mỗi dòng</span>
                  </div>
                ) : (
                  <DateInput value={to} onChange={e => setTo(e.target.value)} />
                )}
              </div>
            </div>
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
