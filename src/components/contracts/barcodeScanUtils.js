// Tiện ích cho luồng "Nhập serial từ barcode": quy tắc nhận dạng + lưu cấu hình.
//
// Cấu hình (cfg) có dạng:
//   { machineRule: Rule, components: [{ name, rules: [Rule, ...], count }] }
// Rule = { kind: 'length' | 'prefix', value }
//   - length : khớp khi độ dài serial == value (số)
//   - prefix : khớp khi serial bắt đầu bằng value (không phân biệt hoa/thường)
// Mỗi thành phần (component) mang tên chủng loại (name) và DANH SÁCH quy tắc: serial
// khớp thành phần khi khớp BẤT KỲ quy tắc nào — một loại có thể có nhiều tiền tố khác nhau.
// count = số lượng cần có cho MỖI máy (để trống/null = không kiểm tra số lượng).

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

// Chuẩn hóa cấu hình cũ (thành phần dạng {name,kind,value}) → {name, rules:[...], count}.
export function normalizeCfg(cfg) {
  if (!cfg) return cfg
  const components = (cfg.components || []).map(c => {
    const withRules = c.rules ? c : { name: c.name, rules: [{ kind: c.kind, value: c.value }] }
    return { ...withRules, count: withRules.count == null ? '' : withRules.count }
  })
  return { ...cfg, components }
}

// Kiểm tra số lượng thành phần đã bắn của 1 máy so với số lượng khai báo.
// Trả về mảng thông báo lỗi (rỗng = hợp lệ). count rỗng/null = bỏ qua loại đó.
export function checkComponentCounts(components, scanned) {
  const actual = new Map()
  for (const c of scanned || []) actual.set(c.name, (actual.get(c.name) || 0) + 1)
  const errors = []
  for (const comp of components || []) {
    if (comp.count === '' || comp.count == null) continue
    const want = Number(comp.count)
    if (!Number.isFinite(want) || want < 0) continue
    const got = actual.get(comp.name) || 0
    if (got !== want) errors.push(`${comp.name}: cần ${want}, đã bắn ${got}`)
  }
  return errors
}

// ── Xuất / nhập cấu hình dạng VĂN BẢN (để chuyển giữa các máy tính, người dùng đọc/sửa được) ──
// Định dạng mỗi dòng:  <Tên> [SL] = <kiểu>:<giá trị> [ | <kiểu>:<giá trị> ... ]
//   • kiểu = "prefix" (tiền tố) hoặc "length" (độ dài).
//   • [SL] (tùy chọn) = số lượng cần cho mỗi máy, vd "RAM [4]". Bỏ qua = không kiểm tra.
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
    `# Cú pháp mỗi dòng: <Tên> [SL] = <kiểu>:<giá trị> [ | <kiểu>:<giá trị> ... ]`,
    `# kiểu = prefix (tiền tố) hoặc length (độ dài). Dòng máy chính dùng tên "MÁY".`,
    `# [SL] (tùy chọn) = số lượng cần cho mỗi máy, vd "RAM [4]". Bỏ qua = không kiểm tra.`,
    `# Dòng trống hoặc bắt đầu bằng # sẽ bị bỏ qua.`,
    '',
    `MÁY = ${ruleToText(cfg?.machineRule)}`,
  ]
  for (const c of cfg?.components || []) {
    const rulesTxt = (c.rules || []).map(ruleToText).filter(Boolean).join(' | ')
    if (c.name && rulesTxt) {
      const qty = (c.count !== '' && c.count != null) ? ` [${c.count}]` : ''
      lines.push(`${c.name}${qty} = ${rulesTxt}`)
    }
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
    const rawName = line.slice(0, eq).trim()
    const rules = line.slice(eq + 1).split('|').map(parseRuleToken).filter(Boolean)
    if (!rawName || !rules.length) continue
    // Tách "[SL]" cuối tên thành số lượng (nếu có).
    const qtyMatch = rawName.match(/\s*\[(\d+)\]\s*$/)
    const name = qtyMatch ? rawName.slice(0, qtyMatch.index).trim() : rawName
    const count = qtyMatch ? qtyMatch[1] : ''
    if (!name) continue
    if (isMachineName(name)) Object.assign(machineRule, rules[0]) // máy chỉ dùng 1 quy tắc
    else components.push({ name, rules, count })
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
