import { useState, useEffect, useCallback } from 'react'
import { API } from '../../config/api'

// Quản lý ghép "Nhập cho" cho tab Bảng giá mua: nạp danh sách target (hàng bán › đầu bán)
// của HĐ bán ĐANG XEM (viewContractId) + hàm lưu/bỏ ghép cho 1 dòng bảng giá nhập. 1 HĐ nhập
// có thể nhập cho nhiều HĐ bán → đứng ở HĐ bán nào thì chỉ chọn/lưu ghép cho HĐ bán đó.
// Tách khỏi ContractInBOQTab để giữ file < 500 dòng.
export default function usePurchaseBOQLink(contractInId, viewContractId) {
  const [targets, setTargets] = useState([])

  const reloadTargets = useCallback(async () => {
    try {
      const qs = viewContractId ? `?contractOutId=${viewContractId}` : ''
      const res = await fetch(`${API}/contract-ins/${contractInId}/supply-targets${qs}`)
      const data = await res.json()
      setTargets(Array.isArray(data?.targets) ? data.targets : [])
    } catch { setTargets([]) }
  }, [contractInId, viewContractId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { reloadTargets() }, [reloadTargets])

  // Thay ghép của dòng nhập id=rowId TRONG PHẠM VI HĐ bán đang xem (rỗng = bỏ hết ghép của HĐ
  // bán đó). Trả TOÀN BỘ ghép mới của dòng (mọi HĐ bán, kèm contract_out_id).
  const saveLinks = useCallback(async (rowId, links) => {
    const res = await fetch(`${API}/purchase-boq/${rowId}/supply-links`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contract_out_id: viewContractId, links: Array.isArray(links) ? links : [] }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Lưu ghép thất bại')
    return Array.isArray(data.links) ? data.links : []
  }, [viewContractId])

  return { targets, reloadTargets, saveLinks }
}

// Khóa nhận diện 1 target (leaf hoặc đầu bán): "boqId:slotId" (slot rỗng khi chưa tách).
export function targetKey(boqId, slotId) {
  return `${boqId ?? ''}:${slotId ?? ''}`
}
