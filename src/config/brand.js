// Nhận diện thương hiệu theo từng doanh nghiệp, nạp LÚC CHẠY từ /brand.json.
//
// Vì sao runtime (không phải build-time): mỗi VPS giữ public/brand.json + logo
// riêng (đã .gitignore), nên `git pull` không bao giờ đè lên màu/logo. Cùng một
// bản build chạy ở mọi VPS; chỉ swap file brand.json + logo là đổi nhận diện.
//
// Khóa màu trong brand.json → biến CSS tương ứng (khai báo mặc định ở index.css):
const COLOR_VAR = {
  brand:       '--brand',
  brandDark:   '--brand-dark',
  brandLight:  '--brand-light',
  brandPale:   '--brand-pale',
  accent:      '--accent',
  accent2:     '--accent-2',
  accentHover: '--accent-hover',
}

// Mặc định = TECAPRO (trùng giá trị mặc định trong CSS). Dùng khi thiếu brand.json.
const DEFAULT_BRAND = {
  name: 'TECAPRO',
  tagline: 'Chi nhánh Hà nội - Công ty TECAPRO',
  logo: '/brand/logo.png',
  favicon: null,           // icon tab; null → tự dùng logo. Đặt riêng nếu muốn icon khác logo.
  hero: null,              // ảnh lớn trang chủ khi chưa đăng nhập; null = dùng ảnh bundled
  colors: {},
}

let brand = DEFAULT_BRAND

// Đọc cấu hình hiện tại (đã nạp). Header/login... gọi để lấy logo + tên.
export function getBrand() { return brand }

// Gắn màu thương hiệu lên :root để toàn bộ CSS dùng var(--brand...) đổi theo.
function applyColors(colors = {}) {
  const root = document.documentElement
  for (const [key, value] of Object.entries(colors)) {
    const cssVar = COLOR_VAR[key]
    if (cssVar && value) root.style.setProperty(cssVar, value)
  }
}

// Đặt icon tab trình duyệt (tái dùng thẻ <link rel="icon"> có sẵn, tạo nếu thiếu).
// Phải đặt đúng `type` theo đuôi file, nếu không type cũ (vd image/svg+xml) lệch
// với href .png sẽ khiến trình duyệt bỏ qua, giữ nguyên icon cũ.
const FAVICON_TYPE = { svg: 'image/svg+xml', png: 'image/png', ico: 'image/x-icon', jpg: 'image/jpeg', jpeg: 'image/jpeg' }
function applyFavicon(href) {
  if (!href) return
  let link = document.querySelector("link[rel~='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  const ext = href.split('?')[0].split('.').pop().toLowerCase()
  if (FAVICON_TYPE[ext]) link.type = FAVICON_TYPE[ext]
  else link.removeAttribute('type')
  link.href = href
}

// Nạp brand.json một lần khi khởi động (gọi trong main.jsx trước khi render).
// Lỗi/thiếu file → giữ mặc định, app vẫn chạy.
export async function loadBrand() {
  try {
    const res = await fetch('/brand.json', { cache: 'no-cache' })
    if (res.ok) brand = { ...DEFAULT_BRAND, ...(await res.json()) }
  } catch { /* không có brand.json → dùng mặc định */ }
  applyColors(brand.colors)
  applyFavicon(brand.favicon || brand.logo) // không khai báo favicon → dùng logo làm icon tab
  if (brand.name) document.title = brand.name
  return brand
}
