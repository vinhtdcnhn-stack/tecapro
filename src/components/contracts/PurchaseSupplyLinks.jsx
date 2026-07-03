import { useState } from 'react'
import NumberInput from '../common/NumberInput'
import { stripNum } from './boqUtils'
import { targetKey } from './usePurchaseBOQLink'

// Ô "Nhập cho" của 1 dòng bảng giá mua: danh sách xếp dọc các đầu bán đã gán
// (mỗi dòng = tên đầu bán + SL phủ + nút ✕) + dropdown "+ thêm đầu bán".
// 1 dòng nhập gộp có thể nhập cho NHIỀU đầu bán (trùng ở các phần/hệ thống khác nhau).
// `links` do cha kiểm soát; mọi thay đổi build lại mảng đầy đủ và gọi onChange để cha lưu.
export default function PurchaseSupplyLinks({ links = [], targets = [], disabled = false, onChange }) {
  // SL phủ đang gõ theo targetKey (commit onBlur). Tách khỏi links để gõ mượt.
  const [draftQty, setDraftQty] = useState({})
  // Ô "+ thêm đầu bán" chỉ hiện khi đang thao tác trong ô (hover / focus-within),
  // hoặc khi chưa có đầu bán nào (cần chỗ để bắt đầu gán). Rời ô thì ẩn đi cho gọn.
  const [active, setActive] = useState(false)

  const usedKeys = new Set(links.map(l => targetKey(l.boq_id, l.slot_id)))
  const available = targets.filter(t => !usedKeys.has(targetKey(t.boq_id, t.slot_id)))

  const addTarget = (key) => {
    if (!key) return
    const t = targets.find(x => targetKey(x.boq_id, x.slot_id) === key)
    if (!t) return
    const remaining = Math.max(0, (Number(t.needed) || 0) - (Number(t.covered) || 0))
    onChange([...links, { boq_id: t.boq_id, slot_id: t.slot_id, covered_qty: remaining }])
  }

  const removeLink = (key) => {
    onChange(links.filter(l => targetKey(l.boq_id, l.slot_id) !== key))
    setDraftQty(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  const commitQty = (key) => {
    const raw = draftQty[key]
    if (raw === undefined) return
    const v = parseFloat(raw) || 0
    setDraftQty(prev => { const n = { ...prev }; delete n[key]; return n })
    const cur = links.find(l => targetKey(l.boq_id, l.slot_id) === key)
    if (!cur || (Number(cur.covered_qty) || 0) === v) return
    onChange(links.map(l => targetKey(l.boq_id, l.slot_id) === key ? { ...l, covered_qty: v } : l))
  }

  if (disabled) {
    return <span className="boq-masked" title="Lưu dòng trước khi gán">—</span>
  }

  const showAdd = available.length > 0 && (links.length === 0 || active)

  return (
    <div className="supply-links"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setActive(false) }}>
      {links.map(l => {
        const key = targetKey(l.boq_id, l.slot_id)
        const t = targets.find(x => targetKey(x.boq_id, x.slot_id) === key)
        // covered_qty về từ DB là numeric(18,4) ("4.0000") → stripNum bỏ số 0 thừa
        // để hiển thị gọn "4" (vẫn giữ phần thập phân thực như "4,5"), khớp cột Số lượng.
        const qtyVal = draftQty[key] !== undefined ? draftQty[key] : stripNum(l.covered_qty)
        return (
          <div className="supply-link-item" key={key}>
            <span className="supply-link-label" title={t?.label || 'Đầu bán không còn tồn tại'}>
              {t?.label || '(đầu bán đã xóa)'}
            </span>
            <span className="supply-qtywrap">
              <NumberInput value={qtyVal}
                onChange={v => setDraftQty(prev => ({ ...prev, [key]: v }))}
                onBlur={() => commitQty(key)}
                placeholder="SL phủ" className="supply-qty" />
              {t?.unit && <span className="supply-unit">{t.unit}</span>}
            </span>
            <button type="button" className="supply-link-remove" title="Bỏ ghép đầu bán này"
              onClick={() => removeLink(key)}>×</button>
          </div>
        )
      })}

      {showAdd && (
        <select className="supply-select supply-link-add" value="" title="Thêm đầu bán để nhập cho"
          onChange={e => { addTarget(e.target.value); e.target.value = '' }}>
          <option value="">+ thêm đầu bán…</option>
          {available.map(t => {
            const k = targetKey(t.boq_id, t.slot_id)
            return <option key={k} value={k}>{t.label}</option>
          })}
        </select>
      )}

      {links.length === 0 && available.length === 0 && (
        <span className="boq-masked">— Chưa gán —</span>
      )}
    </div>
  )
}
