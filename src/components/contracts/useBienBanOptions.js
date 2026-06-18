import { useState, useEffect } from 'react'
import { API } from '../../config/api'
import { isoToDisplay } from './DateInput'

// Danh sách biên bản (tab Tiến độ biên bản) của HĐ để chọn làm mốc "Bảo hành từ".
// Bảo hành luôn tính theo NGÀY THỰC TẾ của biên bản; BB chưa có ngày thực tế vẫn liệt kê
// nhưng không cấp được ngày (label ghi rõ "chưa có ngày thực tế").
export default function useBienBanOptions(contractId) {
  const [list, setList] = useState([])

  useEffect(() => {
    let alive = true
    if (!contractId) return
    fetch(`${API}/contracts/${contractId}/progress`)
      .then(r => r.json())
      .then(d => {
        if (!alive) return
        const opts = (Array.isArray(d) ? d : [])
          .filter(r => r.bb_type_id)
          .map(r => {
            const date = String(r.actual_date || '').slice(0, 10)
            const name = r.bb_code || r.bb_name || 'Biên bản'
            return {
              id: String(r.id),
              date,
              label: date ? `${name} — ${isoToDisplay(date)}` : `${name} — (chưa có ngày thực tế)`,
            }
          })
        setList(opts)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [contractId])

  return list
}
