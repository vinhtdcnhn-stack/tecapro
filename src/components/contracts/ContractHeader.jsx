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

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('vi-VN')
  }

  const formatCurrency = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '-'
    const numValue = Number(value)
    if (numValue >= 1000000000) {
      return (numValue / 1000000000).toFixed(2).replace('.', ',') + ' tỷ VNĐ'
    }
    return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(numValue) + ' VNĐ'
  }

  const getStatusBadge = (status) => {
    const config = {
      'Active': { className: 'status-active', label: 'Đang thực hiện' },
      'Completed': { className: 'status-completed', label: 'Hoàn thành' },
      'Pending': { className: 'status-pending', label: 'Chờ xử lý' },
      'Cancelled': { className: 'status-cancelled', label: 'Hủy bỏ' }
    }[status] || { className: 'bg-gray-100 text-gray-800', label: status }
    return <span className={`status-badge ${config.className}`}>{config.label}</span>
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
