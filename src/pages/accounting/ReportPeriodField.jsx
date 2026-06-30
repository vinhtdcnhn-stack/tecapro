import { useState } from 'react'
import { todayLocal, fmtDate } from './reportUtils'

// Ô "Kỳ báo cáo đến ngày" dùng chung cho báo cáo Công nợ phải thu / phải trả.
//   • Chặn chọn ngày TƯƠNG LAI (sau hôm nay) kèm cảnh báo — không thể chốt số liệu ở
//     thời điểm chưa tới.
//   • Khi xem ngày < hôm nay → badge "đang xem lại quá khứ" (số liệu cắt theo NGÀY tới
//     ngày đó; giá trị dùng dữ liệu hiện tại đã sửa, không đóng băng số cũ).
export default function ReportPeriodField({ value, onChange }) {
  const [warn, setWarn] = useState('')
  const maxDate = todayLocal()
  const isPast = value && value < maxDate

  const handle = (e) => {
    const v = e.target.value
    if (v && v > maxDate) {
      setWarn('Không thể chọn ngày sau hôm nay.')
      return
    }
    setWarn('')
    onChange(v)
  }

  return (
    <>
      <label className="acc-field"><span>Kỳ báo cáo đến ngày</span>
        <input type="date" value={value} max={maxDate} onChange={handle} /></label>
      {warn && <span className="acc-warn">⚠ {warn}</span>}
      {isPast && (
        <span className="acc-asof-badge" title="Số liệu dựng lại theo trạng thái tại ngày này">
          🕘 Đang xem lại quá khứ — số liệu tại ngày {fmtDate(value)}
        </span>
      )}
    </>
  )
}
