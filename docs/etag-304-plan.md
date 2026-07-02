# ETag / 304 (Lightweight Validation) — Log triển khai theo giai đoạn

Tài liệu sống theo dõi việc thêm lớp **xác thực nhẹ** (conditional GET → `304 Not Modified`)
chồng lên lớp cache Redis sẵn có (xem `docs/redis-cache-plan.md`). Cập nhật trạng thái sau
mỗi giai đoạn và commit kèm code của giai đoạn đó.

Trạng thái: ⬜ chưa làm · 🔄 đang làm · ✅ xong

## Vì sao

Lớp cache Redis hiện tại (`cacheWrap`) khi HIT vẫn **trả nguyên cục JSON** → tiết kiệm
DB+CPU nhưng vẫn **tốn băng thông + parse phía client** mỗi lần. Lớp ETag/304 bổ sung:
khi dữ liệu chưa đổi, server chỉ đọc **1 số version trong Redis (~sub-ms)** rồi trả `304`
RỖNG — không chạm DB, không tính toán, không truyền payload; trình duyệt/client tự dùng
bản đã cache.

## Nguyên tắc cốt lõi

1. **Tái dùng `cacheVersion`/`bumpVersion` đã có.** ETag của một nhóm version-namespace =
   `W/"r-<group>-<v>"`. Mỗi URL có params cố định nên chỉ biến thiên theo version nhóm →
   version đổi (do bất kỳ ghi nào trong nhóm) là đủ để phát hiện "có thể đã đổi".
2. **Redis TẮT → KHÔNG bao giờ trả 304.** Khi cache off, `cacheVersion` trả 0 cố định →
   ETag sẽ "đứng yên" và 304 sẽ phục vụ dữ liệu CŨ. Vì vậy helper kiểm tra `isCacheReady()`
   trước; cache off → bỏ qua hoàn toàn, hành xử y như hôm nay.
3. **Granularity = đúng bằng invalidation hiện có.** Version theo NHÓM (debt/warranty/...),
   nên một ghi không liên quan trong nhóm vẫn làm version đổi → thi thoảng bỏ lỡ cơ hội 304,
   nhưng **không bao giờ phục vụ stale**. Đây là đánh đổi giống hệt lớp Redis cache.
4. **Chỉ áp cho GET đọc-only đã version-namespaced.** KHÔNG đụng: endpoint per-user động,
   long-poll `/live/poll`, endpoint serve file (đã có ETag/range riêng).

## Hạ tầng (file cốt lõi)

- `server/cache.js` — thêm `isCacheReady()` (cache đã connect & sẵn sàng chưa).
- `server/services/cacheKeys.js` — `reportNotModified(req, res, group)`: set `ETag` +
  `Cache-Control: no-cache, private`; nếu `If-None-Match` khớp → `res.status(304).end()` và
  trả `true` (caller return ngay). Cache off → trả `false`, không set gì.
- `server/index.js` — CORS `exposedHeaders: ['ETag']` để JS cross-origin (dev) đọc được ETag.
- `src/lib/api.js` — `apiGet(path, { conditional })`: lưu `{etag, body}` theo URL, gửi
  `If-None-Match`, gặp 304 → trả body đã lưu.

---

## Bảng tiến độ

### GĐ 1 — Hạ tầng + báo cáo `/reports/*` (server) ✅ (2026-06-29)
| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| `isCacheReady()` trong `cache.js` | ✅ | export công khai của ready() |
| `reportNotModified()` trong `cacheKeys.js` | ✅ | cache off → no-op (không 304) |
| CORS `exposedHeaders: ['ETag']` | ✅ | |
| Gắn vào `/reports/*` (11 endpoint) | ✅ | debt×8 (receivables, payables, progress-collection, contracts-asof, debt-by-contract, debt-by-customer, overdue-receivables, cashflow-summary), warranty, task (overdue-tasks), tender (tender-overview) |

> Sau GĐ 1: production (same-origin) đã được lợi NGAY qua HTTP cache của trình duyệt với
> các trang đang `fetch()` thô — không cần sửa frontend.

### GĐ 2 — Client tường minh (frontend) ✅ (2026-06-29)
| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| `apiGet(path,{conditional})` | ✅ | `src/lib/api.js`: Map `condStore` url→{etag,body}; `cache:'no-store'` + `If-None-Match`; 304→trả body cũ |
| Gom fetch thô trang Kế toán + Dashboard về `apiGet` conditional | ✅ | Receivables, Payables, ProgressCollection, OverdueAlerts, Warranty, DebtSummary (×2), Dashboard (`get` helper, 6 lệnh), CashflowMonthDetail (×2), OverdueDebtDetail, queries.js cashflowSummary |

> Lint + `npm run build` sạch. Các trang báo cáo dùng useState/useEffect (không qua TanStack)
> nên mỗi lần ghé lại đều fetch mới → conditional `apiGet` cho 304 ngay lần ghé thứ 2 (không
> tải/parse lại payload). Verify đầu-cuối trên trình duyệt (mạng → thấy 304) làm khi chạy thật.

