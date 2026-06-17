import { useState } from 'react'
import { API } from '../../../config/api'
import Modal from '../../common/Modal'
import DateInput, { isoToDisplay } from '../../contracts/DateInput'
import { statusInfo, fmtMoney } from '../approvalUtils'

const fmtDT = (s) => (s ? new Date(s).toLocaleString('vi-VN') : '')

// Định dạng 1 ô của trường "Bảng" theo kiểu cột.
function fmtCellVal(col, v) {
  if (v == null || v === '') return ''
  if (col.type === 'date') return isoToDisplay(v)
  if (col.type === 'money') return Number(v).toLocaleString('vi-VN')
  return String(v)
}

// Định dạng giá trị 1 trường form về chuỗi để ghi vào ô Excel.
function fmtExportValue(field, v) {
  if (v == null || v === '') return ''
  switch (field.field_type) {
    case 'date': return isoToDisplay(v)
    case 'date_range': return (v.from || v.to) ? `${isoToDisplay(v.from)} → ${isoToDisplay(v.to)}` : ''
    case 'checkbox': return v ? 'Có' : 'Không'
    case 'money': return fmtMoney(v, field.config?.currency)
    case 'table': {
      const cols = field.config?.columns || []
      const list = Array.isArray(v) ? v : []
      return list.map(r => cols.map(c => `${c.label}: ${fmtCellVal(c, r[c.key])}`).join(', ')).join('\n')
    }
    default: return String(v)
  }
}

// Modal: admin chọn khoảng thời gian rồi tải dữ liệu đơn của loại đơn ra Excel.
// Ngầm định 1/1 → 31/12 năm hiện tại. Lọc theo ngày tạo đơn.
export default function FormExportModal({ form, onClose }) {
  const year = new Date().getFullYear()
  const [from, setFrom] = useState(`${year}-01-01`)
  const [to, setTo] = useState(`${year}-12-31`)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    if (!from || !to) { setError('Vui lòng chọn đủ khoảng thời gian.'); return }
    if (from > to) { setError('Ngày bắt đầu phải trước ngày kết thúc.'); return }
    setError(''); setBusy(true)
    try {
      const r = await fetch(`${API}/approvals/forms/${form.id}/export?from=${from}&to=${to}`)
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Không thể tải dữ liệu.')
      const { fields, rows } = await r.json()
      if (!rows.length) { setError('Không có đơn nào trong khoảng thời gian đã chọn.'); return }

      const META = ['Mã đơn', 'Tiêu đề', 'Người gửi', 'Trạng thái', 'Bước hiện tại', 'Ngày tạo', 'Ngày gửi', 'Ngày hoàn tất']
      const header = [...META, ...fields.map(f => f.label)]
      const aoa = [header]
      for (const row of rows) {
        const data = row.form_data || {}
        aoa.push([
          row.id,
          row.title || '',
          row.requester_name || '',
          statusInfo(row.status).label,
          row.current_step_name || '',
          fmtDT(row.created_at),
          fmtDT(row.submitted_at),
          fmtDT(row.completed_at),
          ...fields.map(f => fmtExportValue(f, data[f.field_key])),
        ])
      }

      const XLSX = await import('xlsx')
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, (form.code || 'Đơn').slice(0, 31))
      XLSX.writeFile(wb, `don_${(form.code || 'export').replace(/[^\w]+/g, '_')}_${from}_${to}.xlsx`)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} labelledBy="ab-export-title" width="460px">
      <div className="modal-header"><h2 id="ab-export-title">Xuất Excel — {form.name}</h2></div>
      <div className="modal-body ab-export-body">
        {error && <p className="ab-error">{error}</p>}
        <div className="ab-flabel-row">
          <label className="ab-flabel" style={{ flex: 1 }}>Từ ngày
            <DateInput className="ab-input" value={from} onChange={e => setFrom(e.target.value)} />
          </label>
          <label className="ab-flabel" style={{ flex: 1 }}>Đến ngày
            <DateInput className="ab-input" value={to} onChange={e => setTo(e.target.value)} />
          </label>
        </div>
        <p className="ab-note" style={{ marginTop: 8 }}>Lọc theo ngày tạo đơn. Ngầm định cả năm {year}.</p>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-light" onClick={onClose}>Hủy</button>
        <button type="button" className="btn btn-primary" onClick={run} disabled={busy}>
          {busy ? 'Đang xuất…' : 'Xuất Excel'}
        </button>
      </div>
    </Modal>
  )
}
