import { useState, useEffect, useMemo, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { usePermission } from '../../hooks/usePermission'
import { fetchCatalog, fetchForPage, fetchGlobalMatrix, fetchContractMatrix } from './permissionApi'
import GlobalPermissionMatrix from './GlobalPermissionMatrix'
import ContractRolePermissionMatrix from './ContractRolePermissionMatrix'
import { subscribeContractInSubTab, getContractInSubTab } from './activeSubTab'
import { SUB_TABS } from '../contracts/contractInUtils'
import './permissions.css'

// Tab sidebar chi tiết HĐ (id) → tiền tố key quyền của tab đó. Panel chỉ hiện đúng quyền
// của tab đang mở cho đỡ rối. Khớp khi key === `${prefix}.x` (view/manage/section con).
const MENU_PERM_PREFIX = {
  'contract-info':         ['co.info'],
  'contract-documents':    ['co.documents'],
  'contract-pricing':      ['co.boq'],
  'contract-progress':     ['co.progress'],
  'contract-debt':         ['co.receivable'],
  'contract-invoice':      ['co.invoice'],
  'contract-warranty':     ['co.warranty'],
  'contract-guarantee':    ['co.guarantee'],
  'contract-tasks':        ['co.tasks'],
  'purchase-contract-info': ['co.contractin', 'ci'], // mục HĐ nhập + mọi sub-tab ci.*
}

const MENU_LABEL = {
  'contract-info': 'Thông tin hợp đồng',
  'contract-documents': 'Tài liệu hợp đồng',
  'contract-pricing': 'Bảng giá',
  'contract-progress': 'Tiến độ theo biên bản',
  'contract-debt': 'Công nợ',
  'contract-invoice': 'Quản lý hóa đơn',
  'contract-warranty': 'Bảo hành',
  'contract-guarantee': 'Bảo lãnh',
  'contract-tasks': 'Công việc triển khai',
  'purchase-contract-info': 'Hợp đồng nhập',
}

// Nhãn sub-tab HĐ nhập (info/pricing/…) để hiện ở chân panel.
const CI_SUBTAB_LABEL = Object.fromEntries(SUB_TABS.map(t => [t.key, t.label]))

function permsForMenu(perms, menuId, ciSubTab) {
  const prefixes = MENU_PERM_PREFIX[menuId]
  if (!prefixes) return perms // không nhận diện được tab → hiện đủ (an toàn)
  let filtered = perms.filter(p => prefixes.some(pre => p.key.startsWith(`${pre}.`)))
  // HĐ nhập gom mọi sub-tab (ci.*) vào 1 bảng → rối. Thu hẹp theo ngữ cảnh:
  //   • Đang ở DANH SÁCH HĐ nhập (chưa mở sub-tab nào) → chỉ hiện quyền của chính bảng
  //     "Hợp đồng nhập" (co.contractin.*) + section số tiền của danh sách (ci.info.amounts).
  //   • Đã vào 1 sub-tab cụ thể trong chi tiết HĐ nhập → thu hẹp về đúng sub-tab đó,
  //     vẫn giữ mục cổng vào module (co.contractin.*).
  if (menuId === 'purchase-contract-info') {
    const narrowed = filtered.filter(p =>
      p.key.startsWith('co.contractin.') ||
      (ciSubTab ? p.key.startsWith(`ci.${ciSubTab}.`) : p.key === 'ci.info.amounts')
    )
    if (narrowed.length) filtered = narrowed
  }
  return filtered.length ? filtered : perms
}

// Overlay bật bằng Ctrl+Shift+Q: hiện ma trận phân quyền CHỈ các quyền của trang đang mở.
// Với chi tiết HĐ, lọc tiếp theo TAB đang mở (?tab=) và hiện thêm ma trận theo VỊ TRÍ
// (Lớp A liên quan trang). Chỉ người có system.permissions.manage (mặc định admin) mới mở.
export default function PermissionPanel() {
  const { has } = usePermission()
  const canConfig = has('system.permissions.manage')
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  // Tab đang mở (chi tiết HĐ ghi vào ?tab=). Đọc lúc render để đổi tab là panel đổi theo.
  const activeTab = new URLSearchParams(location.search).get('tab')
  // Sub-tab HĐ nhập đang mở (ContractInDetail publish qua store ngoài, không lên URL).
  const ciSubTab = useSyncExternalStore(subscribeContractInSubTab, getContractInSubTab, () => null)

  useEffect(() => {
    function onKey(e) {
      if (e.ctrlKey && e.shiftKey && (e.key === 'Q' || e.key === 'q')) {
        if (!canConfig) return
        e.preventDefault()
        setOpen(o => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canConfig])

  useEffect(() => {
    if (!open) return
    let alive = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- bật cờ tải rồi nạp dữ liệu async
    setLoading(true); setErr('')
    ;(async () => {
      try {
        const [cat, fp] = await Promise.all([fetchCatalog(), fetchForPage(location.pathname)])
        if (!fp.page) { if (alive) setData({ page: null }); return }
        let extra = {}
        if (fp.page.scope === 'global') {
          const gm = await fetchGlobalMatrix()
          extra = { positions: gm.positions, posGrants: gm.grants }
        } else {
          // Lớp B (vai trò HĐ) + nếu trang có quyền Lớp A liên quan → tải thêm ma trận vị trí.
          const needGlobal = (fp.globalPerms || []).length > 0
          const [cm, gm] = await Promise.all([
            fetchContractMatrix(),
            needGlobal ? fetchGlobalMatrix() : Promise.resolve(null),
          ])
          extra = {
            roles: cm.memberRoles, roleGrants: cm.grants,
            globalPerms: fp.globalPerms || [],
            positions: gm?.positions || [], posGrants: gm?.grants || {},
          }
        }
        if (alive) setData({ page: fp.page, perms: fp.perms, allPerms: cat.permissions, ...extra })
      } catch (e) {
        if (alive) setErr(e.message)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [open, location.pathname])

  // Hàng quyền HĐ hiện trên panel: lọc theo tab đang mở (chỉ trang chi tiết HĐ).
  const contractRows = useMemo(() => {
    if (data?.page?.scope !== 'contract') return data?.perms || []
    return permsForMenu(data.perms, activeTab, ciSubTab)
  }, [data, activeTab, ciSubTab])

  if (!canConfig || !open) return null

  // Nhãn tab đang lọc (chỉ khi đúng là trang chi tiết HĐ và nhận diện được tab).
  let tabLabel = data?.page?.scope === 'contract' ? MENU_LABEL[activeTab] : null
  if (tabLabel && activeTab === 'purchase-contract-info' && ciSubTab && CI_SUBTAB_LABEL[ciSubTab]) {
    tabLabel = `${tabLabel} › ${CI_SUBTAB_LABEL[ciSubTab]}`
  }

  return (
    <div className="perm-panel-backdrop" onClick={() => setOpen(false)}>
      <div className="perm-panel" onClick={e => e.stopPropagation()}>
        <div className="perm-panel-head">
          <div>
            <strong>Phân quyền — {data?.page?.label || 'trang hiện tại'}</strong>
            <span className="perm-panel-path">{location.pathname}</span>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Đóng">✕</button>
        </div>
        <div className="perm-panel-body">
          {loading && <p>Đang tải…</p>}
          {err && <p className="perm-err">{err}</p>}
          {!loading && data && !data.page && (
            <p>Trang này chưa khai báo quyền trong danh mục. Quản lý đầy đủ ở mục <b>Hệ thống → Phân quyền</b>.</p>
          )}
          {!loading && data?.page?.scope === 'global' && (
            <GlobalPermissionMatrix
              rowPerms={data.perms} allPerms={data.allPerms} positions={data.positions} grants={data.posGrants}
              onGrantsChange={(posId, keys) => setData(d => ({ ...d, posGrants: { ...d.posGrants, [posId]: keys } }))}
            />
          )}
          {!loading && data?.page?.scope === 'contract' && (
            <>
              <ContractRolePermissionMatrix
                rowPerms={contractRows} allPerms={data.allPerms} roles={data.roles} grants={data.roleGrants}
                onGrantsChange={(role, keys) => setData(d => ({ ...d, roleGrants: { ...d.roleGrants, [role]: keys } }))}
              />
              <div className="perm-panel-section">
                <div className="perm-panel-subhead">Theo vị trí (toàn cục)</div>
                {/* Cùng các dòng quyền chi tiết HĐ như ma trận vai trò (lọc theo tab) + dòng
                    "Vào module". Tick = cấp quyền HĐ đó cho vị trí trên MỌI hợp đồng. */}
                <GlobalPermissionMatrix
                  rowPerms={[...(data.globalPerms || []), ...contractRows]}
                  allPerms={data.allPerms} positions={data.positions} grants={data.posGrants}
                  onGrantsChange={(posId, keys) => setData(d => ({ ...d, posGrants: { ...d.posGrants, [posId]: keys } }))}
                />
              </div>
            </>
          )}
        </div>
        <div className="perm-panel-foot">
          {tabLabel ? <>Đang hiện quyền của tab <b>{tabLabel}</b>. </> : null}
          {activeTab === 'purchase-contract-info' && (
            <><b>Người tạo HĐ nhập</b> luôn có toàn quyền xem/sửa mọi tab của HĐ nhập do họ tạo —
            ma trận dưới chỉ áp cho người KHÁC (không phải người tạo). </>
          )}
          Tick là lưu ngay. Quyền gán theo vị trí / vai trò HĐ nên áp cho mọi người liên quan.
          Ghi đè theo từng người ở <b>Hệ thống → Phân quyền</b>. Đóng: Esc.
        </div>
      </div>
    </div>
  )
}
