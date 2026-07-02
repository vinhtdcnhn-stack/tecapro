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

  // Thay toàn bộ ghép của dòng nhập id=rowId bằng mảng links (rỗng = bỏ hết ghép). Trả mảng link mới.
  const saveLinks = useCallback(async (rowId, links) => {
    const res = await fetch(`${API}/purchase-boq/${rowId}/supply-links`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ links: Array.isArray(links) ? links : [] }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Lưu ghép thất bại')
    return Array.isArray(data.links) ? data.links : []
  }, [])

  return { targets, reloadTargets, saveLinks }
}

// Khóa nhận diện 1 target (leaf hoặc đầu bán): "boqId:slotId" (slot rỗng khi chưa tách).
export function targetKey(boqId, slotId) {
  return `${boqId ?? ''}:${slotId ?? ''}`
}
