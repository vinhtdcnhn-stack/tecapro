import { apiGet } from '../../../lib/api'

// Gọi API nhật ký thay đổi (chỉ admin). Trả { items, total, page, pageSize }.
export function fetchChanges(params = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v !== null && v !== undefined) qs.set(k, v)
  }
  const q = qs.toString()
  return apiGet(`/audit/changes${q ? `?${q}` : ''}`)
}

// Danh mục cho bộ lọc: { tables: string[], actors: [{id, full_name, email}] }.
export function fetchOptions() {
  return apiGet('/audit/options')
}

// Dòng thời gian của riêng một hợp đồng.
export function fetchContractTimeline(contractId, limit = 200) {
  return apiGet(`/audit/contract/${contractId}?limit=${limit}`)
}

// Lịch sử "hình thành & phát triển" của một dòng dữ liệu (table_name + row_id).
export function fetchRowTimeline(tableName, rowId) {
  return apiGet(`/audit/row/${encodeURIComponent(tableName)}/${encodeURIComponent(rowId)}`)
}
