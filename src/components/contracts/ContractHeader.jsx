import { useState, useEffect } from 'react'

export default function ContractHeader({ contract }) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (contract) {
      setLoading(false)
    }
  }, [contract])

  if (loading || !contract) {
    return (
      <div className="contract-header">
        <div className="contract-header-loading">Đang tải thông tin hợp đồng...</div>
      </div>
    )
  }

  return (
    <div className="contract-header">
      {/* Dòng đầu: Tên dự án và Số hợp đồng - Căn giữa */}
      <div className="contract-header-title">
        <h1>{contract.project_name || '-'}</h1>
        <p className="contract-no">{contract.contract_no || '-'}</p>
      </div>
    </div>
  )
}
