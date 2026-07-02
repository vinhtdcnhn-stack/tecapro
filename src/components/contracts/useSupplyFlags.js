import { useState, useEffect, useCallback } from 'react'
import { API } from '../../config/api'
import { apiGet } from '../../lib/api'

// Cờ độ phủ nhập cho tab Bảng giá bán: bản đồ { boqId: status } cho chấm màu + hàm
// bật/tắt "không cần nhập" của 1 dòng. Chỉ chứa các dòng CẦN NHẬP (server đã loại
// no_import_needed) → boqId vắng mặt = không hiện chấm.
export default function useSupplyFlags(contractId) {
  const [coverage, setCoverage] = useState({})

  const reloadCoverage = useCallback(async () => {
    try {
      const d = await apiGet(`/contracts/${contractId}/supply-coverage/summary`, { conditional: true })
      setCoverage(d && typeof d === 'object' ? d : {})
    } catch { setCoverage({}) }
  }, [contractId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { reloadCoverage() }, [reloadCoverage])

  const setNoImport = useCallback(async (boqId, value) => {
    const res = await fetch(`${API}/boq/${boqId}/no-import-needed`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    if (!res.ok) throw new Error((await res.json()).error || 'Lỗi')
  }, [])

  return { coverage, reloadCoverage, setNoImport }
}
