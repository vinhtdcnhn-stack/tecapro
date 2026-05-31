import { useState, useEffect } from 'react'
import ContractHeader from '../components/contracts/ContractHeader'
import ContractSidebar from '../components/contracts/ContractSidebar'

export default function ContractManagementPage() {
  const [contractId, setContractId] = useState(null)
  const [contract, setContract] = useState(null)
  const [activeMenu, setActiveMenu] = useState('contract-info')
  const [loading, setLoading] = useState(true)

  const getBaseUrl = () => {
    return (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5174').replace(/\/$/, '')
  }

  useEffect(() => {
    const pathParts = window.location.pathname.split('/')
    const id = pathParts[pathParts.length - 1]
    setContractId(id)

    async function loadContract() {
      try {
        const res = await fetch(`${getBaseUrl()}/api/contracts`)
        const data = await res.json()

        const found = data.find(
          c => String(c.id) === String(id)
        )

        if (found) {
          setContract(found)
        }
      } catch (err) {
        console.error('Failed to load contract:', err)
      } finally {
        setLoading(false)
      }
    }

    loadContract()
  }, [])

  const renderContent = () => {
    switch (activeMenu) {
      case 'contract-info':
        return <ContractInfoTab contract={contract} />
      case 'contract-documents':
        return <PlaceholderTab title="Tài liệu hợp đồng" />
      case 'contract-pricing':
        return <PlaceholderTab title="Bảng giá" />
      case 'contract-progress':
        return <PlaceholderTab title="Tiến độ theo biên bản" />
      case 'contract-revenue':
        return <PlaceholderTab title="Doanh thu" />
      case 'contract-debt':
        return <PlaceholderTab title="Công nợ" />
      case 'contract-warranty':
        return <PlaceholderTab title="Bảo hành" />
      case 'contract-guarantee':
        return <PlaceholderTab title="Bảo lãnh" />
      case 'contract-tasks':
        return <PlaceholderTab title="Công việc triển khai" />
      case 'purchase-contract-info':
        return <PlaceholderTab title="Thông tin hợp đồng nhập" />
      case 'supplier':
        return <PlaceholderTab title="Nhà cung cấp" />
      case 'supplier-payment':
        return <PlaceholderTab title="Thanh toán NCC" />
      default:
        return <ContractInfoTab contract={contract} />
    }
  }

  if (loading) {
    return (
      <div className="contract-management-page">
        <div className="contract-management-loading">Đang tải...</div>
      </div>
    )
  }

  return (
    <div className="contract-management-page">
      <ContractHeader contract={contract} />
      <div className="contract-management-body">
        <ContractSidebar activeMenu={activeMenu} onMenuChange={setActiveMenu} />
        <div className="contract-management-content">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

function ContractInfoTab({ contract }) {
  if (!contract) {
    return <div className="contract-info-tab">Không tìm thấy thông tin hợp đồng</div>
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

  const staffGroups = [
    { label: 'Nhân viên kinh doanh', members: [] },
    { label: 'PM chính', members: contract.pm_name ? [contract.pm_name] : [] },
    { label: 'Presale', members: [] },
    { label: 'Người theo dõi', members: [] },
    { label: 'Kế toán', members: [] },
    { label: 'Kỹ thuật triển khai', members: [] }
  ]

  return (
    <div className="contract-info-tab">
      <div className="contract-info-left">
        <h3 className="contract-info-section-title">Thông tin hợp đồng</h3>
        <div className="contract-info-form">
          <div className="form-row">
            <div className="form-group">
              <label>Số hợp đồng</label>
              <input type="text" value={contract.contract_no || ''} readOnly />
            </div>
            <div className="form-group">
              <label>Ngày ký</label>
              <input type="text" value={formatDate(contract.contract_date)} readOnly />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group full-width">
              <label>Tên dự án</label>
              <input type="text" value={contract.project_name || ''} readOnly />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group full-width">
              <label>Chủ đầu tư</label>
              <input type="text" value={contract.customer_name || ''} readOnly />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group full-width">
              <label>Tên gói thầu</label>
              <input type="text" value={contract.tender_name || ''} readOnly />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>VAT</label>
              <input type="text" value={formatCurrency((parseFloat(contract.amount_after_vat) || 0) - (parseFloat(contract.amount_before_vat) || 0))} readOnly />
            </div>
            <div className="form-group">
              <label>Trước VAT</label>
              <input type="text" value={formatCurrency(contract.amount_before_vat)} readOnly />
            </div>
            <div className="form-group">
              <label>Sau VAT</label>
              <input type="text" value={formatCurrency(contract.amount_after_vat)} readOnly />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Đơn vị tiền tệ</label>
              <input type="text" value={contract.currency_code || 'VND'} readOnly />
            </div>
            <div className="form-group">
              <label>Phân loại</label>
              <input type="text" value="Hợp đồng bán" readOnly />
            </div>
            <div className="form-group">
              <label>Trạng thái</label>
              <div className="status-container">{getStatusBadge(contract.status)}</div>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group full-width">
              <label>Điều khoản</label>
              <textarea rows="4" readOnly placeholder="Chưa có điều khoản"></textarea>
            </div>
          </div>
        </div>
      </div>
      <div className="contract-info-right">
        <h3 className="contract-info-section-title">Thông tin nhân sự</h3>
        <div className="staff-groups">
          {staffGroups.map((group, index) => (
            <div key={index} className="staff-group">
              <label className="staff-group-label">{group.label}</label>
              <div className="staff-members">
                {group.members.length > 0 ? (
                  group.members.map((member, memberIndex) => (
                    <span key={memberIndex} className="staff-chip">{member}</span>
                  ))
                ) : (
                  <span className="staff-empty">-</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PlaceholderTab({ title }) {
  return (
    <div className="placeholder-tab">
      <h3>{title}</h3>
      <p>Chức năng này sẽ được phát triển sau</p>
    </div>
  )
}
