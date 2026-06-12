// Ngày ký → 'dd/mm/yyyy' (dùng giờ địa phương để khớp ô "Ngày ký" trong tab thông tin).
const fmtSignedDate = (d) => {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt)) return ''
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
}

export default function ContractHeader({ contract }) {
  // "Đang tải" = chưa có contract; không cần state/effect riêng (trước đây setLoading trong effect).
  if (!contract) {
    return (
      <div className="contract-header">
        <div className="contract-header-loading">Đang tải thông tin hợp đồng...</div>
      </div>
    )
  }

  return (
    <div className="contract-header">
      {/* Dòng đầu: Tên dự án và Số hợp đồng + ngày ký - Căn giữa */}
      <div className="contract-header-title">
        <h1>{contract.project_name || '-'}</h1>
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
