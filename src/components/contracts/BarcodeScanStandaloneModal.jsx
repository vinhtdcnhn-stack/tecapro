import { useState, useRef, useEffect } from 'react'
import { API } from '../../config/api'
import { compLabel, classifyType, loadStandaloneCfg, saveStandaloneCfg } from './barcodeScanUtils'
import { useBarcodeScanner } from './useBarcodeScanner'
import useIsMobile from './useIsMobile'
import ComboInput from './ComboInput'

// ── Nhập THIẾT BỊ LẺ (máy độc lập) từ máy scan barcode ─────────────────────────
// Bước 1: chọn ĐỢT NHẬN (lấy từ tab Nhận hàng) + cấu hình nhận dạng từng CHỦNG LOẠI
//   (theo độ dài/tiền tố). Khác luồng máy+thành phần: KHÔNG có máy cha.
// Bước 2: bắn liên tục. Mỗi serial khớp một chủng loại → lưu NGAY thành serial độc
//   lập (parent_serial_id = NULL) vào đợt nhận đã chọn. Trùng → bỏ qua. Mã không khớp
//   quy tắc nào → hộp thoại nhận dạng thêm.
// Máy scan tự bắn ký tự rồi gửi phím "đuôi" (Enter + có thể kèm ký tự điều khiển);
// useBarcodeScanner nuốt trọn các phím đuôi để con trỏ không nhảy ra ngoài app.

const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }
const box     = { background:'#fff', borderRadius:12, width:'92vw', maxWidth:560, maxHeight:'88vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,.2)', padding:'20px 22px' }
const label   = { fontSize:12, fontWeight:600, color:'#374151', marginBottom:4, display:'block' }
const field   = { padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:7, fontSize:13, fontFamily:'inherit', boxSizing:'border-box', outline:'none' }
const btnPri  = { padding:'8px 18px', background:'#16a34a', color:'#fff', border:'none', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer' }
const btnSec  = { padding:'8px 16px', background:'#fff', color:'#374151', border:'1px solid #d1d5db', borderRadius:7, fontSize:13, fontWeight:500, cursor:'pointer' }

const norm = (s) => String(s || '').trim().toLowerCase()

const batchLabel = (d) =>
  `${d.batch_name || `Đợt #${d.id}`}${d.receive_date ? ` · ${new Date(d.receive_date).toLocaleDateString('vi-VN')}` : ''}`

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
        placeholder={rule.kind === 'length' ? 'Số ký tự (vd 12)' : 'Ký tự đầu (vd VN0)'}
        type={rule.kind === 'length' ? 'number' : 'text'} min="1" />
    </div>
  )
}

