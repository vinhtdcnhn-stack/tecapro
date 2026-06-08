import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API } from '../config/api'
import { warrantyStatus, fmtDate } from '../components/contracts/warrantyUtils'
import { ReplaceSerialModal } from '../components/contracts/SerialModals'
import '../components/contracts/ContractWarrantyTab.css'  // tái dùng style modal + badge màu
import './WarrantyLookupPage.css'

// Hạn bảo hành hiệu lực cho khách: ưu tiên hạn của serial, fallback hạn của thiết bị
const effFrom = (r) => r.warranty_from || r.eq_warranty_from || null
const effTo   = (r) => r.warranty_to   || r.eq_warranty_to   || null

function Badge({ to }) {
  const s = warrantyStatus(to)
  return <span className={`wl-badge ${s.cls}`}>{s.label}</span>
}

export default function WarrantyLookupPage() {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [result, setResult] = useState(null)   // { serial, sale[], import[] }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [replaceFor, setReplaceFor] = useState(null)

  async function search(e) {
    e?.preventDefault()
    const serial = term.trim()
    if (!serial) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch(`${API}/warranty-lookup?serial=${encodeURIComponent(serial)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lỗi tra cứu')
      setResult(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const sale = result?.sale || []
  const imp  = result?.import || []
  const found = sale.length > 0 || imp.length > 0

  return (
    <main className="page wl-page">
      <div className="wl-container">
        <h1 className="wl-title">Tra cứu bảo hành theo serial</h1>
        <p className="wl-sub">Nhập số serial của thiết bị để xem tình trạng bảo hành cho khách hàng (hợp đồng bán) và bảo hành từ nhà cung cấp (hợp đồng nhập).</p>

        <form className="wl-search" onSubmit={search}>
          <input
            className="wl-input"
            placeholder="Nhập số serial..."
            value={term}
            onChange={e => setTerm(e.target.value)}
            autoFocus
          />
          <button className="wl-btn" type="submit" disabled={loading}>
            {loading ? 'Đang tra...' : 'Tra cứu'}
          </button>
        </form>

        {error && <div className="wl-error">{error}</div>}

        {result && !found && (
          <div className="wl-empty">
            Không tìm thấy serial <strong>{result.serial}</strong> trong hệ thống.
          </div>
        )}

        {result && found && (
          <div className="wl-result">
            <div className="wl-result-head">
              Serial: <strong>{result.serial}</strong>
            </div>

            {/* ── Bảo hành cho khách hàng (HĐ bán) ── */}
            <section className="wl-card">
              <h2 className="wl-card-title">🧾 Bảo hành cho khách hàng (Hợp đồng bán)</h2>
              {sale.length === 0 ? (
                <div className="wl-none">Serial này không gắn với hợp đồng bán nào.</div>
              ) : sale.map(r => (
                <div className="wl-block" key={r.serial_id}>
                  {r.replaced_by_serial_no && (
                    <div className="wl-replaced">
                      ↳ Serial này đã được thay bằng <strong>{r.replaced_by_serial_no}</strong>
                      {r.replaced_at ? ` (ngày ${fmtDate(r.replaced_at)})` : ''}.
                    </div>
                  )}
                  {r.replacement && <ReplacementChain info={r.replacement} />}
                  <div className="wl-rows">
                    <Row label="Số hợp đồng">
                      <button className="wl-link" onClick={() => navigate(`/qlda/${r.contract_out_id}`)}>
                        {r.contract_no || `HĐ #${r.contract_out_id}`}
                      </button>
                    </Row>
                    <Row label="Dự án">{r.project_name || r.tender_name || '—'}</Row>
                    <Row label="Khách hàng">{r.customer_name || '—'}</Row>
                    <Row label="Thiết bị">
                      {r.eq_name}{r.brand ? ` — ${r.brand}` : ''}{r.model ? ` / ${r.model}` : ''}
                    </Row>
                    <Row label="Tình trạng serial">{r.status || '—'}</Row>
                    <Row label="Bảo hành cho khách">
                      {fmtDate(effFrom(r))} → {fmtDate(effTo(r))} <Badge to={effTo(r)} />
                    </Row>
                  </div>
                  {!r.replaced_by_serial_no && (
                    <div className="wl-actions">
                      <button className="wl-btn-sm" onClick={() => setReplaceFor({
                        serial: { serial_no: r.serial_no, eqName: r.eq_name,
                          warranty_from: r.warranty_from, warranty_to: r.warranty_to },
                        endpoint: `${API}/serials/${r.serial_id}/replace`,
                        showWarranty: true,
                      })}>
                        🔄 Thay thế serial
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </section>

            {/* ── Bảo hành từ nhà cung cấp (HĐ nhập) ── */}
            <section className="wl-card">
              <h2 className="wl-card-title">📦 Bảo hành từ nhà cung cấp (Hợp đồng nhập)</h2>
              {imp.length === 0 ? (
                <div className="wl-none">Serial này không gắn với hợp đồng nhập nào.</div>
              ) : imp.map((r, i) => (
                <div className="wl-block" key={`${r.contract_in_id}-${i}`}>
                  {r.replaced_by_serial_no && (
                    <div className="wl-replaced">
                      ↳ Serial này đã được thay bằng <strong>{r.replaced_by_serial_no}</strong>
                      {r.replaced_at ? ` (ngày ${fmtDate(r.replaced_at)})` : ''}.
                    </div>
                  )}
                  {r.replacement && <ReplacementChain info={r.replacement} />}
                  <div className="wl-rows">
                    <Row label="Số HĐ nhập">{r.contract_no || `HĐ nhập #${r.contract_in_id}`}</Row>
                    <Row label="Nhà cung cấp">{r.supplier_name || '—'}</Row>
                    <Row label="Loại hàng">{r.item_name || r.goods_type || '—'}</Row>
                    <Row label="Đợt nhận">
                      {r.batch_name || '—'}{r.receive_date ? ` (${fmtDate(r.receive_date)})` : ''}
                    </Row>
                    <Row label="Tình trạng serial">{r.status || '—'}</Row>
                    <Row label="NCC bảo hành cho mình">
                      {r.warranty_start || r.warranty_end
                        ? <>{fmtDate(r.warranty_start)} → {fmtDate(r.warranty_end)} <Badge to={r.warranty_end} /></>
                        : (r.warranty_period_text || '— chưa có thông tin —')}
                    </Row>
                  </div>
                  {!r.replaced_by_serial_no && (
                    <div className="wl-actions">
                      <button className="wl-btn-sm" onClick={() => setReplaceFor({
                        serial: { serial_no: r.serial_no, eqName: r.item_name },
                        endpoint: `${API}/delivery-serials/${r.serial_id}/replace`,
                        showWarranty: false,
                      })}>
                        🔄 Thay thế serial
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </section>
          </div>
        )}
      </div>

      {replaceFor && (
        <ReplaceSerialModal
          serial={replaceFor.serial}
          endpoint={replaceFor.endpoint}
          showWarranty={replaceFor.showWarranty}
          onClose={() => setReplaceFor(null)}
          onDone={async () => { setReplaceFor(null); await search() }}
        />
      )}
    </main>
  )
}

function Row({ label, children }) {
  return (
    <div className="wl-row">
      <span className="wl-row-label">{label}</span>
      <span className="wl-row-value">{children}</span>
    </div>
  )
}

// Lịch sử thay thế: cho biết serial đang xem là đời thứ mấy của thiết bị gốc nào.
function ReplacementChain({ info }) {
  const { current_index, total, root_serial_no } = info
  const summary = current_index === 0
    ? <>Đây là <strong>thiết bị gốc</strong>, đã qua <strong>{total - 1}</strong> lần thay thế.</>
    : <>Đây là <strong>lần thay thế thứ {current_index}</strong> của thiết bị gốc <strong>{root_serial_no}</strong> (tổng cộng {total - 1} lần thay).</>
  return (
    <div className="wl-chain">
      <div className="wl-chain-title">🔁 Lịch sử thay thế thiết bị</div>
      <div className="wl-chain-summary">{summary}</div>
      <ol className="wl-chain-steps">
        {info.chain.map(s => (
          <li key={s.serial_no} className={`wl-chain-step${s.is_current ? ' current' : ''}`}>
            <span className="wl-chain-gen">{s.generation === 0 ? 'Gốc' : `Lần ${s.generation}`}</span>
            <span className="wl-chain-sn">{s.serial_no}</span>
            {s.replaced_at && s.generation !== info.chain.length - 1 && (
              <span className="wl-chain-date">thay ngày {fmtDate(s.replaced_at)}</span>
            )}
            {s.is_current && <span className="wl-chain-here">← đang xem</span>}
          </li>
        ))}
      </ol>
    </div>
  )
}
