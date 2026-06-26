import { useEffect } from 'react'

export default function ContractSidebar({ activeMenu, onMenuChange, mobileOpen = false, onClose }) {
  const menuItems = [
    {
      category: 'I. Hợp đồng bán',
      items: [
        { id: 'contract-info', label: 'Thông tin hợp đồng' },
        { id: 'contract-documents', label: 'Tài liệu hợp đồng' },
        { id: 'contract-pricing', label: 'Bảng giá' },
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
  }, [activeMenu, onMenuChange])

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
