// Tiện ích cho luồng "Nhập serial từ barcode": quy tắc nhận dạng + lưu cấu hình.
//
// Cấu hình (cfg) có dạng:
//   { machineRule: Rule, components: [{ name, rules: [Rule, ...] }] }
// Rule = { kind: 'length' | 'prefix', value }
//   - length : khớp khi độ dài serial == value (số)
//   - prefix : khớp khi serial bắt đầu bằng value (không phân biệt hoa/thường)
// Mỗi thành phần (component) mang tên chủng loại (name) và DANH SÁCH quy tắc: serial
// khớp thành phần khi khớp BẤT KỲ quy tắc nào — một loại có thể có nhiều tiền tố khác nhau.

export function matchRule(serial, rule) {
  if (!rule || rule.value === '' || rule.value == null) return false
  const s = String(serial)
  if (rule.kind === 'length') return s.length === Number(rule.value)
  if (rule.kind === 'prefix') return s.toUpperCase().startsWith(String(rule.value).toUpperCase())
  return false
}

// Serial khớp một thành phần nếu khớp BẤT KỲ quy tắc nào của nó.
export function matchComponent(serial, comp) {
  return (comp.rules || []).some(r => matchRule(serial, r))
}

// Trả { role:'machine' } | { role:'component', name } | null (không khớp gì).
// Ưu tiên quy tắc máy trước, rồi tới các thành phần theo thứ tự; khớp đầu tiên thắng.
export function classify(serial, cfg) {
  if (matchRule(serial, cfg.machineRule)) return { role: 'machine' }
  for (const c of cfg.components || []) {
    if (matchComponent(serial, c)) return { role: 'component', name: c.name }
  }
  return null
}

export function ruleLabel(rule) {
  if (!rule || rule.value === '' || rule.value == null) return '—'
  return rule.kind === 'length' ? `Độ dài = ${rule.value}` : `Tiền tố "${rule.value}"`
}

// Nhãn cho 1 thành phần: nối nhiều quy tắc bằng "hoặc".
export function compLabel(comp) {
  const parts = (comp.rules || []).filter(r => r.value !== '' && r.value != null).map(ruleLabel)
  return parts.length ? parts.join(' hoặc ') : '—'
}

// Chuẩn hóa cấu hình cũ (thành phần dạng {name,kind,value}) → {name, rules:[...]}.
export function normalizeCfg(cfg) {
  if (!cfg) return cfg
  const components = (cfg.components || []).map(c =>
    c.rules ? c : { name: c.name, rules: [{ kind: c.kind, value: c.value }] },
  )
  return { ...cfg, components }
}

// ── localStorage: cấu hình lưu theo HĐ nhập, ánh xạ theo tên chủng loại máy ──────
const storageKey = (contractInId) => `barcodeCfg:in:${contractInId}`

export function loadCfg(contractInId, machineName) {
  try {
    const all = JSON.parse(localStorage.getItem(storageKey(contractInId)) || '{}')
    return all[machineName] ? normalizeCfg(all[machineName]) : null
  } catch { return null }
}

export function saveCfg(contractInId, machineName, cfg) {
  try {
    const all = JSON.parse(localStorage.getItem(storageKey(contractInId)) || '{}')
    all[machineName] = cfg
    localStorage.setItem(storageKey(contractInId), JSON.stringify(all))
  } catch { /* bỏ qua nếu localStorage không khả dụng */ }
}
