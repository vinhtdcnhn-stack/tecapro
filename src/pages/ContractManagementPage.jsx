import { useState, useEffect } from 'react'
import { API_BASE } from '../config/api'
import ContractHeader from '../components/contracts/ContractHeader'
import ContractSidebar from '../components/contracts/ContractSidebar'
import ContractModal from '../components/contracts/ContractModal'
import ContractDocumentsTab from '../components/contracts/ContractDocumentsTab'
import ContractBOQTab from '../components/contracts/ContractBOQTab'
import ContractProgressTab from '../components/contracts/ContractProgressTab'
import ContractReceivableTab from '../components/contracts/ContractReceivableTab'
import ContractInvoiceTab from '../components/contracts/ContractInvoiceTab'
import ContractGuaranteeTab from '../components/contracts/ContractGuaranteeTab'
import ContractTaskTab from '../components/contracts/ContractTaskTab'
import ContractWarrantyTab from '../components/contracts/ContractWarrantyTab'
import ContractInTab from '../components/contracts/ContractInTab'
import { ContractPermProvider, useCanEdit } from '../context/ContractPermContext'

export default function ContractManagementPage({ selectedContractId, initialMenu, initialInId, initialInTab, initialTaskId }) {
  const contractId = selectedContractId // dẫn xuất thẳng từ prop (trước đây mirror qua state + setContractId)
  const [contract, setContract] = useState(null)
  const [activeMenu, setActiveMenu] = useState(initialMenu || 'contract-info')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  
  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [users, setUsers] = useState([])
  const [customers, setCustomers] = useState([])
  const [currentUser, setCurrentUser] = useState(null)

  // Quyền sửa: admin (role==1) hoặc PM của HĐ này (PM chính/đồng-PM). Backend đã
  // chặn cùng quy tắc; đây là phần phản ánh ở UI để ẩn/khóa nút sửa.
  const canEdit = (() => {
    if (!currentUser || !contract) return false
    if (Number(currentUser.role) === 1) return true
    const pmIds = (contract.pm_member_ids || []).map(String)
    return pmIds.includes(String(currentUser.id))
  })()

  // Quyền thao tác SERIAL: canEdit (admin/PM) HOẶC là Kỹ thuật của HĐ này
  // (member_role='Technical'). Mở cho nhập/sửa/xóa serial ở tab Nhận hàng & Quản lý serial.
  const canEditSerial = (() => {
    if (canEdit) return true
    if (!currentUser || !contract) return false
    const techIds = (contract.technical_member_ids || []).map(String)
    return techIds.includes(String(currentUser.id))
  })()

  useEffect(() => {
    const id = selectedContractId

    async function loadContract() {
      try {
        // Load contract details by ID
        const res = await fetch(`${API_BASE}/api/contracts/${id}`)
        const found = await res.json()

        if (found && found.id) {
          setContract(found)
        }
        
        // Load users for edit modal
        const usersRes = await fetch(`${API_BASE}/api/users`)
        const usersData = await usersRes.json()
        setUsers(usersData)
        
        // Load customers for edit modal
        const customersRes = await fetch(`${API_BASE}/api/customers`)
        const customersData = await customersRes.json()
        setCustomers(customersData)
        
        // Người dùng hiện tại lấy từ phiên đã xác thực (cookie)
        const meRes = await fetch(`${API_BASE}/api/auth/me`)
        if (meRes.ok) {
          const meData = await meRes.json()
          setCurrentUser(meData)
        }
      } catch (err) {
        console.error('Failed to load contract:', err)
      } finally {
        setLoading(false)
      }
    }

    loadContract()
  }, [selectedContractId])

  // Khi đến từ deep-link (dashboard / ô tra cứu công việc), nhảy thẳng tới đúng menu.
  // initialTaskId vào deps để dán đường dẫn việc mới (cùng HĐ) vẫn ép về tab Công việc.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- áp menu theo deep-link khi mở/đổi hợp đồng
    if (initialMenu) setActiveMenu(initialMenu)
  }, [initialMenu, selectedContractId, initialTaskId])

  const renderContent = () => {
    switch (activeMenu) {
      case 'contract-info':
        return <ContractInfoTab contract={contract} onEdit={() => setIsEditModalOpen(true)} />
      case 'contract-documents':
        return <ContractDocumentsTab contractId={contractId} />
      case 'contract-pricing':
        return <ContractBOQTab contractId={contractId} />
      case 'contract-progress':
        return <ContractProgressTab contractId={contractId} />
case 'contract-debt':
        return <ContractReceivableTab contractId={contractId} />
      case 'contract-invoice':
        return <ContractInvoiceTab contractId={contractId} />
      case 'contract-warranty':
        return <ContractWarrantyTab contractId={contractId} />
      case 'contract-guarantee':
        return <ContractGuaranteeTab contractId={contractId} />
      case 'contract-tasks':
        return <ContractTaskTab contractId={contractId} currentUser={currentUser} contract={contract} initialTaskId={initialTaskId} />
      case 'purchase-contract-info':
        return <ContractInTab contractId={contractId} initialContractInId={initialInId} initialTab={initialInTab} currentUser={currentUser} contract={contract} />
default:
        return <ContractInfoTab contract={contract} onEdit={() => setIsEditModalOpen(true)} />
    }
  }

  async function handleUpdateContract(formData) {
    try {
      const response = await fetch(`${API_BASE}/api/contracts/${contractId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (response.ok) {
        // Reload contract data from detail endpoint
        const detailRes = await fetch(
          `${API_BASE}/api/contracts/${contractId}`
        )

        const detailData = await detailRes.json()

        setContract(detailData)
        setIsEditModalOpen(false)
        alert('Cập nhật hợp đồng thành công!')
      } else {
        const error = await response.json()
        alert('Lỗi: ' + (error.error || 'Không thể cập nhật hợp đồng'))
      }
    } catch (err) {
      console.error('Error updating contract:', err)
      alert('Có lỗi xảy ra khi cập nhật hợp đồng')
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
    <ContractPermProvider canEdit={canEdit} canEditSerial={canEditSerial}>
      <div className="contract-management-page">
        <ContractHeader contract={contract} onTitleClick={() => setMobileNavOpen(true)} />
        <div className="contract-management-body">
          <ContractSidebar
            activeMenu={activeMenu}
            onMenuChange={setActiveMenu}
            mobileOpen={mobileNavOpen}
            onClose={() => setMobileNavOpen(false)}
          />
          <div className="contract-management-content">
            {renderContent()}
          </div>
        </div>

        {/* Edit Contract Modal */}
        <ContractModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleUpdateContract}
          currentUser={currentUser}
          contracts={contract ? [contract] : []}
          users={users}
          customers={customers}
          editMode={true}
          editData={contract}
        />
      </div>
    </ContractPermProvider>
  )
}

function ContractInfoTab({ contract, onEdit }) {
  const canEdit = useCanEdit()
  if (!contract) {
    return <div className="contract-info-tab">Không tìm thấy thông tin hợp đồng</div>
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('vi-VN')
  }

  const formatCurrency = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '-'
    const num = Number(value)
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: num % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: 2
    }).format(num)
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

  // Build staff groups from contract member data
  const staffGroups = [
    { label: 'Nhân viên kinh doanh', members: contract.sale_members || [] },
    { label: 'PM chính', members: contract.pm_members || [] },
    { label: 'Presale', members: contract.presale_members || [] },
    { label: 'Kỹ thuật triển khai', members: contract.technical_members || [] },
    { label: 'Xuất nhập khẩu', members: contract.import_export_members || [] },
    { label: 'Kế toán', members: contract.accounting_members || [] },
    { label: 'Người theo dõi', members: contract.follower_members || [] }
  ]

  return (
    <div className="contract-info-tab">
      <div className="contract-info-left">
        <div className="contract-info-section-header">
          <h3 className="contract-info-section-title">Thông tin hợp đồng</h3>
          {canEdit && (
            <button className="btn-edit-contract" onClick={onEdit}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Cập nhật thông tin hợp đồng
            </button>
          )}
        </div>
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
              <label>Tỷ giá</label>
              <input type="text" value={contract.exchange_rate != null ? new Intl.NumberFormat('vi-VN').format(contract.exchange_rate) : '-'} readOnly />
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
            <div className="form-group">
              <label>Liên danh</label>
              <input type="text" readOnly
                value={contract.is_joint_venture ? 'Có – Hợp đồng liên danh' : 'Không'}
                style={contract.is_joint_venture ? { color: '#c2410c', fontWeight: 600, background: '#fff7ed' } : {}} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group full-width">
              <label>Điều khoản</label>
              <textarea rows="4" readOnly value={contract.terms || ''} placeholder="Chưa có điều khoản" />
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
