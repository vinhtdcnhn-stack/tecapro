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
      {/* Dòng đầu: Tên dự án và Số hợp đồng */}
      <div className="contract-header-title">
        <h1>{contractData.project_name || '-'}</h1>
        <p className="contract-no">{contractData.contract_no || '-'}</p>
      </div>

      {/* Dòng thứ hai: 5 thẻ KPI */}
      <div className="contract-header-kpi-grid">
        {/* A. Chủ đầu tư */}
        <div className="contract-header-kpi-card">
          <span className="contract-header-kpi-label">Chủ đầu tư</span>
          <span className="contract-header-kpi-value">{contractData.customer_name || '-'}</span>
        </div>

        {/* B. PM chính */}
        <div className="contract-header-kpi-card">
          <span className="contract-header-kpi-label">PM chính</span>
          <span className="contract-header-kpi-value">{contractData.pm_name || '-'}</span>
        </div>

        {/* C. Trạng thái */}
        <div className="contract-header-kpi-card">
          <span className="contract-header-kpi-label">Trạng thái</span>
          <span className="contract-header-kpi-value">{getStatusBadge(contractData.status)}</span>
        </div>

        {/* D. Giá trị hợp đồng */}
        <div className="contract-header-kpi-card">
          <span className="contract-header-kpi-label">Giá trị HĐ</span>
          <span className="contract-header-kpi-value money">{formatCurrency(contractData.amount_after_vat)}</span>
        </div>

        {/* E. Ngày ký */}
        <div className="contract-header-kpi-card">
          <span className="contract-header-kpi-label">Ngày ký</span>
          <span className="contract-header-kpi-value">{formatDate(contractData.contract_date)}</span>
        </div>
      </div>
    </div>
  )
}
