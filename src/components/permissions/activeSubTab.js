// Store ngoài React cho sub-tab đang mở của Chi tiết HĐ nhập.
// ContractInDetail giữ tab đang mở bằng state nội bộ (không lên URL), còn PermissionPanel
// mount ở app root — ngoài cây route — nên không nhận được qua context. Store nhỏ này để
// ContractInDetail publish và PermissionPanel subscribe (qua useSyncExternalStore).
let current = null
const listeners = new Set()

export function setContractInSubTab(key) {
  if (current === key) return
  current = key
  listeners.forEach(fn => fn())
}

export function subscribeContractInSubTab(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getContractInSubTab() {
  return current
}
