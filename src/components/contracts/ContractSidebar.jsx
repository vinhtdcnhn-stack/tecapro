export default function ContractSidebar({ activeMenu, onMenuChange }) {
  const menuItems = [
    {
      category: 'I. Hợp đồng bán',
      items: [
        { id: 'contract-info', label: 'Thông tin hợp đồng' },
        { id: 'contract-documents', label: 'Tài liệu hợp đồng' },
        { id: 'contract-pricing', label: 'Bảng giá' },
        { id: 'contract-progress', label: 'Tiến độ theo biên bản' },
{ id: 'contract-debt', label: 'Công nợ' },
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

  return (
    <div className="contract-sidebar">
      {menuItems.map((section, sectionIndex) => (
        <div key={sectionIndex} className="contract-sidebar-section">
          <div className="contract-sidebar-category">{section.category}</div>
          <div className="contract-sidebar-items">
            {section.items.map((item) => (
              <button
                key={item.id}
                className={`contract-sidebar-item ${activeMenu === item.id ? 'active' : ''}`}
                onClick={() => onMenuChange(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