### GĐ 3 — Mở rộng version-group khác ✅ (2026-06-29)
| Endpoint | Namespace | Trạng thái | Ghi chú |
|---|---|---|---|
| `/contracts` | contract-list | ✅ | per-user; ETag toàn cục an toàn nhờ clearConditionalCache khi logout |
| `/tender/my` | tender-my | ✅ | per-user |
| `/tender` | tender-list | ✅ | trước dùng key trực tiếp `lookup:tender-list`; thêm `invalidateTenderList()` (xóa lookup + bump version) thay `invalidateLookup('tender-list')` ở tenderController + tenderLotController |

> Helper tổng quát hóa: `versionNotModified(req,res,ns,tag)`; `reportNotModified` giờ là
> wrapper. Frontend: `clearConditionalCache()` (api.js) gọi trong `logout()` để body per-user
> không rò sang user kế tiếp cùng tab; `contracts`/`tenders` fetcher bật conditional.
> Verify 304 + bump cho contract-list & tender-list trên Redis thật: đạt.

### GĐ 4 — Lookups (`lookup:*`) ✅ (2026-06-29)
| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| `invalidateLookup` tự bump version `lookup:<name>` | ✅ | mọi call-site invalidate sẵn có tự đồng bộ ETag — không phải sửa |
| `lookupNotModified(req,res,name)` | ✅ | wrapper của versionNotModified |
| Gắn vào 14 GET danh mục | ✅ | customers, suppliers, users, managers, departments, positions, bb-types, dw-teams, dw-members, approval-forms, approval-users, tender-tpl, tender-list, tender-members |
| FE: bật conditional cho fetcher danh mục | ✅ | users, customers, suppliers, departments, positions, managers, bbTypes, tenderMembers, deptTeams, deptMembers |

> `invalidateTenderList()` rút gọn còn alias của `invalidateLookup('tender-list')` (đã tự bump);
> `getTenders` chuyển sang `lookupNotModified`. Verify 304 + auto-bump cho lk-customers/users/
> departments trên Redis thật: đạt. Lint + build sạch.

### GĐ 4b — MỌI tab chi tiết HĐ bán / HĐ nhập / gói thầu ✅ (2026-07-01)
| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Helper `contractTabNotModified` / `contractInTabNotModified` / `tenderTabNotModified` | ✅ | namespace `ctab:` / `citab:` / `ttab:` `<id>:<tab>`; granularity per thực thể per tab |
| `invalidateContract(All)` / `invalidateContractIn` / `invalidateTender` tự bump version tab | ✅ | song song `cacheDel(key body)` → MỌI call-site invalidate sẵn có tự đồng bộ ETag, không phải sửa (đã xác nhận không có `cacheDel` trực tiếp bypass) |
| Server: gắn helper vào TẤT CẢ endpoint đọc tab | ✅ | HĐ bán: info, boq, invoices, invoice-summary, progress, receivable, receivable-payments, guarantees, folders, files, deliveries, equipment, warranty-cases, warranty-activities, contract-ins, supply-coverage(×2). HĐ nhập: boq, payables, payments, customs, logistics, guarantees, deliveries, all-serials, all-items, progress, supplier-warranty, warranty-claims, folders, files. Gói thầu: info, activity, checklist, review, lots, folders, files |
| Ca ternary (files lọc folderId / atRoot) | ✅ | chỉ gọi helper ở nhánh được cache (không lọc) → biến thể lọc luôn 200 |
| FE: đổi loader tab sang `apiGet(...,{conditional:true})` | ✅ | ~25 component/hook: BOQ, Guarantee, Receivable, Progress, Invoice, Warranty(×4), SupplyCoverage, useSupplyFlags, useBienBanOptions, ContractInTab + các tab HĐ nhập (BOQ, Customs, Logistics, Guarantee, Delivery, Payable, Progress, Serial, SupplierWarranty), tender (Checklist, Activity, Lots, Review). Lookup ghép chung (bb-types, suppliers) cũng bật conditional |

> KHÔNG đổi FE: ContractDocumentsTab (component dùng chung HĐ/HĐ nhập/gói thầu) + các modal
> quét mã + TenderInfoTab/TenderDetailPage — vẫn `fetch` thô nhưng server đã phát ETag nên
> vẫn được 304 qua HTTP-cache trình duyệt (same-origin). Lint + build sạch.

### GĐ 5 — Docs + VPS + memory ⬜

---

## Checklist kiểm chứng

1. `npm run dev` với `REDIS_URL` + `CACHE_DEBUG=1`.
2. `curl -i` endpoint → thấy `ETag`; gọi lại với `-H 'If-None-Match: <etag>'` → `304` rỗng.
3. Ghi 1 thao tác liên quan (bump version) → `If-None-Match` cũ KHÔNG còn 304, trả 200 mới.
4. Tắt Redis → endpoint trả 200 đầy đủ (không 304, không stale).
