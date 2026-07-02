import { useEffect, useMemo } from 'react'
import { useContractPerm } from '../../context/ContractPermContext'

// Tab sidebar → quyền .view (lớp B) cần để THẤY. Thiếu map = luôn hiện.
const PERM_BY_ID = {
  'contract-info': 'co.info.view',
  'contract-documents': 'co.documents.view',
  'contract-pricing': 'co.boq.view',
  'contract-supply': 'co.supply.view',
  'contract-progress': 'co.progress.view',
  'contract-debt': 'co.receivable.view',
  'contract-invoice': 'co.invoice.view',
  'contract-warranty': 'co.warranty.view',
  'contract-guarantee': 'co.guarantee.view',
  'contract-tasks': 'co.tasks.view',
  'purchase-contract-info': 'co.contractin.view',
}

export default function ContractSidebar({ activeMenu, onMenuChange, mobileOpen = false, onClose }) {
  const { canView } = useContractPerm()

  // Lọc tab theo quyền .view (lớp B). Bỏ category rỗng. Admin/HĐ-có-quyền thấy đủ như cũ.
  // useMemo để tham chiếu ổn định (chỉ đổi khi canView đổi) → effect Ctrl+↑/↓ phía dưới
  // dùng menuItems trong deps mà không phải re-subscribe mỗi lần render.
  const menuItems = useMemo(() => {
    const allMenuItems = [
      {
        category: 'I. Hợp đồng bán',
        items: [
          { id: 'contract-info', label: 'Thông tin hợp đồng' },
          { id: 'contract-documents', label: 'Tài liệu hợp đồng' },
          { id: 'contract-pricing', label: 'Bảng giá' },
          { id: 'contract-supply', label: 'Theo dõi nhập hàng' },
          { id: 'contract-progress', label: 'Tiến độ theo biên bản' },
          { id: 'contract-debt', label: 'Công nợ' },
          { id: 'contract-invoice', label: 'Quản lý hóa đơn' },
          { id: 'contract-warranty', label: 'Bảo hành' },
          { id: 'contract-guarantee', label: 'Bảo lãnh' },
          { id: 'contract-tasks', label: 'Công việc triển khai' }
        ]
      },
      {
        category: 'II. Hợp đồng nhập',
        items: [
          { id: 'purchase-contract-info', label: 'Thông tin hợp đồng nhập' }
        ]
      }
    ]
    return allMenuItems
      .map((section) => ({ ...section, items: section.items.filter((it) => !PERM_BY_ID[it.id] || canView(PERM_BY_ID[it.id])) }))
      .filter((section) => section.items.length > 0)
  }, [canView])

  // Ctrl+↓ / Ctrl+↑: chuyển nhanh giữa các mục sidebar (vòng tròn)
  useEffect(() => {
    const flatIds = menuItems.flatMap((section) => section.items.map((item) => item.id))
    const handleKeyDown = (e) => {
      if (!e.ctrlKey || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return
      e.preventDefault()
      const current = flatIds.indexOf(activeMenu)
      const base = current === -1 ? 0 : current
      const len = flatIds.length
      const next = e.key === 'ArrowUp' ? (base - 1 + len) % len : (base + 1) % len
      onMenuChange(flatIds[next])
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeMenu, onMenuChange, menuItems])

  const handleSelect = (id) => {
    onMenuChange(id)
    if (onClose) onClose()
  }

  return (
    <>
      {mobileOpen && <div className="contract-sidebar-backdrop" onClick={onClose} />}
      <div className={`contract-sidebar ${mobileOpen ? 'contract-sidebar--open' : ''}`}>
        <div className="contract-sidebar-mobile-header">
          <span>Chọn mục</span>
          <button className="contract-sidebar-close" onClick={onClose} aria-label="Đóng">×</button>
        </div>
        {menuItems.map((section, sectionIndex) => (
          <div key={sectionIndex} className="contract-sidebar-section">
            <div className="contract-sidebar-category">{section.category}</div>
            <div className="contract-sidebar-items">
              {section.items.map((item) => (
                <button
                  key={item.id}
                  className={`contract-sidebar-item ${activeMenu === item.id ? 'active' : ''}`}
                  onClick={() => handleSelect(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
