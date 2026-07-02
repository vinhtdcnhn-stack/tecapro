import { useState, useEffect, useCallback } from 'react'
import { fetchHints, resetHints, fetchSlowQueries } from './cacheHintApi'
import SystemDashboard from './SystemDashboard'

// Trang admin "Chẩn đoán hiệu năng": XEM route đọc nóng/chậm để quyết định chỗ nào nên bọc
// cache (không tự cache gì). Hai lớp tách thành 2 tab: ① đo per-route (in-memory),
// ② pg_stat_statements.

const fmtMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`)
const fmtTime = (iso) => { try { return new Date(iso).toLocaleTimeString('vi-VN') } catch { return '' } }

// Nút toolbar cùng chiều cao/căn lề (bỏ margin-bottom của .add-btn và đồng bộ padding với
// .edit-btn để 3 phần tử trên một hàng thẳng hàng).
const btnStyle = { margin: 0, padding: '8px 14px', fontSize: 14, borderRadius: 8, lineHeight: 1.2 }

export default function CacheHintPage() {
  const [tab, setTab] = useState('system') // 'system' | 'routes' | 'queries'
  const [hints, setHints] = useState(null)
  const [slow, setSlow] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [h, s] = await Promise.all([fetchHints(), fetchSlowQueries()])
      setHints(h); setSlow(s)
    } catch (e) {
      setError(e.message || 'Không tải được dữ liệu chẩn đoán.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Hoãn 1 nhịp để không gọi setState đồng bộ ngay trong thân effect (tránh cascading render).
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])

  const onReset = async () => {
    if (!confirm('Đặt lại bộ đếm route (in-memory)? Số liệu tích lũy sẽ về 0.')) return
    try { await resetHints(); await load() } catch (e) { alert(e.message) }
  }

  const rows = hints?.rows || []
  const suggestCount = rows.filter(r => r.suggest).length

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <h2 className="section-title" style={{ margin: 0 }}>CHẨN ĐOÁN HIỆU NĂNG</h2>
        {tab !== 'system' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: hints?.cacheReady ? '#0a0' : '#c60' }}>
              {hints?.cacheReady ? '● Hệ thống cache: đang bật' : '○ Hệ thống cache: tắt (query thẳng DB)'}
            </span>
            <button className="add-btn" style={btnStyle} onClick={load} disabled={loading}>{loading ? 'Đang tải…' : '⟳ Làm mới'}</button>
            {tab === 'routes' && <button className="edit-btn" style={btnStyle} onClick={onReset} disabled={loading}>Đặt lại bộ đếm</button>}
          </div>
        )}
      </div>
      {tab === 'system' ? (
        <p style={{ color: '#666', fontSize: 13, margin: '0 0 12px' }}>
          Tổng quan sức khỏe hệ thống — phần cứng, dịch vụ (PostgreSQL, Redis) và tiến trình ứng dụng. Chỉ để <b>xem</b>.
        </p>
      ) : (
        <p style={{ color: '#666', fontSize: 13, margin: '0 0 12px' }}>
          Trang chỉ để <b>xem</b> — gợi ý chỗ đáng bọc cache, không tự cache. Bọc cache là sửa code (cần key + invalidation).
          {hints?.since && <> Đo từ <b>{fmtTime(hints.since)}</b>.</>}
        </p>
      )}

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '2px solid #e5e7eb', marginBottom: 16 }}>
        <TabButton active={tab === 'system'} onClick={() => setTab('system')}>
          ⓪ Tổng quan hệ thống
        </TabButton>
        <TabButton active={tab === 'routes'} onClick={() => setTab('routes')}>
          ① Route đọc theo tải{suggestCount ? ` (${suggestCount} 🔴)` : ''}
        </TabButton>
        <TabButton active={tab === 'queries'} onClick={() => setTab('queries')}>
          ② Câu truy vấn đắt nhất
        </TabButton>
      </div>

      {error && <div style={{ color: '#c00', marginBottom: 10 }}>{error}</div>}

      {tab === 'system' && <SystemDashboard />}
      {tab === 'routes' && <RoutesTable rows={rows} suggestCount={suggestCount} />}
      {tab === 'queries' && <SlowQueriesTable slow={slow} />}
    </>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: 'none', background: 'none', cursor: 'pointer', padding: '8px 14px',
        fontSize: 14, fontWeight: active ? 700 : 500,
        color: active ? '#1d4ed8' : '#666',
        borderBottom: active ? '2px solid #1d4ed8' : '2px solid transparent',
        marginBottom: -2,
      }}
    >
      {children}
    </button>
  )
}

// ① Route đọc theo tải
function RoutesTable({ rows, suggestCount }) {
  const [cacheFilter, setCacheFilter] = useState('all') // 'all' | 'cached' | 'uncached'
  const filtered = rows.filter(r =>
    cacheFilter === 'all' ? true : cacheFilter === 'cached' ? r.cached : !r.cached)

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '0 0 8px' }}>
        <p style={{ fontSize: 13, color: suggestCount ? '#c60' : '#888', margin: 0 }}>
          {suggestCount
            ? `${suggestCount} route 🔴 nên xem xét cache (nóng + chậm + chưa cache).`
            : 'Cột Cache: ✅ = đã bọc cacheWrap/304, — = chưa.'}
        </p>
        <label style={{ fontSize: 13, color: '#444', display: 'flex', alignItems: 'center', gap: 6 }}>
          Lọc Cache:
          <select
            value={cacheFilter}
            onChange={(e) => setCacheFilter(e.target.value)}
            style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 }}
          >
            <option value="all">Tất cả ({rows.length})</option>
            <option value="cached">✅ Đã cache ({rows.filter(r => r.cached).length})</option>
            <option value="uncached">— Chưa cache ({rows.filter(r => !r.cached).length})</option>
          </select>
        </label>
      </div>
      <div className="table-wrapper">
        <table className="user-table">
          <thead>
            <tr>
              <th></th>
              <th>Route</th>
              <th style={{ textAlign: 'right' }}>Gọi</th>
              <th style={{ textAlign: 'right' }}>rpm</th>
              <th style={{ textAlign: 'right' }}>TB</th>
              <th style={{ textAlign: 'right' }}>p95</th>
              <th style={{ textAlign: 'right' }}>Max</th>
              <th style={{ textAlign: 'center' }}>Cache</th>
              <th style={{ whiteSpace: 'nowrap' }}>Lần cuối</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 20, color: '#666' }}>
                {rows.length === 0
                  ? 'Chưa có lượt gọi nào được ghi nhận (cần traffic thật; dữ liệu mất khi restart).'
                  : 'Không có route khớp bộ lọc.'}
              </td></tr>
            ) : filtered.map(r => (
              <tr key={r.route} style={r.suggest ? { background: '#fff5e6' } : undefined}>
                <td style={{ textAlign: 'center' }} title={r.suggest ? 'Nóng + chậm + chưa cache → nên xem xét' : ''}>
                  {r.suggest ? '🔴' : ''}
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.route}</td>
                <td style={{ textAlign: 'right' }}>{r.count}</td>
                <td style={{ textAlign: 'right' }}>{r.rpm}</td>
                <td style={{ textAlign: 'right' }}>{fmtMs(r.avgMs)}</td>
                <td style={{ textAlign: 'right', fontWeight: r.suggest ? 700 : 400 }}>{fmtMs(r.p95Ms)}</td>
                <td style={{ textAlign: 'right', color: '#888' }}>{fmtMs(r.maxMs)}</td>
                <td style={{ textAlign: 'center' }}>{r.cached ? '✅' : '—'}</td>
                <td style={{ whiteSpace: 'nowrap', color: '#888', fontSize: 12 }}>{fmtTime(r.lastAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ② Câu truy vấn đắt nhất
function SlowQueriesTable({ slow }) {
  if (slow && !slow.available) {
    return (
      <div style={{ color: '#c60', fontSize: 13, background: '#fff8ef', padding: 12, borderRadius: 6 }}>
        {slow.hint || 'pg_stat_statements chưa bật.'}
      </div>
    )
  }
  return (
    <div className="table-wrapper">
      <table className="user-table">
        <thead>
          <tr>
            <th>Query</th>
            <th style={{ textAlign: 'right' }}>Tổng</th>
            <th style={{ textAlign: 'right' }}>Gọi</th>
            <th style={{ textAlign: 'right' }}>TB/lần</th>
            <th style={{ textAlign: 'right' }}>Rows</th>
          </tr>
        </thead>
        <tbody>
          {(slow?.rows || []).length === 0 ? (
            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: '#666' }}>Chưa có dữ liệu.</td></tr>
          ) : slow.rows.map((q, i) => (
            <tr key={i}>
              <td style={{ fontFamily: 'monospace', fontSize: 11, maxWidth: 640, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={q.query}>
                {q.query}
              </td>
              <td style={{ textAlign: 'right' }}>{fmtMs(Number(q.total_ms))}</td>
              <td style={{ textAlign: 'right' }}>{q.calls}</td>
              <td style={{ textAlign: 'right' }}>{fmtMs(Math.round(Number(q.mean_ms)))}</td>
              <td style={{ textAlign: 'right', color: '#888' }}>{q.rows}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
