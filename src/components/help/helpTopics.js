// Tổng hợp nội dung hệ thống hướng dẫn sử dụng (mở từ icon ❓ trên Header).
// Cấu trúc 2 cấp: NHÓM (một phân hệ/khu vực) → TRANG (một trang màn hình hoặc một
// tab con) → các mục {heading, items}. Nhóm/trang có thể gắn `perm` (quyền lớp A) —
// người không có quyền sẽ không thấy, khớp với việc họ không thấy menu tương ứng.
// Nội dung từng nhóm nằm trong ./topics/* (giữ mỗi file < 500 dòng).

import { GENERAL_GROUP } from './topics/general'
import { HOME_GROUP } from './topics/home'
import { CONTRACTS_CORE_PAGES } from './topics/contractsCore'
import { CONTRACTS_FINANCE_PAGES } from './topics/contractsFinance'
import { CONTRACT_IN_GROUP } from './topics/contractIn'
import { DEPTWORK_GROUP, TENDER_GROUP, APPROVALS_GROUP } from './topics/deptTenderApproval'
import { ACCOUNTING_GROUP, WARRANTY_GROUP } from './topics/accountingWarranty'
import { ADMIN_GROUP } from './topics/admin'

const CONTRACTS_GROUP = {
  id: 'contracts',
  icon: '📄',
  title: 'Hợp đồng bán',
  perm: 'module.contracts.view',
  pages: [...CONTRACTS_CORE_PAGES, ...CONTRACTS_FINANCE_PAGES],
}

export const HELP_GROUPS = [
  GENERAL_GROUP,
  HOME_GROUP,
  CONTRACTS_GROUP,
  CONTRACT_IN_GROUP,
  DEPTWORK_GROUP,
  TENDER_GROUP,
  APPROVALS_GROUP,
  ACCOUNTING_GROUP,
  WARRANTY_GROUP,
  ADMIN_GROUP,
]
