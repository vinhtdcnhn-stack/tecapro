import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchSystemHealth } from './cacheHintApi'

// ⓪ Tổng quan sức khỏe hệ thống — chỉ xem. Phần cứng/OS + PostgreSQL + Redis + tiến trình
// Node + vài số liệu ứng dụng. Tự làm mới mỗi 6s khi tab đang mở (dừng khi rời tab).

const REFRESH_MS = 6000

const fmtBytes = (n) => {
  if (n == null) return '—'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0, v = n
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${u[i]}`
}
const fmtDur = (sec) => {
  if (sec == null) return '—'
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60)
  if (d) return `${d}n ${h}g`
  if (h) return `${h}g ${m}p`
  return `${m}p`
}
const pct = (used, total) => (total ? Math.round((used / total) * 1000) / 10 : null)
// Màu theo mức dùng: <70% xanh, <90% hổ phách, ≥90% đỏ.
const barColor = (p) => (p == null ? '#9ca3af' : p >= 90 ? '#dc2626' : p >= 70 ? '#d97706' : '#16a34a')

export default function SystemDashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const timer = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await fetchSystemHealth()); setError('') }
    catch (e) { setError(e.message || 'Không tải được thông tin hệ thống.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    // Hoãn 1 nhịp để không gọi setState đồng bộ ngay trong thân effect (tránh cascading render).
    const t = setTimeout(load, 0)
    timer.current = setInterval(load, REFRESH_MS)
    return () => { clearTimeout(t); clearInterval(timer.current) }
  }, [load])

  if (error) return <div style={{ color: '#c00', marginBottom: 10 }}>{error}</div>
  if (!data) return <div style={{ color: '#666', padding: 20 }}>Đang tải…</div>

  const { os, disk, process: proc, db, redis, app } = data
  const memPct = pct(os.mem.usedBytes, os.mem.totalBytes)
  const diskPct = disk ? pct(disk.usedBytes, disk.totalBytes) : null
  const redisPct = redis?.ready && redis.maxBytes ? pct(redis.usedBytes, redis.maxBytes) : null

  return (
    <>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>Tự làm mới mỗi {REFRESH_MS / 1000}s.</span>
        {loading && <span style={{ color: '#1d4ed8' }}>● đang cập nhật</span>}
        <span>Cập nhật: {new Date(data.now).toLocaleTimeString('vi-VN')}</span>
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {/* Phần cứng / OS */}
        <Card title="🖥️ Phần cứng / Hệ điều hành">
          <Row k="Máy chủ" v={os.hostname} />
          <Row k="Nền tảng" v={`${os.platform} ${os.release} (${os.arch})`} />
          <Row k="Uptime máy" v={fmtDur(os.uptimeSec)} />
          <Gauge label={`CPU (${os.cpu.cores} nhân)`} pctVal={os.cpu.usagePct}
                 text={os.cpu.usagePct == null ? 'không đo được' : `${os.cpu.usagePct}%`} />
          <Row k="CPU model" v={os.cpu.model} small />
          <Row k="Load avg" v={os.cpu.loadavg.some(x => x > 0)
            ? os.cpu.loadavg.map(x => x.toFixed(2)).join(' / ')
            : '— (chỉ có trên Linux)'} small />
          <Gauge label="RAM" pctVal={memPct}
                 text={`${fmtBytes(os.mem.usedBytes)} / ${fmtBytes(os.mem.totalBytes)}`} />
        </Card>

        {/* Đĩa */}
        <Card title="💾 Đĩa">
          {disk ? (
            <Gauge label="Dung lượng" pctVal={diskPct}
                   text={`Đã dùng ${fmtBytes(disk.usedBytes)} / ${fmtBytes(disk.totalBytes)} — trống ${fmtBytes(disk.freeBytes)}`} />
          ) : <Row k="Trạng thái" v="Không đọc được" />}
        </Card>

        {/* PostgreSQL */}
        <Card title="🐘 PostgreSQL">
          {db?.ok ? (
            <>
              <Row k="Phiên bản" v={db.version} />
              <Row k="Kích thước DB" v={fmtBytes(db.sizeBytes)} />
              <Row k="Kết nối" v={`${db.connections.active} đang chạy / ${db.connections.total} tổng`} />
              <Row k="Pool ứng dụng" v={`${db.pool.total} mở · ${db.pool.idle} rảnh · ${db.pool.waiting} chờ`} small />
            </>
          ) : <Row k="Trạng thái" v={<span style={{ color: '#c00' }}>Lỗi: {db?.error || 'không kết nối'}</span>} />}
        </Card>

        {/* Redis */}
        <Card title="🧠 Hệ thống Cache">
          {redis?.ready ? (
            <>
              <Row k="Trạng thái" v={<span style={{ color: '#0a0' }}>● đang bật</span>} />
              <Row k="Số key" v={redis.keys?.toLocaleString('vi-VN')} />
              {redisPct != null
                ? <Gauge label="Bộ nhớ" pctVal={redisPct} text={`${redis.usedHuman} / ${redis.maxHuman}`} />
                : <Row k="Bộ nhớ dùng" v={`${redis.usedHuman || fmtBytes(redis.usedBytes)} (không giới hạn)`} />}
            </>
          ) : <Row k="Trạng thái" v={<span style={{ color: '#c60' }}>○ tắt (query thẳng DB)</span>} />}
        </Card>

        {/* Tiến trình Node */}
        <Card title="⚙️ Tiến trình ứng dụng">
          <Row k="Node" v={os.nodeVersion} />
          <Row k="Môi trường" v={proc.env} />
          <Row k="Uptime tiến trình" v={fmtDur(proc.uptimeSec)} />
          <Row k="RSS" v={fmtBytes(proc.rssBytes)} />
          <Row k="Heap" v={`${fmtBytes(proc.heapUsedBytes)} / ${fmtBytes(proc.heapTotalBytes)}`} />
        </Card>

        {/* Số liệu ứng dụng */}
        {app && (
          <Card title="📊 Dữ liệu">
            <Row k="Người dùng" v={app.users?.toLocaleString('vi-VN')} />
            <Row k="Khách hàng" v={app.customers?.toLocaleString('vi-VN')} />
            <Row k="Hợp đồng bán" v={app.contracts?.toLocaleString('vi-VN')} />
          </Card>
        )}
      </div>
    </>
  )
}

function Card({ title, children }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, background: '#fff' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#111' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  )
}

function Row({ k, v, small }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: small ? 12 : 13 }}>
      <span style={{ color: '#666', flexShrink: 0 }}>{k}</span>
      <span style={{ color: small ? '#888' : '#111', textAlign: 'right', fontWeight: small ? 400 : 500, wordBreak: 'break-word' }}>{v ?? '—'}</span>
    </div>
  )
}

// Thanh đo có nhãn + % màu theo mức dùng.
function Gauge({ label, pctVal, text }) {
  const width = pctVal == null ? 0 : Math.min(100, pctVal)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span style={{ color: '#666' }}>{label}</span>
        <span style={{ color: '#111', fontWeight: 600 }}>{text}</span>
      </div>
      <div style={{ height: 8, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${width}%`, height: '100%', background: barColor(pctVal), transition: 'width .4s, background .4s' }} />
      </div>
    </div>
  )
}
