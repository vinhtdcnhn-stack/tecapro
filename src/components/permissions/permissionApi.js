import { API } from '../../config/api'

// Client gọi API module Phân quyền. fetch wrapper toàn cục đã thêm credentials:'include'.
async function jget(url) {
  const res = await fetch(`${API}${url}`)
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Tải dữ liệu thất bại.')
  return res.json()
}
async function jput(url, body) {
  const res = await fetch(`${API}${url}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Lưu thất bại.')
  return res.json()
}
async function jsend(method, url, body) {
  const res = await fetch(`${API}${url}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Thao tác thất bại.')
  return res.json()
}

export const fetchCatalog        = () => jget('/permissions/catalog')
export const fetchForPage        = (path) => jget(`/permissions/for-page?path=${encodeURIComponent(path)}`)
export const fetchGlobalMatrix   = () => jget('/permissions/global-matrix')
export const saveGlobalPosition  = (position_id, perm_keys) => jput('/permissions/global-matrix', { position_id, perm_keys })
export const fetchPositionMembers = (positionId) => jget(`/permissions/position-members?position_id=${positionId}`)
export const addPositionMember    = (position_id, user_id) => jsend('POST', '/permissions/position-members', { position_id, user_id })
export const removePositionMember = (position_id, user_id) => jsend('DELETE', '/permissions/position-members', { position_id, user_id })
export const fetchContractMatrix = () => jget('/permissions/contract-matrix')
export const saveContractRole    = (member_role, perm_keys) => jput('/permissions/contract-matrix', { member_role, perm_keys })
export const fetchUserOverrides  = (user_id) => jget(`/permissions/user-overrides?user_id=${user_id}`)
export const saveUserOverrides   = (user_id, allow, deny) => jput('/permissions/user-overrides', { user_id, allow, deny })

// Gom danh sách perm theo `group` (giữ thứ tự sort_order). Trả [[group, perms[]], ...].
export function groupPerms(perms) {
  const order = []
  const map = new Map()
  for (const p of [...perms].sort((a, b) => a.sort_order - b.sort_order)) {
    if (!map.has(p.group)) { map.set(p.group, []); order.push(p.group) }
    map.get(p.group).push(p)
  }
  return order.map(g => [g, map.get(g)])
}
