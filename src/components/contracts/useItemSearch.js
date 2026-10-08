import { useState, useEffect } from 'react'
import { apiGet } from '../../lib/api'

// Tìm HĐ bán theo TÊN HÀNG HÓA trong bảng giá (server tìm, không phân biệt dấu).
// Trả về { itemTerm, setItemTerm, matches, loading }:
//   matches = null khi chưa gõ (không lọc), hoặc Map(contractId → số dòng hàng khớp).
// Gõ dưới 2 ký tự coi như chưa gõ; đợi 300ms sau lần gõ cuối mới gọi server.
export function useItemSearch() {
  const [itemTerm, setItemTerm] = useState('')
  const [matches, setMatches] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const q = itemTerm.trim()
    if (q.length < 2) {
      setMatches(null)   // eslint-disable-line react-hooks/set-state-in-effect -- xóa kết quả khi bỏ từ khóa
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const rows = await apiGet(`/contracts/search-items?q=${encodeURIComponent(q)}`)
        if (!cancelled) setMatches(new Map((rows || []).map(r => [String(r.contract_out_id), r.match_count])))
      } catch {
        if (!cancelled) setMatches(new Map())
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [itemTerm])

  return { itemTerm, setItemTerm, matches, loading }
}
