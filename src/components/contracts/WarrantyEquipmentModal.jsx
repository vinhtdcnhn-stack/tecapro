import { useState } from 'react'
import Modal from '../common/Modal'
import DateInput, { isoToDisplay } from './DateInput'
import useBienBanOptions, { useBienBanMap } from './useBienBanOptions'
import useBOQWarrantySource from './useBOQWarrantySource'
import { useContractPerm } from '../../context/ContractPermContext'
import { addMonths, rowWarranty } from './boqWarranty'

// ── Equipment Form Modal ──────────────────────────────────────────────────────
//
// Thiết bị bàn giao nên GẮN với một DÒNG BẢNG GIÁ: khi đó tên hàng và mốc bảo hành
// (biên bản + số tháng) lấy thẳng từ bảng giá, và sửa mốc ở đây sẽ ghi ngược vào chính
// dòng bảng giá đó (server chốt: cần quyền co.boq.manage và bảng giá chưa khóa).
// Không gắn dòng nào thì giữ cách cũ — tự nhập tên, tự đặt mốc bảo hành riêng.

export default function EquipmentModal({ contractId, item, onSave, onClose }) {
  const isEdit = !!item
  const [form, setForm] = useState({
    name: item?.name||'', brand: item?.brand||'', model: item?.model||'',
    quantity: item?.quantity||1, location: item?.location||'',
    warranty_from: item?.warranty_from?.slice(0,10)||'',
    warranty_to: item?.warranty_to?.slice(0,10)||'',
    has_serial: item?.has_serial||false, note: item?.note||'',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  // Dòng bảng giá đang gắn ('' = không gắn, tự nhập).
  const [boqId, setBoqId] = useState(item?.boq_id != null ? String(item.boq_id) : '')
  // Nguồn "BH từ": '' = nhập ngày trực tiếp, còn lại = id biên bản (lấy ngày thực tế của BB).
  const [fromSource, setFromSource] = useState(item?.warranty_bb_id != null ? String(item.warranty_bb_id) : '')
  // Cách nhập "BH đến": 'manual' = nhập ngày, 'months' = số tháng cộng từ BH từ.
  const [toMode, setToMode] = useState(item?.warranty_months != null ? 'months' : 'manual')
  // Số tháng bảo hành — tự cộng vào BH từ ra BH đến.
  const [months, setMonths] = useState(item?.warranty_months != null ? String(item.warranty_months) : '')

  const bbList = useBienBanOptions(contractId)     // biên bản (tab Tiến độ) làm mốc BH
  const bbById = useBienBanMap(bbList)
  const boqSrc = useBOQWarrantySource(contractId)  // dòng bảng giá + mốc BH mặc định + khóa
  const { canManage } = useContractPerm()

  const linked   = boqId !== ''
  const leaf     = linked ? boqSrc.byId.get(boqId) : null
  // Gắn bảng giá ⇒ mốc BH là của bảng giá; chỉ sửa được khi bảng giá mở và có quyền ghi bảng giá.
  const canWriteBOQ = !boqSrc.boqLocked && canManage('co.boq.manage')
  const wtyLocked   = linked && !canWriteBOQ
  const lockNote    = boqSrc.boqLocked
    ? 'Bảng giá đang khóa — mở khóa bảng giá mới sửa được mốc bảo hành.'
    : 'Bạn không có quyền sửa bảng giá nên không đổi được mốc bảo hành ở đây.'

  // Ngày BH hiệu lực được TÍNH LẠI mỗi lần mở, không lấy cặp ngày đã lưu:
  //   - Mốc là biên bản → BH từ = ngày THỰC TẾ hiện tại của biên bản đó.
  //   - Tính theo số tháng → BH đến = BH từ + số tháng.
  // Đây cũng chính là cặp ngày ghi xuống DB khi bấm Lưu.
  const bb = fromSource ? bbList.find(b => b.id === fromSource) : null
  const fromEff = fromSource ? (bb?.date || '') : form.warranty_from
  const monthsMode = linked || toMode === 'months'
  const toEff = monthsMode
    ? (fromEff && months !== '' ? addMonths(fromEff, months) : '')
    : form.warranty_to
  // Tên: gắn bảng giá thì đọc theo dòng bảng giá (server cũng ghi đè như vậy khi lưu).
  const nameEff = linked ? (leaf?.item_name ?? item?.boq_item_name ?? form.name) : form.name

  const s = f => setForm(p=>({...p,...f}))

  // Chọn dòng bảng giá → nạp mốc BH hiệu lực của dòng đó (dòng trống thì theo mặc định cấp HĐ).
  function pickBoq(val) {
    setBoqId(val)
    if (!val) return
    const row = boqSrc.byId.get(val)
    const w = rowWarranty(row, boqSrc.defaults, bbById)
    setFromSource(w.bbId || '')
    setMonths(w.months != null ? String(w.months) : '')
    setToMode('months')
    setErr('')
    if (!isEdit && row?.quantity) s({ quantity: row.quantity })
  }

  async function handleSubmit() {
    if (!linked && !form.name.trim()) { setErr('Tên thiết bị không được để trống'); return }
    if (linked && !leaf && !isEdit) { setErr('Dòng bảng giá không hợp lệ'); return }
    setSaving(true)
    // Gửi kèm nguồn tính BH để mở lại sửa còn đủ thông tin (dòng bảng giá + biên bản + số tháng).
    await onSave({
      ...form,
      name: nameEff,
      boq_id: boqId || null,
      warranty_from: fromEff || null,
      warranty_to: toEff || null,
      warranty_bb_id: fromSource || null,
      warranty_months: monthsMode && months !== '' ? parseInt(months, 10) : null,
    }, isEdit)
    setSaving(false)
  }

  return (
    <Modal
      onClose={onClose}
      overlayClassName="wty-modal-overlay"
      contentClassName="wty-modal"
      labelledBy="wty-equip-title"
    >
        <div className="wty-modal-header">
          <h3 id="wty-equip-title">{isEdit ? 'Cập nhật thiết bị' : 'Thêm thiết bị bàn giao'}</h3>
          <button className="wty-modal-close" onClick={onClose} aria-label="Đóng">✕</button>
        </div>
        <div className="wty-modal-body">
          <div className="wty-form-row">
            <div className="wty-form-group full">
              <label>Lấy từ bảng giá</label>
              <select value={boqId} onChange={e => pickBoq(e.target.value)}>
                <option value="">— Không gắn: tự nhập tên và mốc bảo hành —</option>
                {/* Đang tải bảng giá mà thiết bị đã gắn sẵn → giữ chỗ để ô không bị trống */}
                {linked && !leaf && <option value={boqId}>{nameEff || 'Đang tải dòng bảng giá...'}</option>}
                {boqSrc.leaves.map(r => (
                  <option key={r.id} value={String(r.id)}>
                    {r.item_name}{r.unit ? ` (${r.unit})` : ''}
                  </option>
                ))}
              </select>
              <span className="wty-form-hint">
                {linked
                  ? 'Tên thiết bị và mốc bảo hành lấy theo dòng bảng giá; sửa mốc ở đây sẽ cập nhật lại dòng bảng giá đó.'
                  : boqSrc.loading ? 'Đang tải bảng giá...'
                  : boqSrc.leaves.length === 0 ? 'Bảng giá chưa có dòng hàng nào — nhập tay tên thiết bị bên dưới.'
                  : 'Chọn dòng hàng trong bảng giá để tên và hạn bảo hành luôn khớp với hợp đồng.'}
              </span>
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group full">
              <label>Tên thiết bị *</label>
              {linked
                ? <div className="wty-readonly">{nameEff || '(dòng bảng giá chưa có tên)'}</div>
                : <input className={err?'err':''} value={form.name} onChange={e=>s({name:e.target.value})} placeholder="VD: Rectifier, UPS, Pin Lithium..." />}
              {err && <span className="wty-form-err">{err}</span>}
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group">
              <label>Hãng sản xuất</label>
              <input value={form.brand} onChange={e=>s({brand:e.target.value})} placeholder="VD: Megmeet, ABB..." />
            </div>
            <div className="wty-form-group">
              <label>Model</label>
              <input value={form.model} onChange={e=>s({model:e.target.value})} placeholder="VD: R483000G1..." />
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group">
              <label>Số lượng</label>
              <input type="number" min="0.01" step="0.01" value={form.quantity} onChange={e=>s({quantity:e.target.value})} />
            </div>
            <div className="wty-form-group">
              <label>Vị trí lắp đặt</label>
              <input value={form.location} onChange={e=>s({location:e.target.value})} placeholder="VD: Tầng 3, Rack A..." />
            </div>
          </div>
          <div className="wty-form-row">
            <div className="wty-form-group">
              <label>Bảo hành từ</label>
              <div className="wty-datecell">
                <select value={fromSource} onChange={e => setFromSource(e.target.value)} disabled={wtyLocked}>
                  <option value="">{linked ? '— Chưa chọn biên bản —' : 'Nhập ngày'}</option>
                  {bbList.map(b => <option key={b.id} value={b.id}>BB: {b.label}</option>)}
                </select>
                {fromSource || linked
                  ? <span className={`wty-dc-resolved${fromEff ? '' : ' empty'}`}>
                      → BH từ: {isoToDisplay(fromEff) || (fromSource ? 'biên bản chưa có ngày thực tế' : 'chưa chọn biên bản')}
                    </span>
                  : <DateInput value={form.warranty_from} onChange={e=>s({warranty_from:e.target.value})} />}
              </div>
            </div>
            <div className="wty-form-group">
              <label>Bảo hành đến</label>
              <div className="wty-datecell">
                {!linked && (
                  <select value={toMode} onChange={e => setToMode(e.target.value)}>
                    <option value="manual">Nhập ngày</option>
                    <option value="months">Theo số tháng</option>
                  </select>
                )}
                {monthsMode ? (
                  <>
                    <div className="wty-dc-row">
                      <input className="wty-dc-days" type="number" min="0" step="1" disabled={wtyLocked}
                        value={months} onChange={e=>setMonths(e.target.value)} placeholder="0" />
                      <span className="wty-dc-unit">tháng kể từ BH từ</span>
                    </div>
                    <span className={`wty-dc-resolved${toEff ? '' : ' empty'}`}>
                      → BH đến: {isoToDisplay(toEff) || (fromEff ? 'nhập số tháng' : 'chưa có ngày BH từ')}
                    </span>
                  </>
                ) : (
                  <DateInput value={form.warranty_to} onChange={e=>s({warranty_to:e.target.value})} />
                )}
              </div>
            </div>
          </div>
          {wtyLocked && <div className="wty-form-row"><span className="wty-form-hint warn">🔒 {lockNote}</span></div>}
          <div className="wty-form-row">
            <div className="wty-form-group">
              <label>Có serial?</label>
              <select value={form.has_serial?'1':'0'} onChange={e=>s({has_serial:e.target.value==='1'})}>
                <option value="1">Có — quản lý theo serial</option>
                <option value="0">Không — chỉ quản lý số lượng</option>
              </select>
            </div>
            <div className="wty-form-group">
              <label>Ghi chú</label>
              <input value={form.note} onChange={e=>s({note:e.target.value})} placeholder="Ghi chú thêm..." />
            </div>
          </div>
        </div>
        <div className="wty-modal-footer">
          <button className="wty-modal-btn cancel" onClick={onClose}>Hủy</button>
          <button className="wty-modal-btn save" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm thiết bị'}
          </button>
        </div>
    </Modal>
  )
}
