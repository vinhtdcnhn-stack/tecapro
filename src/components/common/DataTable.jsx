export default function DataTable({ title, columns, data, emptyMessage = 'Chưa có dữ liệu.', headerActions = null }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
        <h2 className="section-title">{title}</h2>
        {headerActions}
      </div>
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
                <tr key={item.id}>
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
