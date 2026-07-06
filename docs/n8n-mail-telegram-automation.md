# Tự động 8h sáng: Tóm tắt mail → gửi Telegram (qua n8n)

Hướng dẫn dựng một workflow n8n chạy **8h sáng mỗi ngày**, đọc email Gmail của bạn
trong 24h qua, nhờ **Claude (Anthropic)** tóm tắt, rồi gửi bản tin về **Telegram**
(dùng lại chính con bot mà app QLDA đang dùng).

> Làm dần theo thứ tự. Mỗi phần đánh dấu ✅ khi xong. Không cần biết code.

---

## 0. Bức tranh tổng thể

Workflow gồm 5 node nối tiếp:

```
[8h sáng mỗi ngày]  →  [Lấy mail 24h qua]  →  [Gộp tất cả mail]  →  [Claude tóm tắt]  →  [Gửi Telegram]
   Schedule Trigger        Gmail                Aggregate            LLM Chain            Telegram
                                                                          ▲
                                                                  [Anthropic Chat Model]
```

- **Schedule Trigger**: hẹn giờ chạy 8h sáng.
- **Gmail**: lấy các email đến trong 24h qua.
- **Aggregate**: gộp nhiều email thành 1 khối dữ liệu để hỏi Claude 1 lần.
- **Claude tóm tắt** (+ Anthropic Chat Model): viết bản tin sáng.
- **Telegram**: gửi bản tin cho bạn.

---

## 1. Chuẩn bị 3 thông tin đăng nhập (credentials)

n8n cần bạn nối 3 thứ. Chuẩn bị trước rồi mới dựng node cho nhanh.

### 1.1. Gmail (đọc mail của bạn) ✅

1. Vào n8n → menu bên trái chọn **Credentials** → **Add Credential**.
2. Gõ tìm **Gmail OAuth2 API** → chọn.
3. Bấm **Sign in with Google** → đăng nhập bằng tài khoản `vinhtd.cnhn@gmail.com`.
4. Cho phép quyền đọc Gmail → quay lại n8n thấy "Connected" → **Save**.

> Nếu nút Google báo lỗi redirect: cần cấu hình OAuth trên Google Cloud Console
> (tạo OAuth client, thêm Authorized redirect URL mà n8n hiển thị). Đây là bước
> hay vướng nhất — nếu kẹt, nhắn lại để hướng dẫn riêng phần Google Cloud.

### 1.2. Anthropic / Claude (tóm tắt) ✅

1. Vào `https://console.anthropic.com` → **API Keys** → **Create Key** → copy key
   (dạng `sk-ant-...`). Lưu ý nạp một ít credit để dùng.
2. Trong n8n → **Credentials** → **Add Credential** → tìm **Anthropic API** → dán key → **Save**.

> ⚠️ Gói n8n Pro $20 **KHÔNG** thay được API key này. Bắt buộc có key riêng ở trên.
> Mỗi ngày chỉ 1 lần tóm tắt nên chi phí rất nhỏ (dùng model rẻ như Haiku càng rẻ).

### 1.3. Telegram (gửi tin — dùng lại bot của app) ✅

Không tạo bot mới. Dùng chính con bot mà app QLDA đang gửi thông báo.

| Thứ cần | Giá trị |
|---|---|
| **Bot token** | lấy từ biến `TELEGRAM_BOT_TOKEN` trong file `.env` của app (trên VPS hoặc local) |
| **Chat ID của bạn** | `960340163` |

1. Trong n8n → **Credentials** → **Add Credential** → tìm **Telegram API**.
2. Dán **Access Token** = giá trị `TELEGRAM_BOT_TOKEN` của app → **Save**.

> ⚠️ Chỉ **đọc** token, tuyệt đối **không revoke / không đổi** token bên BotFather —
> app đang dùng chung, đổi là app mất khả năng gửi thông báo.
> Bot đã từng nhắn cho bạn nên chắc chắn gửi tới `960340163` được, không cần "start" lại.

---

## 2. Tạo workflow bằng cách import (nhanh nhất) ✅

