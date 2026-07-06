import { useState } from 'react'
import NumberInput from '../common/NumberInput'
import { stripNum } from './boqUtils'
import { targetKey } from './usePurchaseBOQLink'

// Ô "Nhập cho" của 1 dòng bảng giá mua — THEO HĐ bán đang xem (context-scoped).
// 1 HĐ nhập nhập cho nhiều HĐ bán; đứng ở HĐ bán nào thì cột này chỉ hiện/sửa ghép của HĐ bán đó.
//  - `allLinks`: TẤT CẢ ghép của dòng (mọi HĐ bán, kèm contract_out_id) — lọc ra ghép của HĐ
//    bán đang xem để hiển thị, phần còn lại (HĐ bán khác) chỉ tính vào tổng để chặn quá nhập.
//  - `rowQuantity`: SL mua của dòng → tổng SL phủ (mọi HĐ bán) không được vượt quá.
// Mọi thay đổi build lại mảng ghép của RIÊNG HĐ bán đang xem rồi gọi onChange để cha lưu.
export default function PurchaseSupplyLinks({
  allLinks = [], targets = [], viewContractId, rowQuantity = 0, disabled = false, onChange,
}) {
  const [draftQty, setDraftQty] = useState({})
  const [active, setActive] = useState(false)

  const inView = (l) => String(l.contract_out_id) === String(viewContractId)
  const links = allLinks.filter(inView)                 // ghép của HĐ bán đang xem (sửa được)
  const otherCovered = allLinks.filter(l => !inView(l)) // SL phủ đã gán cho HĐ bán khác (giữ nguyên)
    .reduce((a, l) => a + (Number(l.covered_qty) || 0), 0)

  const hasCap = rowQuantity > 0
  const effQty = (l) => {
    const k = targetKey(l.boq_id, l.slot_id)
    return draftQty[k] !== undefined ? (parseFloat(draftQty[k]) || 0) : (Number(l.covered_qty) || 0)
  }
  const currentCovered = links.reduce((a, l) => a + effQty(l), 0)
  const remaining = hasCap ? rowQuantity - otherCovered - currentCovered : Infinity  // còn nhập được

  const usedKeys = new Set(links.map(l => targetKey(l.boq_id, l.slot_id)))
  const available = targets.filter(t => !usedKeys.has(targetKey(t.boq_id, t.slot_id)))

  // Gửi lên cha mảng ghép của RIÊNG HĐ bán đang xem.
  const emit = (nextLinks) =>
    onChange(nextLinks.map(l => ({ boq_id: l.boq_id, slot_id: l.slot_id, covered_qty: l.covered_qty })))

  const addTarget = (key) => {
    if (!key) return
    const t = targets.find(x => targetKey(x.boq_id, x.slot_id) === key)
    if (!t) return
    const needRemain = Math.max(0, (Number(t.needed) || 0) - (Number(t.covered) || 0))
    const capRemain = hasCap ? Math.max(0, rowQuantity - otherCovered - currentCovered) : Infinity
    const qty = Math.min(needRemain, capRemain)
    emit([...links, { boq_id: t.boq_id, slot_id: t.slot_id, covered_qty: qty }])
  }

  const removeLink = (key) => {
    emit(links.filter(l => targetKey(l.boq_id, l.slot_id) !== key))
    setDraftQty(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  const commitQty = (key) => {
    const raw = draftQty[key]
    if (raw === undefined) return
    let v = parseFloat(raw) || 0
    // Chặn quá nhập: kẹp v để tổng (HĐ khác + HĐ này) không vượt SL mua của dòng.
    if (hasCap) {
      const otherInView = links.filter(l => targetKey(l.boq_id, l.slot_id) !== key)
        .reduce((a, l) => a + effQty(l), 0)
      const maxV = Math.max(0, rowQuantity - otherCovered - otherInView)
      if (v > maxV) v = maxV
    }
    setDraftQty(prev => { const n = { ...prev }; delete n[key]; return n })
    const cur = links.find(l => targetKey(l.boq_id, l.slot_id) === key)
    if (!cur || (Number(cur.covered_qty) || 0) === v) return
    emit(links.map(l => targetKey(l.boq_id, l.slot_id) === key ? { ...l, covered_qty: v } : l))
  }

  if (disabled) {
    return <span className="boq-masked" title="Lưu dòng trước khi gán">—</span>
  }

  const showAdd = available.length > 0 && (links.length === 0 || active)
  const over = hasCap && remaining < -1e-9

  return (
    <div className="supply-links"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setActive(false) }}>
      {links.map(l => {
        const key = targetKey(l.boq_id, l.slot_id)
        const t = targets.find(x => targetKey(x.boq_id, x.slot_id) === key)
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

      {hasCap && (links.length > 0 || otherCovered > 0) && (
        <div className="supply-remaining" style={{ fontSize: 11, color: over ? '#b91c1c' : '#6b7280', marginTop: 2 }}>
          {over
            ? `Vượt SL mua ${stripNum(rowQuantity)} (đã nhập cho ${stripNum(otherCovered + currentCovered)})`
            : `Còn nhập được: ${stripNum(Math.max(0, remaining))}/${stripNum(rowQuantity)}`}
          {otherCovered > 0 && <span title="Đã nhập cho HĐ bán khác"> · HĐ khác: {stripNum(otherCovered)}</span>}
        </div>
      )}

      {links.length === 0 && available.length === 0 && (
        <span className="boq-masked">— Chưa gán —</span>
      )}
    </div>
  )
}
