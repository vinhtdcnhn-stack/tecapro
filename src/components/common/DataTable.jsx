export default function DataTable({ title, columns, data, emptyMessage = 'Chưa có dữ liệu.' }) {
  return (
    <>
      <h2 className="section-title">{title}</h2>
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
    </>
  )
}
