# Redis cache — Log triển khai theo giai đoạn

Tài liệu sống theo dõi việc thêm lớp cache Redis cho backend. Cập nhật trạng thái sau mỗi
giai đoạn và commit kèm code của giai đoạn đó.

Trạng thái: ✅ chưa làm · 🔄 đang làm · ✅ xong

## Nguyên tắc cốt lõi

1. **Redis là phụ trợ, KHÔNG phải phụ thuộc cứng.** Redis mất kết nối → request vẫn chạy
   (cache miss → query thẳng DB). Không endpoint nào được 500 vì Redis. Mọi helper trong
   `server/cache.js` nuốt lỗi và degrade về no-op.
2. **KHÔNG cache dữ liệu real-time / per-user động / đọc có side-effect** (xem mục "Không
   cache" cuối tài liệu).
3. **Invalidate chính xác từng key khi ghi.** Controller GHI gọi `invalidate*()` của
   `server/services/cacheKeys.js` ngay sau khi ghi DB thành công (fire-and-forget). Báo cáo
   dùng version-namespace (INCR) để phủ mọi biến thể tham số mà không cần SCAN.

## Hạ tầng (file cốt lõi)

- `server/cache.js` — client singleton + `cacheWrap/cacheGet/cacheSet/cacheDel` +
  `cacheVersion/bumpVersion`. Bật bằng env `REDIS_URL`; `CACHE_DEBUG=1` để log hit/miss.
- `server/services/cacheKeys.js` — quy ước key + các hàm `invalidate*`.
- `server/index.js` — gọi `connectCache()` trong `app.listen()`.

---

## Bảng tiến độ

### GĐ 0 — Hạ tầng
| Hạng mục | Trạng thái | Ngày | Ghi chú |
|---|---|---|---|
| `server/cache.js` | ✅ | 2026-06-27 | graceful degradation, version-namespace |
| `server/services/cacheKeys.js` | ✅ | 2026-06-27 | key builders + invalidation |
| Wire `connectCache` vào `index.js` | ✅ | 2026-06-27 | trong app.listen |
| `REDIS_URL` + `CACHE_DEBUG` vào `.env.example` | ✅ | 2026-06-27 | |
| `npm install redis` (node-redis v4) | ✅ | 2026-06-27 | |

### GĐ 1 — Danh mục & cấu hình global ít đổi ✅ (2026-06-27)
| Endpoint | Key | TTL | Trạng thái | Ghi chú |
|---|---|---|---|---|
| `/customers` | `lookup:customers` | 12h | ✅ | invalidate ở create/update customer |
| `/suppliers` | `lookup:suppliers` | 12h | ✅ | invalidate ở create/update supplier |
| `/users`, `/managers` | `lookup:users`, `lookup:managers` | 6h | ✅ | users cache bản thô, redact bản sao theo role; invalidate ở create/update user |
| `/departments`, `/positions` | `lookup:departments`, `lookup:positions` | 24h | ✅ | invalidate ở create/update dept/position |
| `/dept-work/teams`, `/dept-work/members` | `lookup:dw-teams`, `lookup:dw-members` | 24h/6h | ✅ | dw-members invalidate qua create/update user (đổi vị trí) |
| `/approvals/forms`, `/approvals/user-options` | `lookup:approval-forms`, `lookup:approval-users` | 12h | ✅ | invalidate ở create/update/delete form + saveFields/saveSteps; approval-users qua user write |
| `/approvals/form-options` (per-user) | `approval:form-opts:v{N}:{userId}` | 6h | ✅ | version-namespace, bump khi form/department đổi |
| `/tender/checklist-template` | `lookup:tender-tpl` | 24h | ✅ | invalidate ở create/update/delete template item |

### GĐ 2 — Báo cáo `/reports/*` (version-namespace) ✅ (2026-06-28)
| Nhóm | Endpoint | Trạng thái | Ghi chú |
|---|---|---|---|
| debt | overdue-receivables, cashflow-summary, receivables, payables, progress-collection, debt-by-contract, debt-by-customer, contracts-asof | ✅ | |
| warranty | warranty | ✅ | |
| task | overdue-tasks | ✅ | |
| tender | tender-overview | ✅ | |

### GĐ 3 — Chi tiết HĐ bán (`c:{id}:{tab}`) ✅ (2026-06-28)
| Tab | Trạng thái | Ghi chú |
|---|---|---|
| info, getAllContracts | ✅ | |
| boq | ✅ | |
| invoices, invoice-summary | ✅ | |
| progress | ✅ | |
| receivable, receivable-payments | ✅ | |
| guarantees | ✅ | |
| folders, files | ✅ | |
| deliveries | ✅ | |
| equipment, warranty-cases, warranty-activities | ✅ | |

### GĐ 4 — Chi tiết HĐ nhập + tra cứu serial (`ci:{id}:{tab}`, `serial-lookup:*`) ✅ (2026-06-28)
| Tab | Trạng thái | Ghi chú |
|---|---|---|
| contract-ins (DS HĐ nhập của HĐ bán) | ✅ | |
| boq, payables, payments, guarantees, customs, logistics | ✅ | |
| deliveries | ✅ | |
| all-serials, all-items | ✅ | |
| supplier-warranty, warranty-claims | ✅ | |
| `/warranty-lookup` (serial) | ✅ | |

### GĐ 5 — Đấu thầu (`t:{id}:{tab}`) ✅ (2026-06-28)
| Tab | Trạng thái | Ghi chú |
|---|---|---|
| list (`/tender`), my (`/tender/my`) | ✅ | |
| checklist | ✅ | |
| lots | ✅ | |
| review | ✅ | |
| folders, files | ✅ | |
| activity | ✅ | |

### GĐ 6 — Dashboard cá nhân (per-user) ✅ (2026-06-28)
> Lưu ý: dashboard PM/assigned-tasks invalidate chính xác (qua `invalidateContractMembers`
> + `upsertTracking`). Dashboard PHÒNG (dept work) chủ yếu dựa TTL 5' khi việc của thành
> viên đổi (invalidation chính xác theo trưởng phòng quá phức tạp) — badge cảnh báo
> real-time vẫn chạy riêng qua long-poll, không bị ảnh hưởng.
| Endpoint | Key | Trạng thái | Ghi chú |
|---|---|---|---|
| `/api/pm/:userId/dashboard` | `dash:pm:{userId}` | ✅ | |
| `/api/pm/:userId/assigned-tasks` | `dash:pm-tasks:{userId}` | ✅ | |
| `/api/dept/:userId/work-dashboard` | `dash:dept:{userId}` | ✅ | |

---

## KHÔNG cache (đã chốt)

- Long-poll `/api/live/poll`.
- Việc phòng / công việc HĐ có `unread_count` per-user + ghi mốc đã đọc khi GET:
  `/dept-work/tasks(/:id)`, `/dept-work/unread-count`, `/dept-work/logs`, `*/entries`,
  `/contracts/:id/tasks`, `/tasks/:taskId/entries`, `/contract-tasks/unread-count`.
- Phê duyệt per-user động: `/approvals/requests/{inbox,upcoming,my,following,all,:id}`,
  `preview-chain`, `export`.
- Endpoint serve file (view/download) — đã có ETag/range.

---

## Cần làm để BẬT cache (local)

- [ ] Thêm `REDIS_URL=redis://localhost:6379` vào `.env` **máy dev** (hiện chưa có →
      cache đang TẮT, app vẫn chạy bình thường bằng query thẳng). Có thể thêm `CACHE_DEBUG=1`.
- Đã kiểm chứng tầng cache (2026-06-27): cacheWrap hit/miss, invalidate lookup, version
  bump cho report, và graceful degradation khi tắt Redis — đều đạt.

## Cần áp lên VPS

- [ ] Đặt `REDIS_URL` trong `.env` của VPS (Redis đã cài sẵn), restart app.
- [ ] Kiểm chứng hit/miss + invalidation bằng `redis-cli` trên VPS.
- [ ] (Tùy chọn) đặt `maxmemory` + `maxmemory-policy allkeys-lru` cho Redis VPS để cache
      tự đào thải khi đầy.

## Checklist kiểm chứng mỗi giai đoạn

1. `npm run dev` với `REDIS_URL` + `CACHE_DEBUG=1`; Redis dev chạy (`docker ps`).
2. Hit/miss: gọi endpoint 2 lần → lần 2 HIT; `redis-cli KEYS '<prefix>:*'` thấy key.
3. Invalidation: ghi 1 thao tác liên quan → key bị xóa (hoặc version tăng); GET lại ra
   dữ liệu mới; entity khác không bị ảnh hưởng.
4. Degradation: `docker stop <redis>` → endpoint vẫn trả đúng (không 500); bật lại → cache
   hoạt động lại.
