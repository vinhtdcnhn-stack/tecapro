import Modal from '../common/Modal'
import './ContractBOQTab.css'
import { fmtNum, calcAmounts } from './boqUtils'

// Số lượng KHÔNG làm tròn theo tiền tệ (có thể là số lẻ, vd 2,5).
const fmtQty = (n) => { const num = parseFloat(n) || 0; return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: num % 1 !== 0 ? 2 : 0, maximumFractionDigits: 4 }).format(num) }

export default function BOQImportModal({ importData, importMode, importSaving, currency = 'VND', onModeChange, onConfirm, onClose }) {
  return (
    <Modal onClose={onClose} contentClassName="boq-import-modal" labelledBy="boq-import-title">

        <div className="boq-import-header">
          <div>
            <h3 id="boq-import-title">Preview dữ liệu Excel</h3>
            <p className="boq-import-count">{importData.total} dòng dữ liệu</p>
          </div>
          <button className="btn-close-preview" onClick={onClose} aria-label="Đóng">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <div className="boq-import-mode">
          <label>
            <input type="radio" value="append" checked={importMode === 'append'} onChange={() => onModeChange('append')} />
            Thêm vào cuối danh sách hiện có
          </label>
          <label>
            <input type="radio" value="replace" checked={importMode === 'replace'} onChange={() => onModeChange('replace')} />
            <span className="replace-warn">Xóa toàn bộ và nhập mới</span>
          </label>
        </div>

        <div className="boq-import-hint">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
          Định dạng cột Excel: A=Danh mục · B=HScode · C=ĐVT · D=Số lượng · E=Đơn giá · F=VAT(%) · G=Thời hạn bảo hành
        </div>

        <div className="boq-import-preview">
          <table className="boq-table">
            <thead>
              <tr>
                <th className="th-stt">#</th>
                <th className="th-name">Danh mục hàng hóa</th>
                <th className="th-hs">HScode</th>
                <th className="th-unit">ĐVT</th>
                <th className="th-num">Số lượng</th>
                <th className="th-num">Đơn giá</th>
                <th className="th-amt">Trước VAT</th>
                <th className="th-vat">VAT%</th>
                <th className="th-amt">Sau VAT</th>
                <th className="th-warranty">Bảo hành</th>
              </tr>
            </thead>
            <tbody>
              {importData.items.map((item, idx) => {
                const { before, after } = calcAmounts(item.quantity, item.unit_price, item.vat_rate, currency)
                return (
                  <tr key={idx}>
                    <td className="td-stt"><span className="stt-num">{idx + 1}</span></td>
                    <td className="td-name"><span className="preview-text">{item.item_name}</span></td>
                    <td className="td-hs"><span className="preview-text">{item.hs_code}</span></td>
                    <td className="td-unit"><span className="preview-text">{item.unit}</span></td>
                    <td className="td-num"><span className="preview-text">{fmtQty(item.quantity)}</span></td>
                    <td className="td-num"><span className="preview-text">{fmtNum(item.unit_price, currency)}</span></td>
                    <td className="td-amt computed">{fmtNum(before, currency)}</td>
                    <td className="td-vat"><span className="preview-text">{item.vat_rate}%</span></td>
                    <td className="td-amt computed">{fmtNum(after, currency)}</td>
                    <td className="td-warranty"><span className="preview-text">{item.warranty_period}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="boq-import-footer">
          <button className="btn-cancel" onClick={onClose}>Hủy</button>
          <button className="btn-confirm" onClick={onConfirm} disabled={importSaving}>
            {importSaving ? 'Đang lưu...' : `Xác nhận nhập ${importData.total} dòng`}
          </button>
        </div>
    </Modal>
  )
}
