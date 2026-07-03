// Định nghĩa cột cho bảng "Hợp đồng bán".
// Mỗi cột gồm metadata (label/sort/filter/class dính) để ContractListPage dựng
// header, và renderCell(c, ctx) để dựng ô dữ liệu — ctx cấp các hàm format/helper.
//
// - locked: cột dính trái cố định (Quản trị, Số HĐ), KHÔNG cho kéo/ẩn để giữ layout
//   sticky và luôn có 1 cột định danh.
// - gated: 'amounts' → chỉ hiện khi user có quyền module.contracts.amounts.
// - applyRowBgStyle: ô cần tô nền theo hàng (cột dính, để nền liên danh/đang chọn phủ đúng).

const GEAR_PATH_1 = 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
const GEAR_PATH_2 = 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'

const HEAD = 'text-xs font-semibold text-gray-700 uppercase tracking-wider'

export const CONTRACT_COLUMNS = [
  {
    key: 'admin',
    label: 'Quản trị',
    locked: true,
    applyRowBgStyle: true,
    thClass: `sticky-col-1 px-4 py-3 text-left ${HEAD}`,
    tdClass: 'sticky-col-1 px-4 py-3 whitespace-nowrap',
    renderCell: (c, ctx) => (
      <button className="btn-manage" onClick={(e) => { e.stopPropagation(); if (ctx.onManage) ctx.onManage(c) }} title="Quản trị">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={GEAR_PATH_1} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={GEAR_PATH_2} />
        </svg>
      </button>
    ),
  },
  {
    key: 'contract_no',
    label: 'Số HĐ',
    locked: true,
    applyRowBgStyle: true,
    sortable: true,
    filter: { type: 'text', placeholder: 'Tìm số HĐ' },
    thClass: `sticky-col-2 px-4 py-3 text-left ${HEAD} cursor-pointer hover:bg-gray-100 col-contract-no`,
    tdClass: 'sticky-col-2 px-4 py-3 whitespace-nowrap text-sm text-gray-900',
    renderCell: (c) => (
      <>
        {c.contract_no || '-'}
        {c.is_joint_venture && (
          <span style={{
            display: 'inline-block', marginLeft: 6, padding: '1px 7px',
            fontSize: 10, fontWeight: 700, lineHeight: 1.6, borderRadius: 999,
            color: '#c2410c', background: '#ffedd5', border: '1px solid #fed7aa',
            whiteSpace: 'nowrap',
          }}>Liên danh</span>
        )}
      </>
    ),
  },
  {
    key: 'customer_name',
    label: 'Chủ đầu tư',
    sortable: true,
    filter: { type: 'text', placeholder: 'Tìm CĐT' },
    thClass: `px-4 py-3 text-left ${HEAD} sticky-col cursor-pointer hover:bg-gray-100 col-customer-name`,
    tdClass: 'px-4 py-3 whitespace-nowrap text-sm text-gray-700',
    renderCell: (c) => c.customer_name || '-',
  },
  {
    key: 'contract_date',
    label: 'Ngày ký',
    sortable: true,
    thClass: `px-4 py-3 text-left ${HEAD} sticky-col cursor-pointer hover:bg-gray-100`,
    tdClass: 'px-4 py-3 whitespace-nowrap text-sm text-gray-700',
    renderCell: (c, ctx) => ctx.formatDate(c.contract_date),
  },
  {
    key: 'tender_name',
    label: 'Gói thầu',
    thClass: `px-4 py-3 text-left ${HEAD} sticky-col col-tender-name`,
    tdClass: 'px-4 py-3 whitespace-nowrap text-sm text-gray-700',
    renderCell: (c) => c.tender_name || '-',
  },
  {
    key: 'amount_before_vat',
    label: 'Trước VAT',
    gated: 'amounts',
    sortable: true,
    thClass: `px-4 py-3 text-right ${HEAD} sticky-col cursor-pointer hover:bg-gray-100`,
    tdClass: 'px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right font-medium col-money',
    renderCell: (c, ctx) => ctx.formatCurrency(ctx.toVnd(c.amount_before_vat, c)),
  },
  {
    key: 'amount_after_vat',
    label: 'Sau VAT',
    gated: 'amounts',
    sortable: true,
    thClass: `px-4 py-3 text-right ${HEAD} sticky-col cursor-pointer hover:bg-gray-100`,
    tdClass: 'px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right font-medium col-money',
    renderCell: (c, ctx) => ctx.formatCurrency(ctx.toVnd(c.amount_after_vat, c)),
  },
  {
    key: 'amount_usd',
    label: 'USD',
    gated: 'amounts',
    thClass: `px-4 py-3 text-right ${HEAD} sticky-col`,
    tdClass: 'px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right col-money',
    renderCell: (c, ctx) => (c.currency_code === 'USD' ? ctx.formatCurrency(c.amount_after_vat) : '-'),
  },
  {
    key: 'pm_name',
    label: 'PM chính',
    sortable: true,
    filter: { type: 'select', optionsKey: 'pm_name' },
    thClass: `px-6 py-3 text-left ${HEAD} sticky-col cursor-pointer hover:bg-gray-100 col-pm-name`,
    tdClass: 'px-6 py-3 whitespace-nowrap',
    renderCell: (c, ctx) => ctx.getAvatarBadge(c.pm_name),
  },
  {
    key: 'status',
    label: 'Trạng thái',
    sortable: true,
    filter: { type: 'select', optionsKey: 'status' },
    thClass: `px-6 py-3 text-left ${HEAD} sticky-col cursor-pointer hover:bg-gray-100 col-status`,
    tdClass: 'px-6 py-3 whitespace-nowrap',
    renderCell: (c, ctx) => ctx.getStatusBadge(c.status),
  },
  {
    key: 'project_name',
    label: 'Tên dự án',
    sortable: true,
    filter: { type: 'text', placeholder: 'Tìm dự án' },
    thClass: `px-4 py-3 text-left ${HEAD} sticky-col cursor-pointer hover:bg-gray-100 col-project-name`,
    tdClass: 'px-4 py-3 whitespace-nowrap text-sm text-gray-900',
    renderCell: (c) => c.project_name || '-',
  },
]

// Các cột dính trái cố định (luôn hiện, không kéo/ẩn) và các cột có thể sắp xếp/ẩn.
export const LOCKED_COLUMNS = CONTRACT_COLUMNS.filter(c => c.locked)
export const MOVABLE_COLUMN_KEYS = CONTRACT_COLUMNS.filter(c => !c.locked).map(c => c.key)
export const COLUMNS_BY_KEY = Object.fromEntries(CONTRACT_COLUMNS.map(c => [c.key, c]))
