export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  for (let i = 1; i <= totalPages; i += 1) pages.push(i);

  return (
    <div className="pagination-wrap">
      <button className="btn btn-ghost" type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        {'<<'}
      </button>

      {pages.map((p) => (
        <button
          key={p}
          className={`btn btn-ghost ${p === page ? 'is-current-page' : ''}`}
          type="button"
          onClick={() => onPageChange(p)}
        >
          {p}
        </button>
      ))}

      <button className="btn btn-ghost" type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        {'>>'}
      </button>
    </div>
  );
}
