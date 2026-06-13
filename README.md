# Hệ thống Quản lý Hợp đồng & Dự án

Ứng dụng web quản lý vòng đời hợp đồng (bán & nhập), theo dõi BOQ, công nợ, tiến độ,
bảo lãnh, bảo hành, tài liệu và công việc cho từng dự án.

## Công nghệ

- **Frontend:** React 19 + Vite (SPA, điều hướng bằng state, không dùng router lib)
- **Backend:** Node.js + Express 5 (REST API)
- **CSDL:** PostgreSQL (truy cập qua `pg.Pool`)
- **Xác thực:** email + mật khẩu (bcrypt), phiên đăng nhập bằng token HMAC ký số,
  lưu trong cookie `httpOnly`
- **Style:** Tailwind CSS + CSS thuần

## Yêu cầu môi trường

- Node.js 18+ và npm
- PostgreSQL 14+

## Cài đặt

```bash
# 1. Cài dependencies
npm install

# 2. Tạo file cấu hình từ mẫu
cp .env.example .env
# rồi điền các giá trị (xem mục Biến môi trường bên dưới)

# 3. Khởi tạo CSDL: chạy baseline, sau đó các migration (nếu có) theo thứ tự số
psql -d <ten_db> -f server/schema.sql
# psql -d <ten_db> -f server/migrations/NNN_*.sql   # nếu có file migration mới
```

### Biến môi trường (`.env`)

| Biến | Mô tả |
|------|-------|
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL |
| `PORT` | Cổng chạy API Express (mặc định `5174`) |
| `VITE_API_BASE_URL` | Base URL frontend gọi API (mặc định `http://localhost:5174`) |
| `AUTH_SECRET` | Khóa bí mật ký token phiên (chuỗi random đủ dài) |
| `ALLOWED_ORIGINS` | Danh sách origin được phép gọi API ở môi trường production |
| `NODE_ENV` | Đặt `production` khi triển khai thật (bật cookie Secure, security headers...) |

## Chạy ứng dụng

```bash
npm run dev        # chạy đồng thời frontend (Vite) + backend (Express)
npm run dev:web    # chỉ frontend
npm run dev:api    # chỉ backend (hot reload)
npm run build      # build frontend cho production
npm run lint       # kiểm tra lint
```

Mặc định frontend chạy ở `http://localhost:5173`, API ở `http://localhost:5174`.

## Cấu trúc thư mục

```
server/                 Backend Express
  index.js              Điểm vào: mount route /api, phục vụ file tĩnh
  db.js                 Pool kết nối PostgreSQL dùng chung
  routes/               Định nghĩa endpoint REST theo từng nghiệp vụ
  controllers/          Xử lý logic nghiệp vụ
  middleware/           Auth, phân quyền, rate-limit, lọc upload, security headers
  auth/                 Ký & xác minh token phiên
  schema.sql            Schema CSDL hợp nhất (baseline)
  migrations/           Các thay đổi schema tăng dần (đánh số)

src/                    Frontend React
  pages/                Các trang chính (Home, Hợp đồng, Quản trị...)
  components/           Component dùng lại theo nghiệp vụ
  context/              React context (phiên đăng nhập, phân quyền)
  config/              Cấu hình API & wrapper fetch
```

## Phân quyền

- Mọi API (trừ đăng nhập/đăng xuất/health-check) đều yêu cầu phiên đăng nhập hợp lệ.
- Thao tác quản trị người dùng / danh mục dùng chung: chỉ tài khoản admin.
- Ghi/sửa/xóa dữ liệu bên trong một hợp đồng: chỉ PM của hợp đồng đó (hoặc admin);
  mọi người dùng đã đăng nhập đều được xem.

## Triển khai

1. `npm run build` để tạo bản frontend tĩnh trong `dist/`.
2. Đặt `NODE_ENV=production` và cấu hình `AUTH_SECRET`, `ALLOWED_ORIGINS` trên máy chủ.
3. Chạy tiến trình Express; đặt sau reverse proxy (nginx) có HTTPS.
4. File người dùng tải lên được lưu ở `server/uploads/` (không nằm trong mã nguồn).
