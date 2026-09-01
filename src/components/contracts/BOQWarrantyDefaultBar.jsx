import { useState } from 'react'
import { normMonths, addMonths } from './boqWarranty'
import { isoToDisplay } from './DateInput'

// Mốc bảo hành MẶC ĐỊNH của cả bảng giá: chọn 1 biên bản + số tháng, áp cho mọi dòng
// chưa điền riêng. Dòng nào cần khác thì tự điền ở cột "Thời hạn bảo hành" của dòng đó.
//
// value: { bbId, months } — null nghĩa là chưa đặt.
// onSave({ bbId, months }) — lưu ngay khi đổi (select) / khi rời ô (số tháng).
export default function BOQWarrantyDefaultBar({ bbList, value, onSave, disabled = false }) {
  const [months, setMonths] = useState(value?.months != null ? String(value.months) : '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Số tháng từ server về SAU lần render đầu (tab tải xong hợp đồng) → chỉnh state
  // ngay trong lúc render, không dùng effect (tránh cascading render).
  const [seenMonths, setSeenMonths] = useState(value?.months ?? null)
  if ((value?.months ?? null) !== seenMonths) {
    setSeenMonths(value?.months ?? null)
    setMonths(value?.months != null ? String(value.months) : '')
  }

  const bbId = value?.bbId != null ? String(value.bbId) : ''
  const bb   = bbId ? bbList.find(b => b.id === bbId) : null

  const commit = async (next) => {
    setSaving(true); setErr('')
    try { await onSave(next) }
    catch (e) { setErr(e.message || 'Không lưu được') }
    finally { setSaving(false) }
  }

  const onPickBB = (v) => commit({ bbId: v || null, months: normMonths(months) })

  const onBlurMonths = () => {
    const n = normMonths(months)
    if (n === (value?.months ?? null)) return
    commit({ bbId: bbId || null, months: n })
  }

  // Xem trước khoảng bảo hành mặc định để biết mình vừa đặt ra ngày nào.
  const from = bb?.date || ''
  const to   = from && normMonths(months) != null ? addMonths(from, normMonths(months)) : ''

  return (
    <div className="bwty-default">
      <span className="bwty-default-label" title="Áp cho mọi dòng chưa tự đặt mốc/số tháng bảo hành">
        Mốc BH mặc định:
      </span>
      <select value={bbId} disabled={disabled || saving} onChange={e => onPickBB(e.target.value)}>
        <option value="">— chưa chọn biên bản —</option>
        {bbList.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
      </select>
      <input
        className="bwty-default-months"
        type="number" min="0" max="1200" step="1"
        value={months}
        disabled={disabled || saving}
        onChange={e => setMonths(e.target.value)}
        onBlur={onBlurMonths}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        placeholder="0"
      />
      <span className="bwty-default-unit">tháng</span>
      {to
        ? <span className="bwty-default-preview">→ {isoToDisplay(from)} – {isoToDisplay(to)}</span>
        : bb && !from
          ? <span className="bwty-default-preview empty">biên bản chưa có ngày thực tế</span>
          : null}
      {saving && <span className="bwty-default-preview">đang lưu…</span>}
      {err && <span className="bwty-default-err">{err}</span>}
    </div>
  )
}