export default function BarcodeScanStandaloneModal({ contractInId, onClose, onSaved }) {
  const isMobile = useIsMobile()
  const saved = loadStandaloneCfg(contractInId)
  const [step, setStep]       = useState('config')
  const [types, setTypes]     = useState(saved?.types || [])
  const [deliveries, setDeliveries] = useState([])
  const [deliveryId, setDeliveryId] = useState('')
  const [savedList, setSavedList]   = useState([])   // [{ name, serial }] đã lưu trong phiên
  const [flushing, setFlushing]     = useState(false)
  const [unmatched, setUnmatched]   = useState(null)
  const [msg, setMsg]               = useState(null)  // { kind:'err'|'warn', text }
  const [allItems, setAllItems]     = useState([])    // mọi chủng loại của HĐ (gồm cả loại chỉ là linh kiện)
  const savedAnyRef  = useRef(false)
  const existingRef  = useRef(new Set())
  const chainRef     = useRef(Promise.resolve())      // serialize lưu từng serial khi bắn nhanh
  const inputRef     = useRef(null)

  const refocus = () => setTimeout(() => inputRef.current?.focus(), 0)
  useEffect(() => { if (step === 'scan') refocus() }, [step])

  // Nạp đợt nhận của HĐ + serial đã có (chặn trùng tức thì).
  useEffect(() => {
    let cancelled = false
    fetch(`${API}/contract-ins/${contractInId}/deliveries`)
      .then(r => r.json())
      .then(d => { if (!cancelled && Array.isArray(d)) {
        setDeliveries(d)
        setDeliveryId(prev => prev || (d[0]?.id ?? ''))
      } })
      .catch(() => {})
    fetch(`${API}/contract-ins/${contractInId}/all-serials`)
      .then(r => r.json())
      .then(d => { if (!cancelled && Array.isArray(d)) {
        existingRef.current = new Set(d.map(s => norm(s.serial_no)))
      } })
      .catch(() => {})
    return () => { cancelled = true }
  }, [contractInId])

  // Nạp mọi chủng loại của HĐ (kể cả loại chỉ xuất hiện như linh kiện, vd GPU/HDD)
  // để gợi ý theo đợt khi khai báo serial lạ.
  useEffect(() => {
    let cancelled = false
    fetch(`${API}/contract-ins/${contractInId}/all-items`)
      .then(r => r.json())
      .then(d => { if (!cancelled && Array.isArray(d)) setAllItems(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [contractInId])

  // Chủng loại đã có trong đợt nhận đang chọn (không trùng).
  const batchItemNames = [...new Set(
    allItems.filter(it => String(it.delivery_id) === String(deliveryId)).map(it => it.item_name).filter(Boolean)
  )]

  // ── Cấu hình chủng loại ─────────────────────────────────────────────────────
  const addType    = () => setTypes(prev => [...prev, { name:'', rules:[{ kind:'prefix', value:'' }] }])
  const setType    = (i, v) => setTypes(prev => prev.map((t, idx) => idx === i ? v : t))
  const removeType = (i) => setTypes(prev => prev.filter((_, idx) => idx !== i))
  const addRule    = (ti) => setTypes(prev => prev.map((t, idx) => idx === ti ? { ...t, rules: [...t.rules, { kind:'prefix', value:'' }] } : t))
  const setRule    = (ti, ri, v) => setTypes(prev => prev.map((t, idx) => idx === ti ? { ...t, rules: t.rules.map((r, j) => j === ri ? v : r) } : t))
  const removeRule = (ti, ri) => setTypes(prev => prev.map((t, idx) => idx === ti ? { ...t, rules: t.rules.filter((_, j) => j !== ri) } : t))

  function goScan() {
    if (!deliveryId) { alert('Hãy chọn đợt nhận để gán serial.'); return }
    const cleaned = types
      .map(t => ({ name: t.name.trim(), rules: t.rules.filter(r => r.value !== '') }))
      .filter(t => t.name && t.rules.length)
    setTypes(cleaned)
    saveStandaloneCfg(contractInId, { types: cleaned })
    setStep('scan')
  }

  // ── Lưu 1 serial độc lập ────────────────────────────────────────────────────
  async function saveOne(name, serial) {
    setFlushing(true)
    try {
      const res = await fetch(`${API}/deliveries/${deliveryId}/scan-standalone`, {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ name, serial }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg({ kind:'err', text: data.error || `Không lưu được "${serial}".` })
        return
      }
      existingRef.current.add(norm(serial))
      setSavedList(prev => [{ name, serial }, ...prev])
      savedAnyRef.current = true
      setMsg(null)
    } catch (e) {
      setMsg({ kind:'err', text: 'Lỗi lưu: ' + e.message })
    } finally { setFlushing(false) }
  }

  // ── Xử lý 1 serial vừa bắn (chạy tuần tự để dedup nhất quán) ─────────────────
  async function handleOne(raw) {
    const serial = String(raw || '').trim()
    if (!serial) return
    if (existingRef.current.has(norm(serial))) {
      setMsg({ kind:'warn', text: `Serial "${serial}" đã tồn tại — bỏ qua.` }); return
    }
    const name = classifyType(serial, types)
    if (!name) { setUnmatched(serial); return }
    await saveOne(name, serial)
  }

  function processSerial(raw) {
    setBufferExternal('')
    chainRef.current = chainRef.current.then(() => handleOne(raw)).finally(refocus)
  }

  const { buffer, setBufferExternal } = useBarcodeScanner({
    active: step === 'scan' && !unmatched,
    onSerial: processSerial,
  })

  // ── Nhận dạng thêm cho mã không khớp ────────────────────────────────────────
  async function applyRecognition(form) {
    const name = form.name.trim()
    if (!name) { alert('Nhập tên chủng loại.'); return }
    if (form.value === '') { alert('Nhập giá trị quy tắc.'); return }
    const rule = { kind: form.kind, value: form.value }
    // Tên đã có → THÊM quy tắc; chưa có → tạo loại mới.
    const next = types.some(t => norm(t.name) === norm(name))
      ? types.map(t => norm(t.name) === norm(name) ? { ...t, rules: [...t.rules, rule] } : t)
      : [...types, { name, rules: [rule] }]
    setTypes(next)
    saveStandaloneCfg(contractInId, { types: next })
    const pending = unmatched
    setUnmatched(null)
    const matched = classifyType(pending, next)
    if (matched) await saveOne(matched, pending)
    refocus()
  }

  // ── Đóng ────────────────────────────────────────────────────────────────────
  function closeModal() { if (savedAnyRef.current) onSaved?.(); else onClose() }

  // Gom serial đã lưu theo chủng loại để hiển thị.
  const grouped = () => {
    const map = new Map()
    for (const s of savedList) {
      if (!map.has(s.name)) map.set(s.name, [])
      map.get(s.name).push(s.serial)
    }
    return [...map.entries()]
  }

  // Mobile: full màn hình; boxSizing border-box để padding không đẩy nội dung tràn ngang.
  const overlayStyle = isMobile ? { ...overlay, padding:0 } : overlay
  const boxStyle = isMobile
    ? { ...box, width:'100vw', maxWidth:'none', height:'100dvh', maxHeight:'none', borderRadius:0, padding:'16px 14px', boxSizing:'border-box' }
    : box

  return (
    <div style={overlayStyle} onClick={closeModal}>
      <div style={boxStyle} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin:'0 0 4px', fontSize:16, fontWeight:700, color:'#111827' }}>Nhập thiết bị lẻ từ barcode</h3>
        <p style={{ margin:'0 0 16px', fontSize:13, color:'#6b7280' }}>
          Mỗi serial bắn được sẽ lưu thành <strong style={{ color:'#111827' }}>máy độc lập</strong> (không gắn máy cha).
        </p>

        {step === 'config' ? (
          <>
            <div style={{ marginBottom:14 }}>
              <label style={label}>Đợt nhận (gán serial vào) *</label>
              {deliveries.length === 0 ? (
                <div style={{ fontSize:12, color:'#b45309', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:7, padding:'8px 10px' }}>
                  Chưa có đợt nhận nào. Hãy tạo đợt nhận ở tab <strong>Nhận hàng</strong> trước.
                </div>
              ) : (
                <select style={{ ...field, width:'100%' }} value={deliveryId} onChange={e => setDeliveryId(e.target.value)}>
                  {deliveries.map(d => <option key={d.id} value={d.id}>{batchLabel(d)}</option>)}
                </select>
              )}
            </div>

            <div style={{ marginBottom:4, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <label style={{ ...label, margin:0 }}>Nhận dạng chủng loại</label>
              <button style={{ ...btnSec, padding:'5px 12px' }} onClick={addType}>+ Thêm chủng loại</button>
            </div>
            <div style={{ fontSize:11, color:'#9ca3af', marginBottom:8 }}>
              Mỗi chủng loại nhận dạng theo tiền tố hoặc độ dài serial. Có thể thêm sau khi bắn (mã không khớp sẽ hỏi).
            </div>
            {types.length === 0 && (
              <div style={{ fontSize:12, color:'#9ca3af', marginBottom:10 }}>
                Chưa có chủng loại nào. Nhấn "+ Thêm chủng loại" (vd GPU, HDD, PC…) hoặc cứ bắt đầu bắn rồi nhận dạng dần.
              </div>
            )}
            {types.map((t, i) => (
              <div key={i} style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:'10px 12px', marginBottom:8 }}>
                <div style={{ display:'flex', gap:6, marginBottom:8, alignItems:'center' }}>
                  <ComboInput value={t.name} onChange={v => setType(i, { ...t, name: v })}
                    options={batchItemNames} placeholder="Chọn loại đã có hoặc gõ mới (GPU, HDD, PC…)"
                    wrapStyle={{ flex:1, minWidth:0 }} inputStyle={{ ...field, width:'100%', boxSizing:'border-box' }} />
                  <button style={{ ...btnSec, padding:'8px 10px', color:'#b91c1c' }} onClick={() => removeType(i)}>✕</button>
                </div>
                {t.rules.map((r, j) => (
                  <div key={j} style={{ display:'flex', gap:6, marginBottom:6, alignItems:'center' }}>
                    <div style={{ flex:1, minWidth:0 }}><RuleInputs rule={r} onChange={v => setRule(i, j, v)} /></div>
                    <button style={{ ...btnSec, padding:'8px 10px', color:'#b91c1c' }}
                      onClick={() => removeRule(i, j)} disabled={t.rules.length === 1}>✕</button>
                  </div>
                ))}
                <button style={{ ...btnSec, padding:'4px 12px', fontSize:12 }} onClick={() => addRule(i)}>+ Thêm tiền tố/quy tắc</button>
              </div>
            ))}

            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:16 }}>
              <button style={btnSec} onClick={onClose}>Hủy</button>
              <button style={btnPri} onClick={goScan} disabled={deliveries.length === 0}>Bắt đầu bắn →</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize:12, color:'#6b7280', marginBottom:10 }}>
              Đợt nhận: <strong style={{ color:'#111827' }}>{batchLabel(deliveries.find(d => String(d.id) === String(deliveryId)) || {})}</strong>
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={label}>Bắn serial (máy scan tự xuống dòng sau mỗi mã)</label>
              <input ref={inputRef} style={{ ...field, width:'100%' }} value={buffer}
                onChange={e => setBufferExternal(e.target.value)}
                placeholder="Đưa con trỏ vào đây rồi bắn…" autoFocus />
              <div style={{ fontSize:11, color:'#6b7280', marginTop:5 }}>
                {types.length === 0 ? 'Chưa có chủng loại — mã đầu tiên sẽ hỏi nhận dạng.'
                  : types.map((t, i) => <span key={i}>{i > 0 ? ' · ' : ''}{t.name}: {compLabel(t)}</span>)}
                <button style={{ ...btnSec, padding:'2px 8px', marginLeft:8, fontSize:11 }} onClick={() => setStep('config')}>Sửa cấu hình</button>
              </div>
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>
                Mẹo: cấu hình máy scan để hậu tố (suffix) chỉ là một phím Enter và tắt chế độ phát phím chức năng.
              </div>
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ fontSize:12, fontWeight:700, color:'#16a34a' }}>✓ Đã lưu {savedList.length} serial</span>
              {flushing && <span style={{ fontSize:12, color:'#2563eb' }}>Đang lưu…</span>}
            </div>
            {msg && (
              <div style={{ fontSize:12, color: msg.kind === 'err' ? '#b91c1c' : '#b45309',
                background: msg.kind === 'err' ? '#fef2f2' : '#fffbeb',
                border: `1px solid ${msg.kind === 'err' ? '#fecaca' : '#fde68a'}`,
                borderRadius:6, padding:'6px 10px', marginBottom:8 }}>
                {msg.text}
              </div>
            )}

            <div style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:'12px 14px', marginBottom:14, maxHeight:'42vh', overflowY:'auto' }}>
              {savedList.length === 0 ? (
                <div style={{ fontSize:13, color:'#9ca3af', textAlign:'center', padding:'16px 0' }}>
                  Bắn serial để bắt đầu. Mỗi mã khớp một chủng loại sẽ được lưu ngay.
                </div>
              ) : grouped().map(([name, serials]) => (
                <div key={name} style={{ marginBottom:8 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#374151' }}>{name} <span style={{ color:'#9ca3af', fontWeight:500 }}>· {serials.length} serial</span></div>
                  {serials.map(s => (
                    <div key={s} style={{ fontSize:12, color:'#4b5563', paddingLeft:14, marginTop:2 }}>↳ {s}</div>
                  ))}
                </div>
              ))}
            </div>

            <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button style={btnPri} onClick={closeModal} disabled={flushing}>Xong</button>
            </div>
          </>
        )}

        {unmatched && (
          <UnmatchedDialog serial={unmatched}
            typeNames={batchItemNames}
            onCancel={() => { setUnmatched(null); refocus() }}
            onConfirm={applyRecognition} />
        )}
      </div>
    </div>
  )
}

