import { useState, useRef } from 'react'
import { useClickOutside } from '../../hooks/useClickOutside'

export default function MultiSelect({ options, selectedValues, onChange, placeholder, inlineSearch = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const ref = useRef(null)
  const inputRef = useRef(null)
  useClickOutside(ref, () => { setIsOpen(false); setSearchTerm('') })

  // Lọc theo nhãn và (nếu có) trường `search` phụ — vd email — để gõ email cũng tìm được.
  const filteredOptions = options.filter(opt => {
    const t = searchTerm.toLowerCase()
    return opt.label.toLowerCase().includes(t) || (opt.search && opt.search.toLowerCase().includes(t))
  })

  function toggleOption(value) {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value))
    } else {
      onChange([...selectedValues, value])
    }
    // Sau khi chọn ở chế độ gõ thẳng: xóa từ khóa, giữ mở để chọn tiếp.
    if (inlineSearch) { setSearchTerm(''); inputRef.current?.focus() }
  }

  function removeOption(value, e) {
    e.stopPropagation()
    onChange(selectedValues.filter(v => v !== value))
  }

  return (
    <div className="multi-select-container" style={{ position: 'relative' }} ref={ref}>
      <div
        className="multi-select-trigger"
        onClick={() => (inlineSearch ? (setIsOpen(true), inputRef.current?.focus()) : setIsOpen(!isOpen))}
        style={{
          display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center',
          padding: '8px 12px', border: '1px solid #d1d5db',
          borderRadius: '6px', minHeight: '40px', cursor: 'text', backgroundColor: '#fff',
        }}
      >
        {!inlineSearch && selectedValues.length === 0 && (
          <span style={{ color: '#9ca3af' }}>{placeholder}</span>
        )}
        {selectedValues.map(value => {
          const option = options.find(o => o.value === value)
          return option ? (
            <span key={value} style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '2px 8px', backgroundColor: 'var(--chip-bg)',
              color: 'var(--chip-text)', borderRadius: '4px', fontSize: '13px',
            }}>
              {option.label}
              <button onClick={(e) => removeOption(value, e)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '0', color: 'var(--chip-text)', fontSize: '14px',
              }}>×</button>
            </span>
          ) : null
        })}
        {inlineSearch && (
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            placeholder={selectedValues.length === 0 ? placeholder : ''}
            onChange={(e) => { setSearchTerm(e.target.value); setIsOpen(true) }}
            onFocus={() => setIsOpen(true)}
            onClick={(e) => e.stopPropagation()}
            style={{ flex: 1, minWidth: '90px', border: 'none', outline: 'none', padding: '2px', fontSize: '14px' }}
          />
        )}
      </div>

      {isOpen && (
        <div className="multi-select-dropdown" style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
          backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '6px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 100,
          maxHeight: '220px', overflowY: 'auto',
        }}>
          {!inlineSearch && (
            <input
              type="text" placeholder="Tìm kiếm..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', padding: '8px 12px', border: 'none', borderBottom: '1px solid #e5e7eb', outline: 'none' }}
            />
          )}
          {filteredOptions.map(opt => (
            <div key={opt.value} onClick={() => toggleOption(opt.value)} style={{
              padding: '8px 12px', cursor: 'pointer',
              backgroundColor: selectedValues.includes(opt.value) ? 'var(--chip-bg)' : 'transparent',
              color: selectedValues.includes(opt.value) ? 'var(--chip-text)' : '#374151',
            }}>
              {selectedValues.includes(opt.value) && '✓ '}{opt.label}
              {opt.hint && <span style={{ color: '#9ca3af', marginLeft: 6, fontSize: 12 }}>{opt.hint}</span>}
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