1. Ở màn hình n8n bấm **+** (tạo workflow mới) hoặc menu **⋮** góc phải trên.
2. Chọn **Import from clipboard** (hoặc **Import from File**).
3. Dán nguyên đoạn JSON trong [Phụ lục A](#phụ-lục-a--workflow-json-để-import) ở cuối file này.
4. Workflow hiện ra đủ 5 node như sơ đồ ở mục 0.

> Nếu import lỗi vì lệch phiên bản n8n: bỏ qua, làm theo **Mục 3 (dựng tay)**.

---

## 3. (Phương án B) Dựng tay từng node

Chỉ làm mục này nếu import ở Mục 2 không được. Bấm **+** trên canvas để thêm từng node.

1. **Schedule Trigger** — tìm "Schedule Trigger".
2. **Gmail** — tìm "Gmail" → chọn resource *Message*, operation *Get Many*.
3. **Aggregate** — tìm "Aggregate".
4. **Basic LLM Chain** — tìm "Basic LLM Chain".
5. **Anthropic Chat Model** — tìm "Anthropic Chat Model" (đây là "model" cắm vào chain).
6. **Telegram** — tìm "Telegram" → operation *Send Message*.

Nối dây theo sơ đồ: Schedule → Gmail → Aggregate → Basic LLM Chain → Telegram.
Riêng **Anthropic Chat Model** kéo dây từ ô tròn dưới đáy nó lên cổng
**Model** của Basic LLM Chain.

---

## 4. Cấu hình từng node

### 4.1. Node "8h sáng mỗi ngày" (Schedule Trigger) ✅

- **Trigger Rules**: chọn kiểu **Cron / Cron Expression**.
- Expression: `0 8 * * *`  (= 8h00 mỗi ngày).
- ⚠️ Kiểm tra **múi giờ** (xem Mục 6) để "8h" là giờ Việt Nam.

### 4.2. Node "Lấy mail 24h qua" (Gmail) ✅

- **Credential**: chọn Gmail đã nối ở 1.1.
- **Resource**: Message → **Operation**: Get Many.
- **Return All**: bật (ON).
- **Simplify**: bật (ON) — trả về gọn (tiêu đề, người gửi, snippet).
- Mở **Filters** → **Search**: nhập `newer_than:1d in:inbox`
  - `newer_than:1d` = trong 1 ngày qua.
  - `in:inbox` = chỉ hộp thư đến.
  - Muốn chỉ mail chưa đọc thì thêm: `is:unread`.

### 4.3. Node "Gộp tất cả mail" (Aggregate) ✅

- **Aggregate**: chọn **Aggregate All Item Data** (gộp mọi email thành 1 mục,
  nằm trong trường `data`).

### 4.4. Node "Anthropic Chat Model" ✅

- **Credential**: chọn Anthropic đã nối ở 1.2.
- **Model**: chọn `claude-haiku-4-5` (rẻ, đủ dùng) hoặc `claude-sonnet-5` (tóm tắt sắc hơn).

### 4.5. Node "Claude tóm tắt" (Basic LLM Chain) ✅

- **Prompt Type**: chọn **Define below** (tự nhập).
- **Text**: dán nguyên prompt trong [Phụ lục B](#phụ-lục-b--prompt-tóm-tắt).
  Giữ dấu `=` ở đầu để n8n hiểu đây là expression.

### 4.6. Node "Gửi Telegram" ✅

- **Credential**: chọn Telegram đã nối ở 1.3.
- **Resource**: Message → **Operation**: Send Message.
- **Chat ID**: `960340163`
- **Text**: bật chế độ expression (biểu tượng ⚙️/fx) rồi nhập: `{{ $json.text }}`
  (đây là kết quả Claude trả về).
- **Additional Fields** → **Parse Mode**: để **trống / None** (bản tin là chữ thường,
  để trống là an toàn nhất, tránh lỗi khi có ký tự `<` `&`).

---

## 5. Chạy thử ✅

1. Bấm **Execute Workflow** (góc dưới, không cần chờ 8h sáng).
2. Xem từng node sáng xanh = chạy ok. Node nào đỏ → bấm vào đọc lỗi (xem Mục 7).
3. Kiểm tra **Telegram** của bạn — bản tin sáng phải hiện lên trong khung chat với bot.
4. Chưa ưng nội dung? Chỉnh lại prompt ở node "Claude tóm tắt" rồi chạy thử lại.

---

## 6. Bật lịch tự chạy + Múi giờ ✅

1. **Múi giờ**: mở **Settings** của workflow (menu ⋮) → **Timezone** → chọn
   **Asia/Ho_Chi_Minh**. (Hoặc đặt biến môi trường `GENERIC_TIMEZONE=Asia/Ho_Chi_Minh`
   cho cả n8n trên VPS.) Nếu bỏ qua, "8h" sẽ tính theo giờ UTC → lệch 7 tiếng.
2. Gạt công tắc **Active** (góc phải trên) sang ON → từ mai, 8h sáng workflow tự chạy.
3. Đặt tên workflow cho dễ tìm, ví dụ: *"8h sáng - Tóm tắt mail gửi Telegram"*.

---

## 7. Sự cố thường gặp

| Hiện tượng | Nguyên nhân & cách xử lý |
|---|---|
| Node Gmail đỏ, báo auth | Credential Gmail hết hạn / chưa cấp đủ quyền → nối lại ở 1.1. |
| Node Claude báo lỗi model / 401 | API key sai hoặc hết credit → kiểm tra key + nạp credit ở console.anthropic.com. |
| Node Claude lỗi module langchain | Trên VPS này node Anthropic chạy nhờ **bản vá langchain core 1.1.41→1.2.1**. Nếu vừa `npm update`/cài lại n8n thì lỗi tái phát → phải vá lại đúng chỗ đó. |
| Telegram báo "chat not found" | Sai chat_id, hoặc bot chưa từng nhắn cho bạn → dùng đúng `960340163`. |
| Telegram lỗi "can't parse entities" | Do bật Parse Mode HTML/Markdown mà text có ký tự lạ → để Parse Mode **trống**. |
| Bản tin trống / thiếu nội dung | Gmail đang `Simplify` chỉ trả snippet ngắn. Muốn chi tiết hơn: tắt Simplify / lấy full body (tốn token hơn) — nhắn để chỉnh. |
| "8h" chạy sai giờ | Chưa đặt Timezone = Asia/Ho_Chi_Minh (Mục 6). |

---

## Phụ lục A — Workflow JSON để import

```json
{
  "name": "8h sáng - Tóm tắt mail gửi Telegram",
  "nodes": [
    {
      "parameters": {
        "rule": { "interval": [ { "field": "cronExpression", "expression": "0 8 * * *" } ] }
      },
      "id": "sched",
      "name": "8h sáng mỗi ngày",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [0, 300]
    },
    {
      "parameters": {
        "operation": "getAll",
        "returnAll": true,
        "simple": true,
        "filters": { "q": "newer_than:1d in:inbox" },
        "options": {}
      },
      "id": "gmail",
      "name": "Lấy mail 24h qua",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [240, 300]
    },
    {
      "parameters": { "aggregate": "aggregateAllItemData", "options": {} },
      "id": "agg",
      "name": "Gộp tất cả mail",
      "type": "n8n-nodes-base.aggregate",
      "typeVersion": 1,
      "position": [480, 300]
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "=Hôm nay là {{ $now.setZone('Asia/Ho_Chi_Minh').toFormat('dd/MM/yyyy') }}. Bạn là trợ lý lọc và tóm tắt hộp thư đến của tôi.\n\nDưới đây là các email tôi nhận trong 24h qua (JSON). Hãy đọc và viết một BẢN TIN SÁNG bằng tiếng Việt, ngắn gọn, để đọc nhanh trên điện thoại.\n\nQUY TẮC:\n- Nếu không có email nào: chỉ trả về đúng một dòng \"✅ Không có email mới trong 24h qua.\" rồi dừng.\n- Bỏ qua/gộp gọn thư rác, quảng cáo, newsletter, thông báo tự động (đăng nhập, hóa đơn dịch vụ định kỳ...). Đừng để chúng chiếm chỗ.\n- Ưu tiên thư từ người thật, có yêu cầu hoặc liên quan công việc.\n- Tuyệt đối KHÔNG bịa. Nếu không rõ nội dung, ghi \"nội dung chưa rõ\".\n- Viết văn xuôi thuần + emoji, KHÔNG dùng dấu ** hay markdown (Telegram không hiển thị).\n\nĐỊNH DẠNG TRẢ VỀ:\n📬 BẢN TIN SÁNG {{ $now.setZone('Asia/Ho_Chi_Minh').toFormat('dd/MM/yyyy') }}\nTổng: <số> email mới.\n\n🔴 CẦN XỬ LÝ (có yêu cầu/hạn chót/chờ mình trả lời)\n- [Người gửi] Tiêu đề — tóm tắt 1 câu. 👉 Việc cần làm + hạn (nếu có).\n(nếu không có mục nào thì ghi: không có)\n\n🟡 CẦN NẮM (thông tin, cập nhật, không phải làm ngay)\n- [Người gửi] Tiêu đề — tóm tắt 1 câu.\n\n⚪ KHÁC (quảng cáo/tự động): gộp thành 1 dòng, ví dụ \"3 thư quảng cáo, 2 thông báo hệ thống.\"\n\nDữ liệu email:\n{{ JSON.stringify($json.data) }}"
      },
      "id": "llm",
      "name": "Claude tóm tắt",
      "type": "@n8n/n8n-nodes-langchain.chainLlm",
      "typeVersion": 1.5,
      "position": [720, 300]
    },
    {
      "parameters": { "options": {} },
      "id": "claude",
      "name": "Anthropic Chat Model",
      "type": "@n8n/n8n-nodes-langchain.lmChatAnthropic",
      "typeVersion": 1.3,
      "position": [720, 500]
    },
    {
      "parameters": {
        "chatId": "960340163",
        "text": "={{ $json.text }}",
        "additionalFields": {}
      },
      "id": "tg",
      "name": "Gửi Telegram",
      "type": "n8n-nodes-base.telegram",
      "typeVersion": 1.2,
      "position": [1000, 300]
    }
  ],
  "connections": {
    "8h sáng mỗi ngày": { "main": [ [ { "node": "Lấy mail 24h qua", "type": "main", "index": 0 } ] ] },
    "Lấy mail 24h qua": { "main": [ [ { "node": "Gộp tất cả mail", "type": "main", "index": 0 } ] ] },
    "Gộp tất cả mail": { "main": [ [ { "node": "Claude tóm tắt", "type": "main", "index": 0 } ] ] },
    "Anthropic Chat Model": { "ai_languageModel": [ [ { "node": "Claude tóm tắt", "type": "ai_languageModel", "index": 0 } ] ] },
    "Claude tóm tắt": { "main": [ [ { "node": "Gửi Telegram", "type": "main", "index": 0 } ] ] }
  }
}
```

> Sau khi import vẫn phải tự **chọn lại 3 credential** (Gmail, Anthropic, Telegram) ở
> từng node — n8n không nhúng credential vào JSON vì lý do bảo mật.

---

## Phụ lục B — Prompt tóm tắt

Dán vào ô **Text** của node "Claude tóm tắt" (giữ dấu `=` đầu dòng):

```
=Hôm nay là {{ $now.setZone('Asia/Ho_Chi_Minh').toFormat('dd/MM/yyyy') }}. Bạn là trợ lý lọc và tóm tắt hộp thư đến của tôi.

Dưới đây là các email tôi nhận trong 24h qua (JSON). Hãy đọc và viết một BẢN TIN SÁNG bằng tiếng Việt, ngắn gọn, để đọc nhanh trên điện thoại.

QUY TẮC:
- Nếu không có email nào: chỉ trả về đúng một dòng "✅ Không có email mới trong 24h qua." rồi dừng.
- Bỏ qua/gộp gọn thư rác, quảng cáo, newsletter, thông báo tự động (đăng nhập, hóa đơn dịch vụ định kỳ...). Đừng để chúng chiếm chỗ.
- Ưu tiên thư từ người thật, có yêu cầu hoặc liên quan công việc.
- Tuyệt đối KHÔNG bịa. Nếu không rõ nội dung, ghi "nội dung chưa rõ".
- Viết văn xuôi thuần + emoji, KHÔNG dùng dấu ** hay markdown (Telegram không hiển thị).

ĐỊNH DẠNG TRẢ VỀ:
📬 BẢN TIN SÁNG {{ $now.setZone('Asia/Ho_Chi_Minh').toFormat('dd/MM/yyyy') }}
Tổng: <số> email mới.

🔴 CẦN XỬ LÝ (có yêu cầu/hạn chót/chờ mình trả lời)
- [Người gửi] Tiêu đề — tóm tắt 1 câu. 👉 Việc cần làm + hạn (nếu có).
(nếu không có mục nào thì ghi: không có)

🟡 CẦN NẮM (thông tin, cập nhật, không phải làm ngay)
- [Người gửi] Tiêu đề — tóm tắt 1 câu.

⚪ KHÁC (quảng cáo/tự động): gộp thành 1 dòng, ví dụ "3 thư quảng cáo, 2 thông báo hệ thống."

Dữ liệu email:
{{ JSON.stringify($json.data) }}
```

---

## Nâng cấp về sau (tùy chọn)

- **Chỉ mail chưa đọc**: sửa Search node Gmail thành `newer_than:1d in:inbox is:unread`.
- **Tự đánh dấu đã đọc** sau khi tóm tắt: thêm node Gmail "Mark as Read".
- **Đọc full nội dung** thay vì snippet: tắt Simplify ở node Gmail (tốn token hơn).
- **Lọc người gửi quan trọng**: thêm điều kiện `from:sếp@...` hoặc gắn IF node.
- **Gửi kèm cả buổi chiều**: nhân đôi Schedule hoặc đổi cron `0 8,17 * * *`.
