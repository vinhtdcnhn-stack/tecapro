import { useState, useMemo, useRef, useEffect } from 'react'
import { API } from '../../config/api'

// Liên kết thiết bị cho 1 case bảo hành.
//  - Thiết bị: combobox tìm kiếm (gõ để lọc theo tên/hãng/model), chọn 1.
//  - Serial:   chọn NHIỀU (chip + gõ để lọc). Không chọn serial nào = gắn cả thiết bị.
// Mỗi serial được tạo thành 1 liên kết riêng (backend nhận 1 thiết bị + 1 serial / lần).
export default function CaseEquipmentLinker({ caseId, equipment, onLinked }) {
  const [equipmentId, setEquipmentId] = useState('')
  const [eqQuery, setEqQuery]         = useState('')
  const [eqOpen, setEqOpen]           = useState(false)
  const [eqActive, setEqActive]       = useState(0)

  const [selectedSerials, setSelectedSerials] = useState([]) // [serialId]
  const [snQuery, setSnQuery]   = useState('')
  const [snOpen, setSnOpen]     = useState(false)
  const [linking, setLinking]   = useState(false)

  const rootRef = useRef(null)

  const eqLabel = (e) => `${e.name}${e.model ? ` (${e.model})` : ''}`
  const selectedEquip = equipment.find(e => String(e.id) === String(equipmentId))
  const allSerials = useMemo(() => selectedEquip?.serials || [], [selectedEquip])

  // Đóng dropdown khi bấm ra ngoài
  useEffect(() => {
    const onDown = (ev) => { if (rootRef.current && !rootRef.current.contains(ev.target)) { setEqOpen(false); setSnOpen(false) } }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const filteredEquip = useMemo(() => {
    const q = eqQuery.trim().toLowerCase()
    if (!q) return equipment
    return equipment.filter(e =>
      `${e.name} ${e.brand || ''} ${e.model || ''}`.toLowerCase().includes(q))
  }, [equipment, eqQuery])

  const filteredSerials = useMemo(() => {
    const q = snQuery.trim().toLowerCase()
    return allSerials.filter(s =>
      !selectedSerials.includes(s.id) &&
      (!q || String(s.serial_no || '').toLowerCase().includes(q)))
  }, [allSerials, selectedSerials, snQuery])

  function pickEquip(e) {
    setEquipmentId(e.id)
    setEqQuery(eqLabel(e))
    setEqOpen(false)
    setSelectedSerials([])
    setSnQuery('')
  }

  function clearEquip() {
    setEquipmentId(''); setEqQuery(''); setSelectedSerials([]); setSnQuery('')
  }

  function onEqKeyDown(ev) {
    if (!eqOpen && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) { setEqOpen(true); return }
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setEqActive(i => Math.min(i + 1, filteredEquip.length - 1)) }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setEqActive(i => Math.max(i - 1, 0)) }
    else if (ev.key === 'Enter') { ev.preventDefault(); const e = filteredEquip[eqActive]; if (e) pickEquip(e) }
    else if (ev.key === 'Escape') { setEqOpen(false) }
  }

  const addSerial = (s) => { setSelectedSerials(prev => [...prev, s.id]); setSnQuery('') }
  const removeSerial = (id) => setSelectedSerials(prev => prev.filter(x => x !== id))

  function onSnKeyDown(ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); const s = filteredSerials[0]; if (s) addSerial(s) }
    else if (ev.key === 'Backspace' && !snQuery && selectedSerials.length) { removeSerial(selectedSerials[selectedSerials.length - 1]) }
    else if (ev.key === 'Escape') { setSnOpen(false) }
  }

  async function add() {
    if (!equipmentId || linking) return
    setLinking(true)
    try {
      const targets = selectedSerials.length ? selectedSerials : [null]
      const newLinks = []
      for (const sid of targets) {
        const res = await fetch(`${API}/warranty-cases/${caseId}/equipment`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ equipment_id: equipmentId, serial_id: sid || null }),
        })
        const data = await res.json()
        if (!res.ok) { alert(data.error || 'Không thể liên kết thiết bị'); continue }
        const sn = allSerials.find(s => String(s.id) === String(sid))
        newLinks.push({
          link_id: data.link_id, equipment_id: selectedEquip.id, name: selectedEquip.name,
          brand: selectedEquip.brand, model: selectedEquip.model,
          serial_id: sn?.id || null, serial_no: sn?.serial_no || null,
        })
      }
      if (newLinks.length) onLinked(newLinks)
      clearEquip()
    } finally { setLinking(false) }
  }

  return (
    <div ref={rootRef} className="wty-linker">
      {/* Combobox thiết bị */}
      <div className="wty-combo">
        <input className="wty-combo-input" placeholder="Gõ tên / hãng / model thiết bị..."
          value={eqQuery}
          onChange={e => { setEqQuery(e.target.value); setEqOpen(true); setEqActive(0); if (equipmentId) setEquipmentId('') }}
          onFocus={() => setEqOpen(true)}
          onKeyDown={onEqKeyDown} />
        {(eqQuery || equipmentId) && (
          <button type="button" className="wty-combo-clear" onClick={clearEquip} title="Xóa">×</button>
        )}
        {eqOpen && (
          <div className="wty-combo-menu">
            {filteredEquip.length === 0
              ? <div className="wty-combo-empty">Không có thiết bị phù hợp</div>
              : filteredEquip.map((e, i) => (
                <div key={e.id}
                  className={`wty-combo-opt ${i === eqActive ? 'active' : ''}`}
                  onMouseEnter={() => setEqActive(i)}
                  onMouseDown={ev => { ev.preventDefault(); pickEquip(e) }}>
                  <strong>{e.name}</strong>{e.model ? ` (${e.model})` : ''}
                  {e.brand && <span className="wty-combo-sub"> · {e.brand}</span>}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Multi-select serial (chỉ khi thiết bị có serial) */}
      {selectedEquip && allSerials.length > 0 && (
        <div className="wty-combo">
          <div className="wty-ms" onClick={() => setSnOpen(true)}>
            {selectedSerials.map(id => {
              const s = allSerials.find(x => x.id === id)
              return (
                <span key={id} className="wty-ms-chip">
                  {s?.serial_no || id}
                  <button type="button" onClick={ev => { ev.stopPropagation(); removeSerial(id) }}>×</button>
                </span>
              )
            })}
            <input className="wty-ms-input"
              placeholder={selectedSerials.length ? '' : 'Gõ để chọn serial (chọn nhiều)...'}
              value={snQuery}
              onChange={e => { setSnQuery(e.target.value); setSnOpen(true) }}
              onFocus={() => setSnOpen(true)}
              onKeyDown={onSnKeyDown} />
          </div>
          {snOpen && (
            <div className="wty-combo-menu">
              {filteredSerials.length === 0
                ? <div className="wty-combo-empty">{allSerials.length === selectedSerials.length ? 'Đã chọn hết serial' : 'Không có serial phù hợp'}</div>
                : filteredSerials.map(s => (
                  <div key={s.id} className="wty-combo-opt"
                    onMouseDown={ev => { ev.preventDefault(); addSerial(s) }}>
                    {s.serial_no}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      <button className="wty-btn wty-btn-primary" onClick={add} disabled={!equipmentId || linking}>
        {linking ? 'Đang thêm...' : '+ Thêm'}
      </button>
    </div>
  )
}
