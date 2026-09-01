import { useState, useEffect, useMemo } from 'react'
import { apiGet } from '../../lib/api'
import { isoToDisplay } from './DateInput'

// Danh sách biên bản (tab Tiến độ biên bản) của HĐ để chọn làm mốc "Bảo hành từ".
// Bảo hành luôn tính theo NGÀY THỰC TẾ của biên bản; BB chưa có ngày thực tế vẫn liệt kê
// nhưng không cấp được ngày (label ghi rõ "chưa có ngày thực tế").
//
// side: 'out' = biên bản của HĐ bán (contract_out_progress, mặc định)
//       'in'  = biên bản của chính HĐ nhập (contract_in_progress) — bảo hành NCC tính
//               từ ngày nghiệm thu/bàn giao với nhà cung cấp.
export default function useBienBanOptions(contractId, side = 'out') {
  const [list, setList] = useState([])

  useEffect(() => {
    let alive = true
    if (!contractId) return
    const path = side === 'in'
      ? `/contract-ins/${contractId}/progress`
      : `/contracts/${contractId}/progress`
    apiGet(path, { conditional: true })
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
              name,
              label: date ? `${name} — ${isoToDisplay(date)}` : `${name} — (chưa có ngày thực tế)`,
            }
          })
        setList(opts)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [contractId, side])

  return list
}

// Tra nhanh biên bản theo id (chuỗi) — dùng cho bảng giá tính hiệu lực bảo hành từng dòng.
export function useBienBanMap(list) {
  return useMemo(() => new Map(list.map(b => [b.id, b])), [list])
}
