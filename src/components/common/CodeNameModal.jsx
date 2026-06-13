import { useState, useEffect } from 'react'
import Modal from './Modal'

// Modal thêm/sửa cho danh mục đơn giản chỉ gồm Mã + Tên (phòng ban, vị trí...).
export default function CodeNameModal({
  isOpen,
  onClose,
  onSave,
  item = null,
  titleAdd = 'THÊM',
  titleEdit = 'SỬA',
  codeLabel = 'Mã',
  nameLabel = 'Tên',
  labelledBy = 'codename-modal-title',
}) {
  const isEdit = !!item
  const [form, setForm] = useState({ code: '', name: '' })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đồng bộ form từ prop item khi mở modal sửa
    setForm({ code: item?.code || '', name: item?.name || '' })
  }, [item, isOpen])

  function close() { onClose(); setForm({ code: '', name: '' }) }

  async function handleSubmit() {
    if (!form.code.trim() || !form.name.trim()) {
      alert(`Vui lòng nhập ${codeLabel.toLowerCase()} và ${nameLabel.toLowerCase()}!`)
      return
    }
    await onSave(form, isEdit)
  }

  return (
    <Modal isOpen={isOpen} onClose={close} labelledBy={labelledBy}>
      <div className="modal-header">
        <h2 id={labelledBy}>{isEdit ? titleEdit : titleAdd}</h2>
        <button className="close-btn" onClick={close} aria-label="Đóng">✕</button>
      </div>

      <div className="modal-body">
        <div className="field">
          <label>{codeLabel} <span style={{ color: 'red' }}>*</span></label>
          <input
            type="text"
            value={form.code}
            onChange={(e) => setForm(prev => ({ ...prev, code: e.target.value }))}
            placeholder={`Nhập ${codeLabel.toLowerCase()}`}
          />
        </div>

        <div className="field">
          <label>{nameLabel} <span style={{ color: 'red' }}>*</span></label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder={`Nhập ${nameLabel.toLowerCase()}`}
          />
        </div>
      </div>

      <div className="modal-footer">
        <button className="cancel-btn" onClick={close}>Hủy</button>
        <button className="save-btn" onClick={handleSubmit}>{isEdit ? 'Cập nhật' : 'Lưu'}</button>
      </div>
    </Modal>
  )
}
