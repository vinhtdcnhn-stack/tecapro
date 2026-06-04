import { useState, useRef } from 'react'
import { useClickOutside } from '../../hooks/useClickOutside'

export default function CustomerSelect({ customers, selectedId, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const ref = useRef(null)
  useClickOutside(ref, () => setIsOpen(false))

  const filteredCustomers = customers.filter(c => {
    const term = searchTerm.toLowerCase()
    return (c.code && c.code.toLowerCase().includes(term)) || (c.name && c.name.toLowerCase().includes(term))
  })

  const selectedCustomer = customers.find(c => {
    if (!selectedId) return false
    return c.id === parseInt(selectedId) || c.id === selectedId || String(c.id) === String(selectedId)
  })
  const displayValue = selectedCustomer ? selectedCustomer.name : ''

  const handleSelect = (id) => { onChange(id); setIsOpen(false); setSearchTerm('') }
  const handleClear  = (e)  => { e.stopPropagation(); onChange('') }

  return (
    <div className="customer-select-container" style={{ position: 'relative' }} ref={ref}>
      <div
        className="customer-select-trigger"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px',
          minHeight: '40px', cursor: 'pointer', backgroundColor: '#fff',
        }}
      >
        <span style={{ color: displayValue ? '#374151' : '#9ca3af' }}>
          {displayValue || 'Chọn chủ đầu tư...'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {selectedId && (
            <button onClick={handleClear} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0 4px', color: '#6b7280', fontSize: '16px',
            }}>×</button>
          )}
          <span style={{ color: '#9ca3af' }}>▼</span>
        </div>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
          backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '6px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 100,
          maxHeight: '200px', overflowY: 'auto',
        }}>
          <input
            type="text" placeholder="Tìm theo mã hoặc tên..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', padding: '8px 12px', border: 'none', borderBottom: '1px solid #e5e7eb', outline: 'none' }}
          />
          {filteredCustomers.map(c => {
            const isSelected = String(c.id) === String(selectedId)
            return (
              <div key={c.id} onClick={() => handleSelect(c.id)} style={{
                padding: '8px 12px', cursor: 'pointer',
                backgroundColor: isSelected ? '#dbeafe' : 'transparent',
                color: isSelected ? '#1e40af' : '#374151',
              }}>
                {isSelected && '✓ '}{c.name} {c.code && `(${c.code})`}
              </div>
            )
          })}
          {filteredCustomers.length === 0 && (
            <div style={{ padding: '8px 12px', color: '#9ca3af' }}>Không tìm thấy</div>
          )}
        </div>
      )}
    </div>
  )
}
