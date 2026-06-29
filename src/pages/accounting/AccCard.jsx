// Thẻ đọc-chỉ cho báo cáo kế toán trên mobile (thay cho bảng). Giữ nguyên hành vi
// bấm-để-mở hợp đồng và menu "Sao chép thông tin" (truyền rowProps từ useCopyMenu).
//
//   title    — tiêu đề thẻ (vd số HĐ, có thể là node).
//   sub      — dòng phụ dưới tiêu đề (vd tên khách hàng).
//   badge    — nhãn trạng thái/nhóm nợ ở góc phải (node, tùy chọn).
//   rows     — mảng [label, value]; cell rỗng/null/'—' tự bỏ qua.
//   onClick  — bấm thẻ (mở HĐ / xổ chi tiết).
//   rowProps — spread {...getRowProps(row)} để gắn menu sao chép.
export default function AccCard({ title, sub, badge, rows = [], onClick, rowProps, children }) {
  return (
    <div className={`acc-card${onClick ? ' acc-card-link' : ''}`} onClick={onClick} {...rowProps}>
      <div className="acc-card-head">
        <div className="acc-card-title">
          <span>{title}</span>
          {sub && <span className="acc-card-sub">{sub}</span>}
        </div>
        {badge != null && <div className="acc-card-badge">{badge}</div>}
      </div>
      {rows.length > 0 && (
        <div className="acc-card-grid">
          {rows.map(([label, value], i) => (value == null || value === '' || value === '—') ? null : (
            <div className="acc-card-cell" key={i}>
              <span className="acc-card-label">{label}</span>
              <span className="acc-card-value">{value}</span>
            </div>
          ))}
        </div>
      )}
      {children}
    </div>
  )
}
