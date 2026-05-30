import { useState, useEffect } from 'react'

export default function ContractHeader({ contract }) {
  const [loading, setLoading] = useState(true)
  const [contractData, setContractData] = useState(null)

  useEffect(() => {
    if (contract) {
      setContractData(contract)
      setLoading(false)
    }
  }, [contract])

  const getBaseUrl = () => {
    return (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5174').replace(/\/$/, '')
  }

  useEffect(() => {
    async function loadContract() {
      try {
        const res = await fetch(`${getBaseUrl()}/api/contracts`)
        const data = await res.json()
        const found = data.find(c => c.id === parseInt(contract))
        if (found) {
          setContractData(found)
        }
      } catch (err) {
        console.error('Failed to load contract:', err)
      } finally {
        setLoading(false)
      }
    }

    if (!contract && !contractData) {
      loadContract()
    }
  }, [])

  if (loading || !contractData) {
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
    return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
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
      <div className="contract-header-grid">
        <div className="contract-header-item">
          <span className="contract-header-label">Số hợp đồng</span>
          <span className="contract-header-value">{contractData.contract_no || '-'}</span>
        </div>
        <div className="contract-header-item">
          <span className="contract-header-label">Tên dự án</span>
          <span className="contract-header-value">{contractData.project_name || '-'}</span>
        </div>
        <div className="contract-header-item">
          <span className="contract-header-label">Chủ đầu tư</span>
          <span className="contract-header-value">{contractData.customer_name || '-'}</span>
        </div>
        <div className="contract-header-item">
          <span className="contract-header-label">Gói thầu</span>
          <span className="contract-header-value">{contractData.tender_name || '-'}</span>
        </div>
        <div className="contract-header-item">
          <span className="contract-header-label">PM chính</span>
          <span className="contract-header-value">{contractData.pm_name || '-'}</span>
        </div>
        <div className="contract-header-item">
          <span className="contract-header-label">Ngày ký</span>
          <span className="contract-header-value">{formatDate(contractData.contract_date)}</span>
        </div>
        <div className="contract-header-item">
          <span className="contract-header-label">Giá trị hợp đồng</span>
          <span className="contract-header-value money">{formatCurrency(contractData.amount_after_vat)} ₫</span>
        </div>
        <div className="contract-header-item">
          <span className="contract-header-label">Trạng thái</span>
          <span className="contract-header-value">{getStatusBadge(contractData.status)}</span>
        </div>
      </div>
    </div>
  )
}
