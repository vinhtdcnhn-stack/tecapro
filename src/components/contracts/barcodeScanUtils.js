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

// ── Xuất / nhập cấu hình dạng VĂN BẢN (để chuyển giữa các máy tính, người dùng đọc/sửa được) ──
// Định dạng mỗi dòng:  <Tên> = <kiểu>:<giá trị> [ | <kiểu>:<giá trị> ... ]
//   • kiểu = "prefix" (tiền tố) hoặc "length" (độ dài).
//   • Dòng máy chính dùng tên đặc biệt "MÁY".
//   • Một loại nhiều quy tắc → nối bằng " | ".
//   • Dòng trống hoặc bắt đầu bằng "#" bị bỏ qua.

function ruleToText(rule) {
  if (!rule || rule.value === '' || rule.value == null) return ''
  return `${rule.kind}:${rule.value}`
}

export function cfgToText(machineName, cfg) {
  const lines = [
    `# Cấu hình bắn serial cho máy: ${machineName}`,
    `# Cú pháp mỗi dòng: <Tên> = <kiểu>:<giá trị> [ | <kiểu>:<giá trị> ... ]`,
    `# kiểu = prefix (tiền tố) hoặc length (độ dài). Dòng máy chính dùng tên "MÁY".`,
    `# Dòng trống hoặc bắt đầu bằng # sẽ bị bỏ qua.`,
    '',
    `MÁY = ${ruleToText(cfg?.machineRule)}`,
  ]
  for (const c of cfg?.components || []) {
    const rulesTxt = (c.rules || []).map(ruleToText).filter(Boolean).join(' | ')
    if (c.name && rulesTxt) lines.push(`${c.name} = ${rulesTxt}`)
  }
  return lines.join('\n') + '\n'
}

function normalizeKind(k) {
  const s = k.trim().toLowerCase()
  if (['prefix', 'tiền tố', 'tien to', 'tiento'].includes(s)) return 'prefix'
  if (['length', 'độ dài', 'do dai', 'dodai', 'len'].includes(s)) return 'length'
  return null
}

function isMachineName(name) {
  return ['máy', 'may', 'machine', 'máy chính', 'may chinh'].includes(name.trim().toLowerCase())
}

function parseRuleToken(token) {
  const t = token.trim()
  const colon = t.indexOf(':')
  if (colon < 0) return null
  const kind = normalizeKind(t.slice(0, colon))
  const value = t.slice(colon + 1).trim()
  if (!kind || value === '') return null
  return { kind, value }
}

// Phân tích văn bản → { machineRule, components }. Bỏ qua dòng không hợp lệ.
export function textToCfg(text) {
  const machineRule = { kind: 'length', value: '' }
  const components = []
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const name = line.slice(0, eq).trim()
    const rules = line.slice(eq + 1).split('|').map(parseRuleToken).filter(Boolean)
    if (!name || !rules.length) continue
    if (isMachineName(name)) Object.assign(machineRule, rules[0]) // máy chỉ dùng 1 quy tắc
    else components.push({ name, rules })
  }
  return { machineRule, components }
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
