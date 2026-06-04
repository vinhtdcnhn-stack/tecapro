import { useState, useRef } from 'react'
import { useClickOutside } from '../../hooks/useClickOutside'

export default function MultiSelect({ options, selectedValues, onChange, placeholder }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const ref = useRef(null)
  useClickOutside(ref, () => setIsOpen(false))

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  function toggleOption(value) {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value))
    } else {
      onChange([...selectedValues, value])
    }
  }

  function removeOption(value, e) {
    e.stopPropagation()
    onChange(selectedValues.filter(v => v !== value))
  }

  return (
    <div className="multi-select-container" style={{ position: 'relative' }} ref={ref}>
      <div
        className="multi-select-trigger"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', flexWrap: 'wrap', gap: '4px',
          padding: '8px 12px', border: '1px solid #d1d5db',
          borderRadius: '6px', minHeight: '40px', cursor: 'pointer', backgroundColor: '#fff',
        }}
      >
        {selectedValues.length === 0 && (
          <span style={{ color: '#9ca3af' }}>{placeholder}</span>
        )}
        {selectedValues.map(value => {
          const option = options.find(o => o.value === value)
          return option ? (
            <span key={value} style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '2px 8px', backgroundColor: '#dbeafe',
              color: '#1e40af', borderRadius: '4px', fontSize: '13px',
            }}>
              {option.label}
              <button onClick={(e) => removeOption(value, e)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '0', color: '#1e40af', fontSize: '14px',
              }}>×</button>
            </span>
          ) : null
        })}
      </div>

      {isOpen && (
        <div className="multi-select-dropdown" style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
          backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '6px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 100,
          maxHeight: '200px', overflowY: 'auto',
        }}>
          <input
            type="text" placeholder="Tìm kiếm..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', padding: '8px 12px', border: 'none', borderBottom: '1px solid #e5e7eb', outline: 'none' }}
          />
          {filteredOptions.map(opt => (
            <div key={opt.value} onClick={() => toggleOption(opt.value)} style={{
              padding: '8px 12px', cursor: 'pointer',
              backgroundColor: selectedValues.includes(opt.value) ? '#dbeafe' : 'transparent',
              color: selectedValues.includes(opt.value) ? '#1e40af' : '#374151',
            }}>
              {selectedValues.includes(opt.value) && '✓ '}{opt.label}
            </div>
          ))}
          {filteredOptions.length === 0 && (
            <div style={{ padding: '8px 12px', color: '#9ca3af' }}>Không tìm thấy</div>
          )}
        </div>
      )}
    </div>
  )
}
