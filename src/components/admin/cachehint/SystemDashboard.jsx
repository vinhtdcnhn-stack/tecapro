import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchSystemHealth, flushCache } from './cacheHintApi'
import usePasswordPrompt from '../../contracts/usePasswordPrompt'

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
// Đảo ngược cho chỉ số "cao là tốt" (vd tỷ lệ hit): ≥90% xanh, ≥70% hổ phách, còn lại đỏ.
const barColorInverse = (p) => (p == null ? '#9ca3af' : p >= 90 ? '#16a34a' : p >= 70 ? '#d97706' : '#dc2626')

export default function SystemDashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [flushMsg, setFlushMsg] = useState(null) // { ok, text } | null
  const [flushing, setFlushing] = useState(false)
  const timer = useRef(null)
  const { promptPassword, passwordModal } = usePasswordPrompt()

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await fetchSystemHealth()); setError('') }
    catch (e) { setError(e.message || 'Không tải được thông tin hệ thống.') }
    finally { setLoading(false) }
  }, [])

  // Nút "Xóa cache": buộc nhập lại mật khẩu rồi FLUSH toàn bộ Redis. Sau khi xóa, làm mới
  // ngay số liệu để thấy Số key về 0.
  const handleFlush = useCallback(async () => {
    const pw = await promptPassword({
      title: 'Xóa toàn bộ cache',
      message: 'Thao tác này xóa sạch cache Redis, mọi API sẽ nạp lại từ DB. Nhập mật khẩu của bạn để xác nhận.',
    })
    if (pw == null) return
    setFlushing(true)
    setFlushMsg(null)
    try {
      const r = await flushCache(pw)
      setFlushMsg({ ok: true, text: `Đã xóa ${Number(r.cleared || 0).toLocaleString('vi-VN')} key.` })
      load()
    } catch (e) {
      setFlushMsg({ ok: false, text: e.message || 'Không xóa được cache.' })
    } finally {
      setFlushing(false)
    }
  }, [promptPassword, load])

  useEffect(() => {
    // Hoãn 1 nhịp để không gọi setState đồng bộ ngay trong thân effect (tránh cascading render).
    const t = setTimeout(load, 0)
    timer.current = setInterval(load, REFRESH_MS)
    return () => { clearTimeout(t); clearInterval(timer.current) }
  }, [load])

  if (error) return <div style={{ color: '#c00', marginBottom: 10 }}>{error}</div>
  if (!data) return <div style={{ color: '#666', padding: 20 }}>Đang tải…</div>

  const { os, disk, process: proc, db, redis, app, security } = data
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
            <>
              <Gauge label="Dung lượng" pctVal={diskPct}
                     text={`Đã dùng ${fmtBytes(disk.usedBytes)} / ${fmtBytes(disk.totalBytes)} — trống ${fmtBytes(disk.freeBytes)}`} />
              <DiskBreakdown disk={disk} />
            </>
          ) : <Row k="Trạng thái" v="Không đọc được" />}
        </Card>

        {/* PostgreSQL */}
        <Card title="🐘 Hệ thống CSDL PostgreSQL">
          {db?.ok ? (
            <>
              <Row k="Phiên bản" v={db.version} />
              <Row k="Kích thước DB" v={fmtBytes(db.sizeBytes)} />
              {(() => {
                // Kết nối tới DB: đang chạy · tổng / trần max_connections. Màu theo tổng so với
                // trần — đỏ khi ≥90%, hổ phách ≥80% (gần hết slot = app không vào được DB).
                const max = db.connections.max
                const cp = max ? pct(db.connections.total, max) : null
                return (
                  <Row k="Kết nối" v={
                    <span style={{ color: cp == null ? '#111' : cp >= 90 ? '#dc2626' : cp >= 80 ? '#d97706' : '#111', fontWeight: cp != null && cp >= 80 ? 700 : 500 }}>
                      {db.connections.active} chạy · {db.connections.total} tổng / {max ?? '—'}{cp != null && ` (${cp}%)`}
                    </span>
                  } />
                )
              })()}
              {(() => {
                // Đỉnh kết nối trong tuần (bộ lấy mẫu nền, rolling 7 ngày). Cùng ngưỡng màu.
                const pk = db.connPeakWeek
                if (!pk) return <Row k="Đỉnh kết nối (7 ngày)" v="— (đang thu thập)" small />
                const p = pk.pct
                const when = new Date(pk.peakAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                return (
                  <Row k="Đỉnh kết nối (7 ngày)" small v={
                    <span style={{ color: p == null ? '#888' : p >= 90 ? '#dc2626' : p >= 80 ? '#d97706' : '#888' }}>
                      {pk.peak} / {pk.max}{p != null && ` (${p}%)`} · lúc {when}
                    </span>
                  } />
                )
              })()}
              {(() => {
                // Idle in transaction — bất kỳ phiên nào >0 đều đáng chú ý (transaction rò rỉ).
                const n = db.connections.idleInTx ?? 0
                return (
                  <Row k="Idle in transaction" v={
                    <span style={{ color: n > 0 ? '#d97706' : '#16a34a', fontWeight: n > 0 ? 700 : 500 }}>{n}</span>
                  } />
                )
              })()}
              {(() => {
                // Cache hit ratio — cao là tốt: xanh ≥99%, hổ phách ≥95%, đỏ dưới đó.
                const h = db.cacheHitPct
                return (
                  <Row k="Tỷ lệ hit cache" v={
                    h == null
                      ? '— (chưa có truy vấn)'
                      : <span style={{ color: h >= 99 ? '#16a34a' : h >= 95 ? '#d97706' : '#dc2626', fontWeight: 600 }}>{h}%</span>
                  } />
                )
              })()}
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
              {redis.hitRatePct != null ? (
                <Gauge label="Tỷ lệ hit" pctVal={redis.hitRatePct} inverse
                       text={`${redis.hitRatePct}% (${redis.hits?.toLocaleString('vi-VN')} hit / ${redis.misses?.toLocaleString('vi-VN')} miss)`} />
              ) : (
                <Row k="Tỷ lệ hit" v="— (chưa có lượt truy vấn)" />
              )}
              {redisPct != null
                ? <Gauge label="Bộ nhớ" pctVal={redisPct} text={`${redis.usedHuman} / ${redis.maxHuman}`} />
                : <Row k="Bộ nhớ dùng" v={`${redis.usedHuman || fmtBytes(redis.usedBytes)} (không giới hạn)`} />}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, marginTop: 2 }}>
                <button
                  onClick={handleFlush}
                  disabled={flushing}
                  style={{
                    width: '100%', padding: '8px 12px', fontSize: 13, fontWeight: 600,
                    color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca',
                    borderRadius: 8, cursor: flushing ? 'default' : 'pointer', opacity: flushing ? 0.6 : 1,
                  }}
                >
                  {flushing ? 'Đang xóa…' : '🗑️ Xóa cache'}
                </button>
                {flushMsg && (
                  <div style={{ fontSize: 12, marginTop: 6, color: flushMsg.ok ? '#16a34a' : '#dc2626' }}>
                    {flushMsg.ok ? '✓ ' : '✕ '}{flushMsg.text}
                  </div>
                )}
              </div>
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
          {(() => {
            // Độ trễ vòng lặp sự kiện — thấp là tốt: <50ms xanh, <200ms hổ phách, ≥200ms đỏ.
            const el = proc.eventLoopDelay
            if (!el) return null
            const v = el.p99 ?? 0
            const c = v >= 200 ? '#dc2626' : v >= 50 ? '#d97706' : '#16a34a'
            return (
              <Row k="Trễ vòng lặp" v={
                <span style={{ color: c, fontWeight: v >= 50 ? 700 : 500 }}>
                  p99 {el.p99}ms · đỉnh {el.max}ms
                </span>
              } />
            )
          })()}
          {(() => {
            // CPU của riêng tiến trình (theo 1 nhân) — <70% xanh, <90% hổ phách, ≥90% đỏ.
            const p = proc.cpuPct
            if (p == null) return <Row k="CPU tiến trình" v="— không đo được" />
            const c = p >= 90 ? '#dc2626' : p >= 70 ? '#d97706' : '#16a34a'
            return <Row k="CPU tiến trình" v={<span style={{ color: c, fontWeight: p >= 70 ? 700 : 500 }}>{p}%</span>} />
          })()}
        </Card>

        {/* Người dùng đang online (dựa trên long-poll đang giữ) */}
        {app?.online && (
          <Card title="🟢 Đang online">
            <Row k="Số người" v={<span style={{ color: app.online.count ? '#16a34a' : '#666', fontWeight: 700 }}>
              {app.online.count?.toLocaleString('vi-VN') ?? 0}
            </span>} />
            {app.online.users?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                {app.online.users.map((name, i) => (
                  <span key={i} style={{
                    fontSize: 12, background: '#ecfdf5', color: '#065f46',
                    border: '1px solid #a7f3d0', borderRadius: 999, padding: '2px 10px',
                  }}>{name}</span>
                ))}
              </div>
            )}
            {app.online.count > 0 && !app.online.users?.length && (
              <Row k="Danh sách" v="(không tra được tên)" small />
            )}
          </Card>
        )}

        {/* Bảo mật — dò quét/tấn công bị fail2ban chặn (chỉ có trên VPS) */}
        <Card title="🛡️ Chống dò quét (fail2ban)">
          {security?.available ? (
            <>
              <Row k="IP đang bị chặn" v={
                <span style={{ color: security.currentlyBanned ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                  {security.currentlyBanned?.toLocaleString('vi-VN') ?? 0}
                </span>
              } />
              <Row k="Tổng lượt chặn" v={security.totalBanned?.toLocaleString('vi-VN') ?? 0} />
              <Row k="Tổng lượt dò/thất bại" v={security.totalFailed?.toLocaleString('vi-VN') ?? 0} small />
              {security.jails?.length > 0 && (
                <div style={{ marginTop: 4, borderTop: '1px solid #f1f5f9', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {security.jails.map((j) => (
                    <div key={j.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: '#666', wordBreak: 'break-word' }}>{j.name}</span>
                      <span style={{ color: '#111', flexShrink: 0, marginLeft: 8 }}>
                        {j.currentlyBanned == null
                          ? '—'
                          : <>🔒 {j.currentlyBanned?.toLocaleString('vi-VN')} · Σ {j.totalBanned?.toLocaleString('vi-VN')}</>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <Row k="Trạng thái" v={<span style={{ color: '#c60' }}>○ {security?.hint || 'Không có dữ liệu'}</span>} />
          )}
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
      {passwordModal}
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

// Màu từng phần trong thanh phân rã dung lượng đĩa.
const DISK_SEG_COLORS = { uploads: '#2563eb', backup: '#d97706', db: '#7c3aed', other: '#cbd5e1', free: '#f1f5f9' }

// Phân rã dung lượng đĩa: uploads (tệp đính kèm) + backup (.tar) đo nền 10'; DB lấy từ
// kích thước PostgreSQL; "khác" = phần đã dùng còn lại; "trống" lấp phần còn lại tới tổng.
// db được kẹp ≤ (đã dùng − uploads − backup) để các phần cộng lại luôn khớp mức đã dùng.
function DiskBreakdown({ disk }) {
  const b = disk.breakdown
  if (!b) return null
  if (b.uploadsBytes == null) {
    return <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>Đang đo phân rã dung lượng…</div>
  }
  const uploads = b.uploadsBytes || 0
  const backup = b.backupBytes || 0
  const db = Math.min(disk.dbSizeBytes || 0, Math.max(0, disk.usedBytes - uploads - backup))
  const other = Math.max(0, disk.usedBytes - uploads - backup - db)
  const free = disk.freeBytes || 0
  const segs = [
    { key: 'uploads', label: 'Tệp đính kèm (uploads)', bytes: uploads },
    { key: 'backup', label: 'Bản sao lưu (.tar)', bytes: backup },
    { key: 'db', label: 'Cơ sở dữ liệu', bytes: db },
    { key: 'other', label: 'Khác / hệ thống', bytes: other },
    { key: 'free', label: 'Trống', bytes: free },
  ]
  return (
    <div style={{ marginTop: 8, borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 5 }}>Phân rã dung lượng</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {segs.map((s) => (
          <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: '#666', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, flexShrink: 0, background: DISK_SEG_COLORS[s.key], border: s.key === 'free' ? '1px solid #e2e8f0' : 'none' }} />
              {s.label}
            </span>
            <span style={{ color: '#111', fontWeight: 500 }}>{fmtBytes(s.bytes)}</span>
          </div>
        ))}
      </div>
      {b.measuredAt && (
        <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>
          Đo lúc {new Date(b.measuredAt).toLocaleTimeString('vi-VN')} · làm mới ~10 phút/lần{b.computing && ' · đang đo lại…'}
        </div>
      )}
    </div>
  )
}

// Thanh đo có nhãn + % màu theo mức dùng.
function Gauge({ label, pctVal, text, inverse }) {
  const width = pctVal == null ? 0 : Math.min(100, pctVal)
  const color = (inverse ? barColorInverse : barColor)(pctVal)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span style={{ color: '#666' }}>{label}</span>
        <span style={{ color: '#111', fontWeight: 600 }}>{text}</span>
      </div>
      <div style={{ height: 8, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${width}%`, height: '100%', background: color, transition: 'width .4s, background .4s' }} />
      </div>
    </div>
  )
}
