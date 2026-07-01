import { useState, useEffect, useCallback } from 'react'
import { API } from '../../config/api'

// Quản lý ghép "Nhập cho" cho tab Bảng giá mua: nạp danh sách target (hàng bán › đầu bán)
// của HĐ bán cha + hàm lưu/bỏ ghép cho 1 dòng bảng giá nhập. Tách khỏi ContractInBOQTab
// để giữ file < 500 dòng.
export default function usePurchaseBOQLink(contractInId) {
  const [targets, setTargets] = useState([])

  const reloadTargets = useCallback(async () => {
    try {
      const res = await fetch(`${API}/contract-ins/${contractInId}/supply-targets`)
      const data = await res.json()
      setTargets(Array.isArray(data?.targets) ? data.targets : [])
    } catch { setTargets([]) }
  }, [contractInId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { reloadTargets() }, [reloadTargets])

  // Lưu/bỏ ghép cho dòng nhập id=rowId. boq_id rỗng = bỏ ghép. Trả link mới (hoặc null).
  const saveLink = useCallback(async (rowId, { boq_id, slot_id, covered_qty }) => {
    const res = await fetch(`${API}/purchase-boq/${rowId}/supply-link`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boq_id, slot_id, covered_qty }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Lưu ghép thất bại')
    return data.link || null
  }, [])

  return { targets, reloadTargets, saveLink }
}

// Khóa nhận diện 1 target (leaf hoặc đầu bán): "boqId:slotId" (slot rỗng khi chưa tách).
export function targetKey(boqId, slotId) {
  return `${boqId ?? ''}:${slotId ?? ''}`
}
