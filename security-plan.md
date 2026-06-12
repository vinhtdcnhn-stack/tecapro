# Kế hoạch Review Security — Hello World (Contract Management)

> **Cập nhật lần cuối:** 2026-06-12
> **Trạng thái:** ✅ Đã xong · 🔄 Đang làm · ⬜ Chưa làm
>
> Quy ước: khi bắt đầu một bước, đổi ⬜ → 🔄; khi hoàn thành, đổi 🔄 → ✅ và ghi chú kết quả
> (OK / phát hiện vấn đề + link file) vào cột "Kết quả" hoặc mục **Findings** cuối file.

## Tổng quan hệ thống (đã khảo sát)

- **Stack:** React 19 + Vite (SPA, không router lib) · Express 5 · PostgreSQL (pg.Pool) · multer upload
- **Auth:** HMAC-SHA256 session token tự viết ([server/auth/token.js](server/auth/token.js)), cookie httpOnly `tecapro_auth`, gate toàn bộ API bằng `requireAuth` ([server/routes/index.js:32](server/routes/index.js#L32))
- **Bề mặt tấn công chính:** ~20 routers / ~25 controllers REST, upload file đa nơi (contracts, contract-ins, tasks), serve file tĩnh `/uploads` + `/api/files/:id/view`, login công khai
- **Đã có sẵn:** login rate-limit, upload extension blocklist, CORS allowlist, error handler ẩn stack ở prod, denylist token khi logout

---

## Giai đoạn 0 — Khảo sát & lập kế hoạch

| # | Bước | Trạng thái |
|---|------|-----------|
| 0.1 | Đọc cấu trúc dự án, xác định bề mặt tấn công (routes, middleware, upload, auth) | ✅ |
| 0.2 | Lập kế hoạch review chi tiết (file này) | ✅ |

## Giai đoạn 1 — Secrets & cấu hình môi trường ✅ (xong phần kiểm tra local; còn 2 việc thủ công trên VPS)

| # | Bước | Trạng thái | Kết quả |
|---|------|-----------|---------|
| 1.1 | Kiểm tra `.env` KHÔNG bị commit vào git; xác nhận `.gitignore` cover `.env*` | ✅ | **PHÁT HIỆN F-01 (Critical):** `.env` từng bị commit và vẫn còn trong history (5 commit, mới nhất `cfa456b`); repo `vinhtdcnhn-stack/tecapro` là **PUBLIC** trên GitHub → `TELEGRAM_BOT_TOKEN` đang lộ công khai. Hiện tại `.env` đã được ignore đúng (`.gitignore:15`), working tree sạch. |
| 1.2 | Đánh giá độ mạnh `AUTH_SECRET`; xác nhận VPS dùng secret KHÁC local | ✅ | `AUTH_SECRET` **chưa từng** xuất hiện trong git history (an toàn về mặt lộ lọt). Tuy nhiên giá trị hiện tại chỉ 32 ký tự dạng "human-pattern", ngắn hơn khuyến nghị 48-byte random của chính code ([token.js:11](server/auth/token.js#L11)) → F-02 (Medium). VPS dùng secret khác hay không: kiểm tra thủ công (xem mục VPS cuối giai đoạn). |
| 1.3 | Quét secrets hard-code trong source `server/` + `src/` | ✅ | Sạch — không có password/secret/api-key/token hard-code. `.env.example` chỉ chứa placeholder. |
| 1.4 | Kiểm tra `DATABASE_URL`: mật khẩu DB, DB không expose internet | ✅ (local) / 🟡 (VPS) | Local: `postgres:123456@localhost` — password yếu nhưng chỉ localhost dev → F-03 (Low). Giá trị này cũng nằm trong history public (chỉ là cred localhost, rủi ro thấp). VPS: cần kiểm tra thủ công. |
| 1.5 | Token Telegram lấy từ env, nội dung gửi không nhạy cảm | ✅ | [telegram.js:1](server/services/telegram.js#L1) đọc `process.env.TELEGRAM_BOT_TOKEN` đúng cách, không hard-code. Chỉ gửi thông báo đăng nhập tới `telegram_chat_id` của chính user. Nhưng bản thân token đã lộ qua F-01 → phải revoke. |
| 1.6 | Xác nhận `NODE_ENV=production` trên VPS | 🟡 | Không kiểm tra được từ máy local — xem checklist VPS bên dưới. |
| 1.7 | (Phát sinh) Soát chất lượng file `.env` local | ✅ | `.env` có **khóa trùng lặp**: `VITE_API_BASE_URL` ×2, `DATABASE_URL` ×2 (dotenv lấy giá trị khai báo sau → đang chạy `hello_web_db`, đúng theo memory) → F-04 (Info, dọn dẹp). Thiếu `NODE_ENV`, `ALLOWED_ORIGINS` so với `.env.example` (dev nên chấp nhận được). |

**Checklist thủ công trên VPS (SSH vào chạy, không làm được từ máy local):**

```bash
# 1.2/1.6 — secret & NODE_ENV (trong thư mục app trên VPS)
grep -E '^(AUTH_SECRET|NODE_ENV|DATABASE_URL|ALLOWED_ORIGINS)=' .env   # AUTH_SECRET phải KHÁC local, NODE_ENV=production
# 1.4 — Postgres chỉ listen localhost
ss -tlnp | grep 5432        # mong đợi 127.0.0.1:5432, KHÔNG phải 0.0.0.0
```

## Giai đoạn 2 — Xác thực (Authentication) ✅ Đã xong

| # | Bước | Trạng thái | Kết quả |
|---|------|-----------|---------|
| 2.1 | Review [server/auth/token.js](server/auth/token.js): verify dùng `timingSafeEqual` ✓, exp check ✓ — kiểm tra thêm: payload có thể bị tái dùng sau khi user bị khoá/đổi role không (token sống 7 ngày, không có cơ chế invalidate khi đổi quyền) | ✅ | Ký/verify chuẩn (length-check + `timingSafeEqual`, exp check, fail ở prod nếu thiếu secret). **Xác nhận nghi vấn → F-05 (Medium):** `requireAuth` lấy `role` từ payload, không đối chiếu DB — đổi role/xoá user/đổi mật khẩu KHÔNG vô hiệu token cũ (sống tới 7 ngày). Ghi chú thêm: `readToken` chấp nhận cả header `Bearer` ngoài cookie — chỉ là đường vào thứ hai cùng cơ chế verify, chấp nhận được. |
| 2.2 | Review [server/controllers/authController.js](server/controllers/authController.js): login flow — so sánh password bằng bcrypt, không lộ "email tồn tại / sai password" khác nhau (user enumeration), không log password | ✅ | `bcrypt.compare` ✓; cùng một message "Sai email hoặc mật khẩu." cho cả 2 nhánh ✓; không log password ✓. Còn **timing oracle nhẹ**: email không tồn tại → trả lời ngay (bỏ qua bcrypt ~100ms) → đo thời gian đoán được email tồn tại → F-08 (Info, đã có rate-limit che bớt). Các endpoint `check-email`/`check-username` đều `requireAdmin` ✓ nên không phải vector enumeration. |
| 2.3 | Kiểm tra cookie: `httpOnly` ✓, `sameSite: 'lax'` ✓, `secure` theo NODE_ENV ✓ — xác nhận `maxAge` khớp token exp, và path không quá rộng nếu cần | ✅ | `maxAge = TOKEN_MAX_AGE_SEC * 1000` khớp đúng exp của token ✓ ([authController.js:16-25](server/controllers/authController.js#L16-L25)). `path: '/'` là cần thiết (cookie phải đi cùng cả `/api` lẫn `/uploads`) — không quá rộng. OK. |
| 2.4 | Review change-password ([routes/index.js:42](server/routes/index.js#L42)): có yêu cầu mật khẩu cũ không? Độ dài/độ mạnh mật khẩu mới có được enforce? Đổi mật khẩu có revoke các session cũ không? | ✅ | Yêu cầu `current_password` ✓ (admin reset hộ đi qua `updateUser` riêng, hợp lý). Độ dài tối thiểu chỉ **6 ký tự**, không có yêu cầu độ phức tạp → F-07 (Low). Đổi mật khẩu **không revoke session cũ** — token cũ vẫn dùng được tới 7 ngày → gộp vào F-05. |
| 2.5 | Review login rate-limit ([server/middleware/loginRateLimit.js](server/middleware/loginRateLimit.js) + [rateLimit.js](server/middleware/rateLimit.js)): ngưỡng hợp lý, `trust proxy` chỉ tin 1 hop ✓ — thử nghĩ cách bypass (X-Forwarded-For giả khi không qua nginx?) | ✅ | Ngưỡng 10 lần SAI / 15 phút / IP hợp lý; chỉ đếm fail nên không khoá nhầm văn phòng NAT ✓. **Tìm ra cách bypass → F-06 (Medium):** `app.listen(port)` bind `0.0.0.0` + `trust proxy 1` — nếu firewall VPS không chặn port 5174, attacker gọi thẳng Express (không qua nginx) và tự đặt `X-Forwarded-For` → mỗi request một "IP" mới, vô hiệu rate-limit. Cần bind `127.0.0.1` ở prod hoặc xác nhận firewall chặn (thêm vào checklist VPS). Bộ đếm trong RAM (mất khi restart, không share đa instance) — chấp nhận với 1 instance. |
| 2.6 | Kiểm tra denylist logout chỉ trong RAM (mất khi restart) — đánh giá rủi ro chấp nhận được với app nội bộ, ghi nhận vào findings nếu cần Redis | ✅ | Chấp nhận được: denylist chỉ là lớp phòng vệ phụ (cookie httpOnly đã bị xoá khi logout), có tự dọn mỗi giờ chống phình RAM ✓. Chỉ cần Redis khi chạy nhiều instance — ghi nhận, không cần vá. |
| 2.7 | Kiểm tra dư thừa: cả `bcrypt` lẫn `bcryptjs` trong package.json — xác định bản nào thực dùng, gỡ bản kia | ✅ | Chỉ `bcryptjs` được import (duy nhất tại [authController.js:1](server/controllers/authController.js#L1)); `bcrypt` (native) không dùng ở đâu. **Đã gỡ** `bcrypt` bằng `npm uninstall bcrypt` (−3 packages) → F-09 (Info, **đã vá**). 9.4 coi như xong luôn. |

**Bổ sung checklist VPS (phát sinh từ 2.5 / F-06):**

```bash
# F-06 — xác nhận port Express KHÔNG truy cập được từ ngoài (chỉ nginx gọi vào)
ss -tlnp | grep 5174        # nếu 0.0.0.0:5174 → cần firewall chặn 5174 hoặc đổi app.listen(port, '127.0.0.1')
```

## Giai đoạn 3 — Phân quyền (Authorization / IDOR)

> Nguyên tắc đã đặt trong CLAUDE.md: **identity luôn lấy từ `req.user`, không bao giờ từ client**. Cần verify từng controller có tuân thủ.

| # | Bước | Trạng thái |
|---|------|-----------|
| 3.1 | Grep toàn bộ `server/controllers/` tìm chỗ còn đọc `userId` / `user_id` từ `req.body` / `req.query` / `req.params` để quyết định quyền | ⬜ |
| 3.2 | Kiểm tra IDOR theo contract: user thường có xem/sửa được contract không thuộc về mình không? (contractController, contractInController — có check membership `contract_out_member` không, hay chỉ cần đăng nhập là truy cập mọi hợp đồng?) | ⬜ |
| 3.3 | Kiểm tra IDOR tài liệu: `/api/files/:id/view` + documentController — quyền xem file có gắn với quyền xem contract chứa nó không | ⬜ |
| 3.4 | Kiểm tra các op admin-only: tạo/sửa user, xoá dữ liệu — route nào thiếu `requireAdmin`? Đối chiếu từng `router.delete`/`router.put` trong `server/routes/*.js` | ⬜ |
| 3.5 | Kiểm tra mass-assignment: update user ([authController.updateUser](server/controllers/authController.js)) có cho phép tự set `role = 1` qua body không (kể cả qua change-password / self-update path) | ⬜ |
| 3.6 | Kiểm tra warrantyLookupController — đây có phải route tra cứu public/semi-public không, lộ dữ liệu gì | ⬜ |

## Giai đoạn 4 — SQL Injection

| # | Bước | Trạng thái |
|---|------|-----------|
| 4.1 | Grep toàn bộ `server/` tìm string interpolation trong SQL: `` query(` `` + `${`, `pool.query(.*\+`, `' || '` — mọi query phải dùng tham số `$1, $2...` | ⬜ |
| 4.2 | Soát kỹ các chỗ build SQL động: ORDER BY / sort column, filter, search (`ILIKE`), bulk insert (warrantyImportController, BOQ import) — cột sort phải qua allowlist, không nối trực tiếp từ client | ⬜ |
| 4.3 | Kiểm tra `LIMIT`/`OFFSET` phân trang có ép kiểu số không | ⬜ |

## Giai đoạn 5 — Upload & phục vụ file

| # | Bước | Trạng thái |
|---|------|-----------|
| 5.1 | Review [server/middleware/uploadFilter.js](server/middleware/uploadFilter.js): hiện là **blocklist** extension — đánh giá chuyển sang allowlist; kiểm tra bypass double-extension (`file.pdf.exe` bị chặn ✓ vì lấy ext cuối, nhưng `file.exe.pdf` lọt — chấp nhận?); chưa kiểm tra MIME/magic bytes | ⬜ |
| 5.2 | Path traversal khi LƯU: filename do multer sinh + sanitize `[^a-zA-Z0-9._-]` ([documentController.js:19-23](server/controllers/documentController.js#L19-L23)) — verify `contractId` trong đường dẫn thư mục được ép kiểu số (hiện `String(req.params.contractId)` — nếu là `../../x` thì sao?) | ⬜ |
| 5.3 | Path traversal khi ĐỌC: [documentController.js:69](server/controllers/documentController.js#L69) `path.join(__dirname, '..', storedPath)` rồi `res.sendFile` — verify `storedPath` chỉ từ DB (server tự ghi) và vẫn nên normalize + check prefix `uploads/` trước khi sendFile | ⬜ |
| 5.4 | Kiểm tra tất cả các điểm upload khác (taskAttachmentController, warrantyImportController nhận file Excel) dùng cùng filter + limits | ⬜ |
| 5.5 | Header khi serve file: `/uploads` đã có `nosniff` ✓ — kiểm tra `/api/files/:id/view` có set `nosniff` + `Content-Disposition` phù hợp không (tránh HTML/SVG render inline → XSS) | ⬜ |
| 5.6 | Kiểm tra parse Excel bằng `xlsx` từ file người dùng upload (BOQ import, warranty import) — lib này có CVE (xem 9.2); đánh giá input không tin cậy đi vào parser | ⬜ |

## Giai đoạn 6 — CORS, CSRF & Security Headers

| # | Bước | Trạng thái |
|---|------|-----------|
| 6.1 | CORS ([server/index.js:19-35](server/index.js#L19-L35)): logic prod đã chặt ✓ — xác nhận giá trị `ALLOWED_ORIGINS` thực tế trên VPS không chứa origin lạ/wildcard | ⬜ |
| 6.2 | CSRF: cookie `sameSite: 'lax'` chặn POST cross-site từ trình duyệt hiện đại — đánh giá còn lỗ nào (GET có side-effect? route nào dùng GET để thay đổi dữ liệu?) ; grep `router.get` có hành vi ghi | ⬜ |
| 6.3 | Security headers tổng thể: chưa có helmet — đánh giá thêm `X-Content-Type-Options`, `X-Frame-Options`/CSP frame-ancestors (chống clickjacking), `Referrer-Policy`, CSP cơ bản cho SPA (có thể đặt ở nginx) | ⬜ |
| 6.4 | SPA fallback `app.get('*splat')` ([server/index.js:56](server/index.js#L56)) trả index.html cho mọi path — xác nhận không match nhầm `/api/*` hay `/uploads/*` đã 404 | ⬜ |

## Giai đoạn 7 — Rate limiting & DoS

| # | Bước | Trạng thái |
|---|------|-----------|
| 7.1 | Hiện chỉ login có rate-limit — đánh giá các endpoint đắt khác: import Excel, upload 50MB, query báo cáo lớn (pmDashboard) có cần giới hạn không | ⬜ |
| 7.2 | `express.json()` không set limit → mặc định 100KB (Express 5) — xác nhận đủ, các endpoint nhận payload lớn (bulk BOQ) có bị chặn nhầm/cần limit riêng không | ⬜ |
| 7.3 | `/api/health` public và query DB mỗi lần gọi — đánh giá khả năng bị spam làm cạn pool connection | ⬜ |

## Giai đoạn 8 — Frontend

| # | Bước | Trạng thái |
|---|------|-----------|
| 8.1 | XSS: đã grep nhanh không có `dangerouslySetInnerHTML`/`innerHTML`/`eval` ✓ — soát thêm chỗ render URL từ dữ liệu (href động, preview file iframe trong DocumentPreviewPanel) tránh `javascript:` URL | ⬜ |
| 8.2 | Kiểm tra localStorage: CLAUDE.md nói còn lưu `userId` — xác nhận server không tin giá trị này (chỉ là cache UI), và không lưu token/data nhạy cảm khác trong localStorage | ⬜ |
| 8.3 | Kiểm tra [src/config/fetchSetup.js](src/config/fetchSetup.js) + [src/config/api.js](src/config/api.js): `credentials: 'include'` chỉ gửi tới API origin của mình, không leak cookie sang origin khác | ⬜ |
| 8.4 | Kiểm tra ẩn UI theo role chỉ là UX — mọi kiểm soát thật nằm server-side (đối chiếu với kết quả Giai đoạn 3) | ⬜ |

## Giai đoạn 9 — Dependencies & supply chain

| # | Bước | Trạng thái |
|---|------|-----------|
| 9.1 | Chạy `npm audit` (production deps), ghi lại các CVE high/critical và đường vá | ⬜ |
| 9.2 | `xlsx@0.18.5`: có CVE đã biết (prototype pollution / ReDoS) và bản npm registry không còn được vá — đánh giá chuyển sang bản từ cdn.sheetjs.com hoặc lib thay thế (exceljs) vì app parse file Excel KHÔNG tin cậy do user upload | ⬜ |
| 9.3 | Kiểm tra version Express 5 / multer 2 / pg đang dùng có advisory mở không | ⬜ |
| 9.4 | Gỡ dependency thừa (`bcrypt` hoặc `bcryptjs` — trùng chức năng, xem 2.7) | ✅ (đã làm ở 2.7 — gỡ `bcrypt`, giữ `bcryptjs`) |

## Giai đoạn 10 — Logging & xử lý lỗi

| # | Bước | Trạng thái |
|---|------|-----------|
| 10.1 | Review [server/utils/logger.js](server/utils/logger.js) + các điểm gọi: không log password, token, cookie, nội dung file | ⬜ |
| 10.2 | Error handler toàn cục đã ẩn message ở prod ✓ — soát các controller có `res.status(500).json({ error: err.message })` cục bộ làm lộ chi tiết DB | ⬜ |
| 10.3 | Đánh giá audit trail: hành động nhạy cảm (đổi quyền, xoá hợp đồng, xoá file) có ghi lại ai-làm-gì-khi-nào không | ⬜ |

## Giai đoạn 11 — Hạ tầng / triển khai VPS

| # | Bước | Trạng thái |
|---|------|-----------|
| 11.1 | HTTPS: nginx có redirect 80→443, cert còn hạn, HSTS | ⬜ |
| 11.2 | nginx có set `client_max_body_size` khớp limit 50MB; có truyền `X-Forwarded-For` đúng 1 hop (khớp `trust proxy 1`) | ⬜ |
| 11.3 | PostgreSQL trên VPS: chỉ listen localhost, password mạnh, có backup định kỳ (kèm `server/uploads/` — theo memory: uploads không nằm trong git, chỉ tồn tại trên VPS) | ⬜ |
| 11.4 | Quyền file hệ thống: `.env` chmod 600, process chạy bằng user thường (không root) | ⬜ |

## Giai đoạn 12 — Tổng hợp & vá

| # | Bước | Trạng thái |
|---|------|-----------|
| 12.1 | Tổng hợp findings, phân loại Critical / High / Medium / Low | ⬜ |
| 12.2 | Vá theo thứ tự ưu tiên (mỗi fix một commit riêng, migration nếu đụng schema theo quy ước `server/migrations/NNN_*.sql`) | ⬜ |
| 12.3 | Re-test sau vá (đăng nhập, upload, phân quyền) + cập nhật CLAUDE.md nếu có quy ước mới | ⬜ |

---

## Findings (ghi nhận trong quá trình review)

> Format: `ID [Mức độ] Mô tả — vị trí — trạng thái vá`

- **F-01 [Critical]** `TELEGRAM_BOT_TOKEN` lộ trong git history của repo **public** (`.env` tại commit `cfa456b` và các commit sau, đã xoá khỏi working tree ở `4685f69` nhưng history vẫn giữ). Ai cũng có thể lấy token và điều khiển bot (gửi tin nhắn giả mạo tới user, đọc update của bot). **Đã xác minh 2026-06-12: token VẪN SỐNG** (`getMe` trả về bot `TecaproCNHNbot` bình thường) → khắc phục là KHẨN CẤP. **Việc chỉ bạn làm được (theo thứ tự):** ① Mở Telegram → @BotFather → `/revoke` → chọn `TecaproCNHNbot` → nhận token mới → dán vào `.env` local (dòng `TELEGRAM_BOT_TOKEN=`) và `.env` trên VPS, restart app; ② Chuyển repo sang private: GitHub → repo `tecapro` → Settings → General → Danger Zone → "Change repository visibility" → Private (gh CLI không có trên máy nên không tự làm được); ③ (tuỳ chọn, sau khi revoke) dọn history bằng `git filter-repo` + force-push. — **chờ bạn thao tác ① và ②**
- **F-02 [Medium]** `AUTH_SECRET` hiện 32 ký tự dạng human-pattern (kèm dấu backtick bao quanh trong file), yếu hơn khuyến nghị 48-byte random của chính codebase. Chưa từng lộ ra git. **Đã vá phía local (2026-06-12):** thay bằng 48-byte random hex mới (bỏ luôn backtick), server boot sạch — mọi phiên local cũ đã bị logout. **Còn VPS (bạn làm tay):** SSH vào VPS, chạy `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`, dán vào `AUTH_SECRET=` trong `.env` trên VPS (giá trị PHẢI KHÁC local), restart app — toàn bộ user sẽ phải đăng nhập lại. — **✅ local / 🟡 VPS**
- **F-03 [Low]** Password Postgres local là `123456` (user `postgres`), và cred localhost này cũng nằm trong history public. Chỉ rủi ro nếu máy dev/VPS mở port 5432 ra ngoài. **Khắc phục:** đổi password DB; xác nhận Postgres chỉ listen localhost (cả local lẫn VPS). — **chưa vá**
- **F-04 [Info]** `.env` local có khóa khai báo trùng (`DATABASE_URL` ×2, `VITE_API_BASE_URL` ×2) — dotenv lấy giá trị sau nên app vẫn chạy đúng DB `hello_web_db`, nhưng dễ gây nhầm khi sửa dòng đầu mà không có tác dụng. **Khắc phục:** xoá các dòng trùng, bổ sung `ALLOWED_ORIGINS`/`NODE_ENV` theo `.env.example`. — **chưa vá**
- **F-05 [Medium]** Token phiên sống 7 ngày và mang `role` ngay trong payload; `requireAuth` không đối chiếu DB → khi admin hạ quyền / xoá user / user đổi mật khẩu, token cũ vẫn hợp lệ với quyền cũ tới 7 ngày (denylist chỉ áp dụng khi tự logout). **Đã vá theo phương án ②+①:** thêm cột `app_user.token_version` ([migration 042](server/migrations/042_add_token_version.sql), đã chạy trên DB local — **VPS cần chạy tay**); token nhúng claim `tv`; `requireAuth` đối chiếu DB mỗi request (role lấy giá trị mới nhất → đổi quyền hiệu lực ngay; `tv` phải khớp). Đổi mật khẩu (tự đổi hoặc admin reset qua updateUser) bump `token_version` → mọi phiên cũ logout; phiên tự đổi được cấp lại cookie nên không gián đoạn. Token cũ chưa có `tv` coi là 0 → deploy không làm logout hàng loạt. Đã test flow thật: login → đổi mật khẩu → token cũ 401, token mới 200. — **✅ đã vá** (commit `cd6340a`)
- **F-06 [Medium]** Express bind `0.0.0.0` kết hợp `trust proxy 1`: nếu VPS không chặn port 5174 từ ngoài, attacker gọi thẳng Express bỏ qua nginx và giả `X-Forwarded-For` để xoay IP → bypass login rate-limit. **Đã vá:** production mặc định bind `127.0.0.1` ([server/index.js](server/index.js)), override được bằng env `HOST` (đã ghi chú trong `.env.example`). Vẫn nên xác nhận trên VPS sau khi deploy: `ss -tlnp | grep 5174` phải ra `127.0.0.1:5174`. — **✅ đã vá** (commit `14441cc`)
- **F-07 [Low]** Mật khẩu mới chỉ yêu cầu tối thiểu 6 ký tự; `createUser`/`updateUser` (admin) không kiểm tra độ dài nào. **Đã vá:** tối thiểu 8 ký tự (`PASSWORD_MIN_LENGTH`), áp dụng thống nhất cả create/update/change-password phía server + đồng bộ validate phía client (`ChangePasswordModal`). Mật khẩu cũ ngắn hơn vẫn đăng nhập được, chỉ chặn khi đặt mới. — **✅ đã vá** (commit `af5a58f`)
- **F-08 [Info]** Login có timing oracle nhẹ: email không tồn tại trả lời ngay, email đúng phải chạy bcrypt → đo thời gian suy ra email tồn tại. **Đã vá:** nhánh không tìm thấy user chạy `bcrypt.compare` với dummy hash để hai nhánh tốn thời gian như nhau. — **✅ đã vá** (commit `0dbf8a8`)
- **F-09 [Info]** Dependency trùng chức năng: cả `bcrypt` lẫn `bcryptjs` trong package.json, nhưng source chỉ import `bcryptjs`. **Khắc phục:** đã chạy `npm uninstall bcrypt` (gỡ 3 packages, package.json + lockfile đã cập nhật). — **✅ đã vá** (đồng thời đóng luôn bước 9.4)
## Ghi chú đã biết trước khi review (từ khảo sát Giai đoạn 0)

1. **`xlsx@0.18.5`** parse file user upload + có CVE công khai → ứng viên finding High (xem 5.6, 9.2).
2. **Upload filter là blocklist** không phải allowlist, chưa check MIME (xem 5.1).
3. **Denylist logout token chỉ trong RAM** — mất khi restart, không chia sẻ đa instance (đã ghi chú trong code là chấp nhận; xem 2.6).
4. **Cả `bcrypt` và `bcryptjs`** cùng có mặt trong dependencies (xem 2.7).
5. **Chưa có security headers tổng thể** (helmet/CSP) ngoài `nosniff` cho `/uploads` (xem 6.3).
6. **Token 7 ngày không tự vô hiệu khi đổi role/khoá user** (xem 2.1).
