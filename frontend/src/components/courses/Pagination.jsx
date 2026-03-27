export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);

  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push('ellipsis-start');
  }

  for (let i = start; i <= end; i += 1) pages.push(i);

  if (end < totalPages) {
    if (end < totalPages - 1) pages.push('ellipsis-end');
    pages.push(totalPages);
  }

  return (
    <div className="pagination-wrap">
      <button className="btn btn-ghost" type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        {'<<'}
      </button>

      {pages.map((p) =>
        typeof p === 'string' ? (
          <span key={p} className="pagination-ellipsis">
            ...
          </span>
        ) : (
          <button
            key={p}
            className={`btn btn-ghost ${p === page ? 'is-current-page' : ''}`}
            type="button"
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        )
      )}

      <button className="btn btn-ghost" type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        {'>>'}
      </button>
    </div>
  );
}
