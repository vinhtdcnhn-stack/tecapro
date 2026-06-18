import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { API } from '../../config/api'
import { classify, ruleLabel, compLabel, checkComponentCounts, loadCfg, saveCfg, cfgToText, textToCfg } from './barcodeScanUtils'
import { useBarcodeScanner } from './useBarcodeScanner'
import useIsMobile from './useIsMobile'
import ComboInput from './ComboInput'

// ── Nhập serial hàng loạt từ máy scan barcode ──────────────────────────────────
// Bước 1: cấu hình nhận dạng (máy chính + các loại thành phần, theo độ dài/tiền tố).
// Bước 2: bắn liên tục. Mỗi serial khớp máy = sang MÁY MỚI → lưu ngay máy đang bắn vào
// DB (1 transaction/máy), rồi hiển thị lại từ đầu cho máy mới. Trùng khi lưu → từ chối
// CẢ máy lẫn thành phần (không query từng serial). Mã không khớp → hộp thoại xử lý.

// zIndex 1200 để nổi trên cả bottom-sheet (msheet-overlay z-index 1100) khi mở lồng từ sheet serial.
const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1200, padding:16 }
const box     = { background:'#fff', borderRadius:12, width:'92vw', maxWidth:560, maxHeight:'88vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,.2)', padding:'20px 22px' }
const label   = { fontSize:12, fontWeight:600, color:'#374151', marginBottom:4, display:'block' }
const field   = { padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:7, fontSize:13, fontFamily:'inherit', boxSizing:'border-box', outline:'none' }
const btnPri  = { padding:'8px 18px', background:'#16a34a', color:'#fff', border:'none', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer' }
const btnSec  = { padding:'8px 16px', background:'#fff', color:'#374151', border:'1px solid #d1d5db', borderRadius:7, fontSize:13, fontWeight:500, cursor:'pointer' }

const norm = (s) => String(s || '').trim().toLowerCase()

// Một dòng quy tắc: chọn kiểu (độ dài/tiền tố) + giá trị.
function RuleInputs({ rule, onChange }) {
  return (
    <div style={{ display:'flex', gap:6 }}>
      <select style={{ ...field, flex:'0 0 110px' }} value={rule.kind}
        onChange={e => onChange({ ...rule, kind: e.target.value })}>
        <option value="prefix">Tiền tố</option>
        <option value="length">Độ dài</option>
      </select>
      <input style={{ ...field, flex:1, minWidth:0 }}
        value={rule.value}
        onChange={e => onChange({ ...rule, value: e.target.value })}
        placeholder={rule.kind === 'length' ? 'Số ký tự (vd 12)' : 'Ký tự đầu (vd WD)'}
        type={rule.kind === 'length' ? 'number' : 'text'} min="1" />
    </div>
  )
}

export default function BarcodeScanImportModal({ machineItem, deliveryId, contractInId, onClose, onSaved }) {
  const isMobile = useIsMobile()
  const saved = loadCfg(contractInId, machineItem.item_name)
  const [step, setStep] = useState('config')
  const [machineRule, setMachineRule] = useState(saved?.machineRule || { kind:'length', value:'' })
  const [components, setComponents]   = useState(saved?.components || [])
  const [current, setCurrent]         = useState(null)   // máy đang bắn: { machineSerial, components:[{name,serial}] }
  const [savedCount, setSavedCount]   = useState(0)       // số máy đã lưu trong phiên
  const [existing, setExisting]       = useState(() => new Set())  // serial đã có (cache)
  const [flushing, setFlushing]       = useState(false)
  const [unmatched, setUnmatched]     = useState(null)
  const [learnedNote, setLearnedNote] = useState('')  // báo đã tự học SL từ máy đầu tiên
  const [allItems, setAllItems]       = useState([])  // chủng loại của HĐ (gợi ý tên thành phần)
  const savedAnyRef = useRef(false)
  const inputRef = useRef(null)
  const cfgFileRef = useRef(null)
  const flushingRef = useRef(false)

  const cfgNow = () => ({ machineRule, components })

  // ── Xuất / nhập cấu hình ra file text (chuyển cấu hình giữa các máy tính) ────────
  function exportCfg() {
    const text = cfgToText(machineItem.item_name, cfgNow())
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `cau-hinh-serial-${(machineItem.item_name || 'may').replace(/[^\w]+/g, '_')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importCfg(e) {
    const file = e.target.files?.[0]
    if (cfgFileRef.current) cfgFileRef.current.value = ''
    if (!file) return
    try {
      const cfg = textToCfg(await file.text())
      if (!cfg.machineRule.value && !cfg.components.length) {
        alert('File cấu hình không đọc được quy tắc nào. Kiểm tra lại định dạng.')
        return
      }
      setMachineRule(cfg.machineRule)
      setComponents(cfg.components)
      saveCfg(contractInId, machineItem.item_name, cfg)
      alert(`Đã nạp cấu hình: máy + ${cfg.components.length} loại thành phần.`)
    } catch (err) {
      alert('Lỗi đọc file: ' + err.message)
    }
  }
  const refocus = () => setTimeout(() => inputRef.current?.focus(), 0)

  useEffect(() => { if (step === 'scan') refocus() }, [step])

  // Nạp sẵn serial đã có của HĐ nhập này để chặn trùng tức thì (1 lần, không query/serial).
  useEffect(() => {
    let cancelled = false
    fetch(`${API}/contract-ins/${contractInId}/all-serials`)
      .then(r => r.json())
      .then(d => { if (!cancelled && Array.isArray(d)) setExisting(new Set(d.map(s => norm(s.serial_no)))) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [contractInId])

  // Nạp mọi chủng loại của HĐ (kể cả loại chỉ là linh kiện) để gợi ý tên thành phần.
  useEffect(() => {
    let cancelled = false
    fetch(`${API}/contract-ins/${contractInId}/all-items`)
      .then(r => r.json())
      .then(d => { if (!cancelled && Array.isArray(d)) setAllItems(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [contractInId])

  // Chủng loại đã có trong đợt nhận này (gợi ý), bỏ chính máy chính & trùng.
  const batchItemNames = [...new Set(
    allItems
      .filter(it => String(it.delivery_id) === String(deliveryId) && it.item_name !== machineItem.item_name)
      .map(it => it.item_name).filter(Boolean)
  )]

  // ── Cấu hình ──────────────────────────────────────────────────────────────
  const addComp    = () => setComponents(prev => [...prev, { name:'', rules:[{ kind:'prefix', value:'' }], count:'' }])
  const setComp    = (i, v) => setComponents(prev => prev.map((c, idx) => idx === i ? v : c))
  const removeComp = (i) => setComponents(prev => prev.filter((_, idx) => idx !== i))
  const addRule    = (ci) => setComponents(prev => prev.map((c, idx) => idx === ci ? { ...c, rules: [...c.rules, { kind:'prefix', value:'' }] } : c))
  const setRule    = (ci, ri, v) => setComponents(prev => prev.map((c, idx) => idx === ci ? { ...c, rules: c.rules.map((r, j) => j === ri ? v : r) } : c))
  const removeRule = (ci, ri) => setComponents(prev => prev.map((c, idx) => idx === ci ? { ...c, rules: c.rules.filter((_, j) => j !== ri) } : c))

  function goScan() {
    if (machineRule.value === '') { alert('Hãy nhập quy tắc nhận dạng cho máy chính.'); return }
    const comps = components
      .map(c => ({ name: c.name.trim(), rules: c.rules.filter(r => r.value !== ''), count: c.count }))
      .filter(c => c.name && c.rules.length)
    setComponents(comps)
    saveCfg(contractInId, machineItem.item_name, { machineRule, components: comps })
    setStep('scan')
  }

  // ── Lưu 1 máy vào DB (transaction phía server) ──────────────────────────────
  async function flush(machine) {
    flushingRef.current = true
    setFlushing(true)
    try {
      const res  = await fetch(`${API}/deliveries/${deliveryId}/scan-batch`, {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ machineItemId: machineItem.id, machineSerial: machine.machineSerial, components: machine.components }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409) {
          const dups = (data.duplicates || []).join(', ') || data.error
          alert(`Máy "${machine.machineSerial}" bị trùng serial: ${dups}.\nĐề nghị bắn lại.`)
        } else {
          alert(`Máy "${machine.machineSerial}" lưu lỗi: ${data.error || 'lỗi'}`)
        }
        return false
      }
      savedAnyRef.current = true
      setSavedCount(c => c + 1)
      setExisting(prev => {
        const n = new Set(prev); n.add(norm(machine.machineSerial))
        machine.components.forEach(c => n.add(norm(c.serial))); return n
      })
      return true
    } catch (e) { alert('Lỗi lưu: ' + e.message); return false }
    finally { flushingRef.current = false; setFlushing(false) }
  }

  // Sau khi máy ĐẦU TIÊN lưu thành công: tự suy số lượng từng loại thành phần từ chính máy
  // đó và ghi vào cấu hình (chỉ điền vào ô SL còn trống — tôn trọng SL người dùng đã khai).
  // Các máy bắn sau sẽ được kiểm tra số lượng theo SL vừa học này.
  function learnCounts(machine) {
    // Nếu MỌI loại đã có SL (khai tay hoặc nhập từ file) → không học, không ghi lại,
    // giữ nguyên cấu hình và kiểm tra như bình thường theo SL đã có.
    if ((components || []).every(c => c.count !== '' && c.count != null)) return

    const counts = new Map()
    for (const c of machine.components) counts.set(c.name, (counts.get(c.name) || 0) + 1)
    const learned = []
    const next = components.map(c => {
      if (c.count !== '' && c.count != null) return c   // giữ SL đã có (khai tay / nhập file)
      const got = counts.get(c.name) || 0
      if (got <= 0) return c                              // máy đầu không có loại này → không khóa
      learned.push(`${c.name} ×${got}`)
      return { ...c, count: String(got) }
    })
    if (!learned.length) return                           // không có gì mới để học → không ghi lại

    setComponents(next)
    saveCfg(contractInId, machineItem.item_name, { machineRule, components: next })
    setLearnedNote(`Đã tự lưu SL thành phần từ máy đầu: ${learned.join(', ')}`)
  }

  // Kiểm tra số lượng thành phần khai báo; thiếu/thừa → cảnh báo & trả false (giữ nguyên máy).
  function ensureCounts(machine) {
    const errs = checkComponentCounts(components, machine.components)
    if (!errs.length) return true
    alert(`Máy "${machine.machineSerial}" số lượng thành phần chưa khớp khai báo, không thể lưu:\n• ${errs.join('\n• ')}\n\nHãy bổ sung/bớt thành phần cho đúng rồi thử lại.`)
    return false
  }

  // ── Nhận 1 serial đã phân loại ──────────────────────────────────────────────
  async function acceptSerial(serial, cls) {
    if (!cls) { setUnmatched(serial); return }
    if (cls.role === 'machine') {
      if (current) {
        if (!ensureCounts(current)) return       // thiếu/thừa số lượng: giữ máy hiện tại, bỏ qua mã máy mới
        const wasFirst = !savedAnyRef.current     // máy này là máy đầu tiên của phiên?
        const ok = await flush(current)
        if (!ok) { setCurrent(null); return }   // trùng/lỗi: clear máy hiện tại để bắn lại, bỏ qua mã vừa bắn
        if (wasFirst) learnCounts(current)        // máy đầu lưu xong → tự học SL thành phần
      }
      setCurrent({ machineSerial: serial, components: [] })
    } else {
      if (!current) { alert('Hãy bắn serial MÁY trước khi bắn thành phần.'); return }
      setCurrent(prev => ({ ...prev, components: [...prev.components, { name: cls.name, serial }] }))
    }
  }

  // Xử lý 1 serial đã commit (dùng chung cho máy scan qua hook lẫn dán/gõ tay + Enter).
  async function processSerial(raw) {
    const serial = String(raw || '').trim()
    setBufferExternal('')
    if (!serial) return
    if (flushingRef.current) return   // đang lưu máy: bỏ qua, tránh lưu chồng
    if (existing.has(norm(serial))) {
      alert(`Serial "${serial}" đã tồn tại trong hệ thống — không thể nhập trùng.`); refocus(); return
    }
    if (current && [current.machineSerial, ...current.components.map(c => c.serial)].some(s => norm(s) === norm(serial))) {
      alert(`Serial "${serial}" vừa bắn cho máy hiện tại.`); refocus(); return
    }
    await acceptSerial(serial, classify(serial, cfgNow()))
    refocus()
  }

  // Hook bắt phím ở cấp window khi đang ở bước "bắn" — nuốt mọi phím đuôi/điều khiển
  // của máy scan để không lọt xuống Windows (mở app khác).
  // Tạm dừng bắt phím khi hộp thoại "không khớp" đang mở để người dùng gõ được vào form.
  const { buffer, setBufferExternal } = useBarcodeScanner({
    active: step === 'scan' && !unmatched,
    onSerial: processSerial,
  })

  const removeCurrentComp = (serial) =>
    setCurrent(prev => prev ? { ...prev, components: prev.components.filter(c => c.serial !== serial) } : prev)

  // ── Nhận dạng thêm cho mã không khớp ────────────────────────────────────────
  async function applyRecognition(form) {
    const rule = { kind: form.kind, value: form.value }
    if (rule.value === '') { alert('Nhập giá trị quy tắc.'); return }
    let nextMachine = machineRule, nextComps = components
    if (form.role === 'machine') {
      nextMachine = rule
    } else {
      const name = form.name.trim()
      if (!name) { alert('Nhập tên chủng loại thành phần.'); return }
      // Tên đã có → THÊM quy tắc (1 loại nhiều tiền tố); chưa có → tạo loại mới.
      nextComps = components.some(c => norm(c.name) === norm(name))
        ? components.map(c => norm(c.name) === norm(name) ? { ...c, rules: [...c.rules, rule] } : c)
        : [...components, { name, rules: [rule], count: '' }]
    }
    setMachineRule(nextMachine); setComponents(nextComps)
    saveCfg(contractInId, machineItem.item_name, { machineRule: nextMachine, components: nextComps })
    const pending = unmatched
    setUnmatched(null)
    await acceptSerial(pending, classify(pending, { machineRule: nextMachine, components: nextComps }))
    refocus()
  }

  // ── Đóng / kết thúc ─────────────────────────────────────────────────────────
  function closeModal() { if (savedAnyRef.current) onSaved?.(); else onClose() }

  async function finish() {
    if (current) {
      if (!ensureCounts(current)) return       // thiếu/thừa số lượng: giữ máy & modal mở
      const ok = await flush(current)
      if (!ok) { setCurrent(null); return }   // trùng/lỗi: clear để bắn lại, giữ modal mở
      setCurrent(null)
    }
    closeModal()
  }

  function cancel() {
    if (current && !confirm('Máy đang bắn (chưa lưu) sẽ bị bỏ. Đóng?')) return
    closeModal()
  }

  // Gom thành phần của máy hiện tại theo tên: [ [name, [serial...]] ]
  const groupedCurrent = () => {
    const map = new Map()
    for (const c of current?.components || []) {
      if (!map.has(c.name)) map.set(c.name, [])
      map.get(c.name).push(c.serial)
    }
    return [...map.entries()]
  }

  const curCount = current ? 1 + current.components.length : 0

  // Mobile: full màn hình cho dễ thao tác (bắn barcode, cấu hình nhiều dòng).
  // boxSizing border-box để padding không đẩy nội dung tràn ngang ra ngoài 100vw.
  const overlayStyle = isMobile ? { ...overlay, padding:0 } : overlay
  const boxStyle = isMobile
    ? { ...box, width:'100vw', maxWidth:'none', height:'100dvh', maxHeight:'none', borderRadius:0, padding:'16px 14px', boxSizing:'border-box' }
    : box

  return createPortal(
    <div style={overlayStyle} onClick={cancel}>
      <div style={boxStyle} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin:'0 0 4px', fontSize:16, fontWeight:700, color:'#111827' }}>Nhập serial từ barcode</h3>
        <p style={{ margin:'0 0 16px', fontSize:13, color:'#6b7280' }}>
          Máy chính: <strong style={{ color:'#111827' }}>{machineItem.item_name}</strong>
        </p>

        {step === 'config' ? (
          <>
            <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
              <button style={{ ...btnSec, padding:'6px 12px', fontSize:12 }} onClick={exportCfg}>⬇ Xuất cấu hình (.txt)</button>
              <label style={{ ...btnSec, padding:'6px 12px', fontSize:12, cursor:'pointer', display:'inline-flex', alignItems:'center' }}>
                ⬆ Nhập cấu hình từ file
                <input ref={cfgFileRef} type="file" accept=".txt,text/plain" style={{ display:'none' }} onChange={importCfg} />
              </label>
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={label}>Nhận dạng serial MÁY chính *</label>
              <RuleInputs rule={machineRule} onChange={setMachineRule} />
            </div>

            <div style={{ marginBottom:4, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <label style={{ ...label, margin:0 }}>Các loại thành phần</label>
              <button style={{ ...btnSec, padding:'5px 12px' }} onClick={addComp}>+ Thêm loại</button>
            </div>
            <div style={{ fontSize:11, color:'#9ca3af', marginBottom:8 }}>
              Ô <strong>SL</strong> = số lượng cần cho mỗi máy (vd RAM = 4). Bắn thiếu/thừa sẽ bị chặn lưu. Để trống = không kiểm tra.
            </div>
            {components.length === 0 && (
              <div style={{ fontSize:12, color:'#9ca3af', marginBottom:10 }}>
                Chưa có thành phần nào. Nhấn "+ Thêm loại" (vd HDD, RAM…) hoặc thêm sau khi bắn.
              </div>
            )}
            {components.map((c, i) => (
              <div key={i} style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:'10px 12px', marginBottom:8 }}>
                <div style={{ display:'flex', gap:6, marginBottom:8, alignItems:'center' }}>
                  <ComboInput value={c.name} onChange={v => setComp(i, { ...c, name: v })}
                    options={batchItemNames} placeholder="Chọn loại đã có hoặc gõ mới (Mainboard, HDD…)"
                    wrapStyle={{ flex:1, minWidth:0 }} inputStyle={{ ...field, width:'100%', boxSizing:'border-box' }} />
                  <input style={{ ...field, flex:'0 0 56px', minWidth:0, textAlign:'center' }} type="number" min="0"
                    value={c.count ?? ''} onChange={e => setComp(i, { ...c, count: e.target.value })}
                    placeholder="SL" title="Số lượng cần cho mỗi máy (để trống = không kiểm tra)" />
                  <button style={{ ...btnSec, padding:'8px 10px', color:'#b91c1c' }} onClick={() => removeComp(i)}>✕</button>
                </div>
                {c.rules.map((r, j) => (
                  <div key={j} style={{ display:'flex', gap:6, marginBottom:6, alignItems:'center' }}>
                    <div style={{ flex:1, minWidth:0 }}><RuleInputs rule={r} onChange={v => setRule(i, j, v)} /></div>
                    <button style={{ ...btnSec, padding:'8px 10px', color:'#b91c1c' }}
                      onClick={() => removeRule(i, j)} disabled={c.rules.length === 1}>✕</button>
                  </div>
                ))}
                <button style={{ ...btnSec, padding:'4px 12px', fontSize:12 }} onClick={() => addRule(i)}>+ Thêm tiền tố/quy tắc</button>
              </div>
            ))}

            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:16 }}>
              <button style={btnSec} onClick={onClose}>Hủy</button>
              <button style={btnPri} onClick={goScan}>Bắt đầu bắn →</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom:12 }}>
              <label style={label}>Bắn serial (máy scan tự xuống dòng sau mỗi mã)</label>
              <input ref={inputRef} style={{ ...field, width:'100%' }} value={buffer}
                onChange={e => setBufferExternal(e.target.value)}
                placeholder="Đưa con trỏ vào đây rồi bắn…" autoFocus />
              <div style={{ fontSize:11, color:'#6b7280', marginTop:5 }}>
                Máy: {ruleLabel(machineRule)}
                {components.map((c, i) => <span key={i}> · {c.name}: {compLabel(c)}{(c.count !== '' && c.count != null) ? ` (×${c.count})` : ''}</span>)}
                <button style={{ ...btnSec, padding:'2px 8px', marginLeft:8, fontSize:11 }} onClick={() => setStep('config')}>Sửa cấu hình</button>
              </div>
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>
                Mẹo: cấu hình máy scan để hậu tố (suffix) chỉ là một phím Enter và tắt chế độ phát phím chức năng.
              </div>
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ fontSize:12, fontWeight:700, color:'#16a34a' }}>✓ Đã lưu {savedCount} máy</span>
              {flushing && <span style={{ fontSize:12, color:'#2563eb' }}>Đang lưu máy…</span>}
            </div>
            {learnedNote && (
              <div style={{ fontSize:11, color:'#15803d', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:6, padding:'6px 10px', marginBottom:8 }}>
                ✓ {learnedNote} — các máy sau sẽ kiểm tra theo số lượng này.
              </div>
            )}

            <div style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:'12px 14px', marginBottom:14, maxHeight:'42vh', overflowY:'auto' }}>
              {!current ? (
                <div style={{ fontSize:13, color:'#9ca3af', textAlign:'center', padding:'16px 0' }}>
                  Bắn serial MÁY để bắt đầu. Bắn serial máy kế tiếp sẽ tự lưu máy hiện tại.
                </div>
              ) : (
                <>
                  <div style={{ fontSize:14, fontWeight:700, color:'#1d4ed8', marginBottom:8 }}>🖥 {current.machineSerial}</div>
                  {current.components.length === 0 ? (
                    <div style={{ fontSize:12, color:'#9ca3af', paddingLeft:18 }}>Chưa bắn thành phần nào cho máy này.</div>
                  ) : groupedCurrent().map(([name, serials]) => {
                    const want = components.find(c => c.name === name)?.count
                    const hasWant = want !== '' && want != null
                    const mismatch = hasWant && serials.length !== Number(want)
                    return (
                    <div key={name} style={{ marginBottom:8, paddingLeft:12 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#374151' }}>{name} <span style={{ color: mismatch ? '#dc2626' : '#9ca3af', fontWeight:500 }}>· {serials.length}{hasWant ? `/${want}` : ''} serial{mismatch ? ' ⚠' : ''}</span></div>
                      {serials.map(s => (
                        <div key={s} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#4b5563', paddingLeft:14, marginTop:2 }}>
                          ↳ {s}
                          <button style={{ background:'none', border:'none', color:'#cbd5e1', cursor:'pointer', fontSize:13 }} onClick={() => removeCurrentComp(s)}>✕</button>
                        </div>
                      ))}
                    </div>
                  )})}
                </>
              )}
            </div>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:12, color:'#6b7280' }}>{current ? `Máy hiện tại: ${curCount} serial` : '—'}</span>
              <div style={{ display:'flex', gap:8 }}>
                <button style={btnSec} onClick={cancel}>Đóng</button>
                <button style={btnPri} onClick={finish} disabled={flushing}>
                  {current ? 'Lưu máy này & đóng' : 'Đóng'}
                </button>
              </div>
            </div>
          </>
        )}

        {unmatched && (
          <UnmatchedDialog serial={unmatched} typeNames={batchItemNames}
            onCancel={() => { setUnmatched(null); refocus() }}
            onConfirm={applyRecognition} />
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Hộp thoại khi serial không khớp định dạng nào ──────────────────────────────
function UnmatchedDialog({ serial, typeNames = [], onCancel, onConfirm }) {
  const [role, setRole] = useState('component')
  const [name, setName] = useState('')
  const [rule, setRule] = useState({ kind:'prefix', value: serial.slice(0, 6) })

  return (
    <div style={{ ...overlay, zIndex:1100 }} onClick={onCancel}>
      <div style={{ ...box, maxWidth:440 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin:'0 0 6px', fontSize:15, fontWeight:700, color:'#b45309' }}>Serial không khớp định dạng</h3>
        <p style={{ margin:'0 0 14px', fontSize:13, color:'#374151' }}>
          Mã <strong>{serial}</strong> ({serial.length} ký tự) không khớp quy tắc nào. Chọn cách xử lý:
        </p>
        <div style={{ marginBottom:12 }}>
          <label style={label}>Nhận dạng là</label>
          <select style={{ ...field, width:'100%' }} value={role} onChange={e => setRole(e.target.value)}>
            <option value="component">Một loại thành phần</option>
            <option value="machine">Serial máy chính</option>
          </select>
        </div>
        {role === 'component' && (
          <div style={{ marginBottom:12 }}>
            <label style={label}>Tên chủng loại thành phần *</label>
            <ComboInput value={name} onChange={setName} options={[...new Set(typeNames)]} autoFocus
              placeholder="Chọn loại đã có hoặc gõ mới (vd Mainboard)"
              wrapStyle={{ width:'100%' }} inputStyle={{ ...field, width:'100%', boxSizing:'border-box' }} />
          </div>
        )}
        <div style={{ marginBottom:16 }}>
          <label style={label}>Quy tắc nhận dạng cho mã này</label>
          <RuleInputs rule={rule} onChange={setRule} />
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button style={btnSec} onClick={onCancel}>Hủy & bắn lại</button>
          <button style={btnPri} onClick={() => onConfirm({ role, name, kind: rule.kind, value: rule.value })}>Nhận dạng thêm</button>
        </div>
      </div>
    </div>
  )
}
