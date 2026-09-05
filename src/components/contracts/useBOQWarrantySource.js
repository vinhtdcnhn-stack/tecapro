import { useState, useEffect, useMemo } from 'react'
import { apiGet } from '../../lib/api'

// Nguồn "bảng giá" cho màn hình thiết bị bàn giao (tab Bảo hành).
// Trả về:
//   leaves    : các DÒNG HÀNG (row_kind = 'leaf') của bảng giá — nơi gắn thiết bị vào
//   byId      : Map id(chuỗi) → dòng, để tra nhanh
//   defaults  : mốc bảo hành MẶC ĐỊNH cấp hợp đồng { bbId, months } (dòng bỏ trống thì theo cái này)
//   boqLocked : bảng giá đang khóa ⇒ không sửa được mốc bảo hành từ đây
//   loading   : còn đang tải (chưa biết có dòng nào)
export default function useBOQWarrantySource(contractId) {
  const [leaves, setLeaves] = useState([])
  const [info, setInfo]     = useState(null)
  const [loading, setLoad]  = useState(true)

  useEffect(() => {
    let alive = true
    if (!contractId) return
    Promise.all([
      apiGet(`/contracts/${contractId}/boq`, { conditional: true }).catch(() => []),
      apiGet(`/contracts/${contractId}`, { conditional: true }).catch(() => null),
    ]).then(([boq, ct]) => {
      if (!alive) return
      setLeaves((Array.isArray(boq) ? boq : []).filter(r => r.row_kind === 'leaf'))
      setInfo(ct || null)
      setLoad(false)
    })
    return () => { alive = false }
  }, [contractId])

  const byId = useMemo(() => new Map(leaves.map(r => [String(r.id), r])), [leaves])

  return {
    leaves,
    byId,
    defaults: {
      bbId: info?.boq_warranty_bb_id != null ? String(info.boq_warranty_bb_id) : null,
      months: info?.boq_warranty_months ?? null,
    },
    boqLocked: !!info?.boq_locked,
    loading,
  }
}