// ── Hộp thoại khi serial không khớp chủng loại nào ─────────────────────────────
function UnmatchedDialog({ serial, typeNames = [], onCancel, onConfirm }) {
  const [name, setName] = useState('')
  const [rule, setRule] = useState({ kind:'prefix', value: serial.slice(0, 6) })
  // Gợi ý các chủng loại đã có trong phiên bắn (vẫn cho gõ tay tên mới).
  const suggestions = [...new Set(typeNames)]

  return (
    <div style={{ ...overlay, zIndex:1100 }} onClick={onCancel}>
      <div style={{ ...box, maxWidth:440 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin:'0 0 6px', fontSize:15, fontWeight:700, color:'#b45309' }}>Serial chưa nhận dạng được</h3>
        <p style={{ margin:'0 0 14px', fontSize:13, color:'#374151' }}>
          Mã <strong>{serial}</strong> ({serial.length} ký tự) không khớp chủng loại nào. Khai báo để lưu:
        </p>
        <div style={{ marginBottom:12 }}>
          <label style={label}>Tên chủng loại *</label>
          <ComboInput value={name} onChange={setName} options={suggestions} autoFocus
            placeholder="Chọn loại đã có hoặc gõ mới (GPU, HDD, PC…)"
            wrapStyle={{ width:'100%' }} inputStyle={{ ...field, width:'100%', boxSizing:'border-box' }} />
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={label}>Quy tắc nhận dạng cho mã này</label>
          <RuleInputs rule={rule} onChange={setRule} />
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button style={btnSec} onClick={onCancel}>Hủy & bắn lại</button>
          <button style={btnPri} onClick={() => onConfirm({ name, kind: rule.kind, value: rule.value })}>Nhận dạng & lưu</button>
        </div>
      </div>
    </div>
  )
}
