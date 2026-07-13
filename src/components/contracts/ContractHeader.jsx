// Ngày ký → 'dd/mm/yyyy' (dùng giờ địa phương để khớp ô "Ngày ký" trong tab thông tin).
const fmtSignedDate = (d) => {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt)) return ''
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
}

// Cùng thứ tự nhóm với khối "Thông tin nhân sự" ở tab Thông tin hợp đồng.
const STAFF_GROUPS = [
  ['Nhân viên kinh doanh', 'sale_members'],
  ['PM chính', 'pm_members'],
  ['Presale', 'presale_members'],
  ['Kỹ thuật triển khai', 'technical_members'],
  ['Xuất nhập khẩu', 'import_export_members'],
  ['Kế toán', 'accounting_members'],
  ['Người theo dõi', 'follower_members'],
]

export default function ContractHeader({ contract, onTitleClick }) {
  // "Đang tải" = chưa có contract; không cần state/effect riêng (trước đây setLoading trong effect).
  if (!contract) {
    return (
      <div className="contract-header">
        <div className="contract-header-loading">Đang tải thông tin hợp đồng...</div>
      </div>
    )
  }

  // Chỉ hiện nhóm có người — tooltip rê chuột vào tên dự án.
  const staffGroups = STAFF_GROUPS
    .map(([label, key]) => ({ label, members: contract[key] || [] }))
    .filter((g) => g.members.length > 0)

  return (
    <div
      className="contract-header contract-header--clickable"
      onClick={onTitleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (onTitleClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onTitleClick() } }}
    >
      {/* Dòng đầu: Tên dự án và Số hợp đồng + ngày ký - Căn giữa.
          Trên mobile: tên dự án (h1) được ẩn (App.css) — chọn mục qua nút ☰ cạnh nút trợ giúp trên Header. */}
      <div className="contract-header-title">
        <h1>
          <span className="contract-title-hint" tabIndex={0}>
            {contract.project_name || '-'}
            {staffGroups.length > 0 && (
              <span className="contract-staff-hint" role="tooltip">
                <span className="contract-staff-hint-title">Nhân sự dự án</span>
                {staffGroups.map((g) => (
                  <span key={g.label} className="contract-staff-hint-row">
                    <span className="contract-staff-hint-label">{g.label}</span>
                    <span className="contract-staff-hint-names">{g.members.join(', ')}</span>
                  </span>
                ))}
              </span>
            )}
          </span>
        </h1>
        <p className="contract-no">
          {contract.contract_no || '-'}
          {fmtSignedDate(contract.contract_date) && (
            <span className="contract-signed-date"> · Ký ngày {fmtSignedDate(contract.contract_date)}</span>
          )}
        </p>
      </div>
    </div>
  )
}
