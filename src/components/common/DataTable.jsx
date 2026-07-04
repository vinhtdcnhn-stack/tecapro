import useIsMobile from '../contracts/useIsMobile'
import MobileCardList from './MobileCardList'

export default function DataTable({ title, columns, data, emptyMessage = 'Chưa có dữ liệu.', headerActions = null, onRowDoubleClick = null }) {
  const isMobile = useIsMobile()

  const header = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
      <h2 className="section-title">{title}</h2>
      {headerActions}
    </div>
  )

  // Mobile: cột đầu làm tiêu đề thẻ, các cột còn lại (trừ cột thao tác) làm meta;
  // chạm thẻ để mở modal sửa (dùng lại onRowDoubleClick).
  if (isMobile) {
    const [titleCol, ...restCols] = columns
    const metaCols = restCols.filter(c => !/thao tác|hành động/i.test(c.header || ''))
    const cell = (col, item) => (col.render ? col.render(item) : (item[col.field] ?? '-'))
    return (
      <>
        {header}
        <MobileCardList
          items={data}
          onCardClick={onRowDoubleClick || undefined}
          emptyText={emptyMessage}
          title={(item) => cell(titleCol, item)}
          meta={(item) => metaCols.map((c, i) => (
            <span key={i}><strong style={{ fontWeight: 600, color: '#374151' }}>{c.header}:</strong> {cell(c, item)}</span>
          ))}
        />
      </>
    )
  }

  return (
    <>
      {header}
      <div className="table-wrapper">
        <table className="user-table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr
                  key={item.id}
                  onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(item) : undefined}
                  style={onRowDoubleClick ? { cursor: 'pointer' } : undefined}
                  title={onRowDoubleClick ? 'Nhấn đúp để sửa' : undefined}
                >
                  {columns.map((col, idx) => (
                    <td key={idx}>{col.render ? col.render(item) : item[col.field] || '-'}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
