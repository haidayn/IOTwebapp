/**
 * Pagination — Component phân trang
 * Props:
 *   page        {number}   - trang hiện tại (1-indexed)
 *   totalPages  {number}   - tổng số trang
 *   limit       {number}   - số hàng/trang hiện tại
 *   onPageChange    {function(page)}
 *   onLimitChange   {function(limit)}
 */
const LIMIT_OPTIONS = [10, 25, 50];

export default function Pagination({ page, totalPages, limit, onPageChange, onLimitChange }) {
  // Tạo danh sách trang hiển thị: luôn hiện trang đầu, cuối, xung quanh trang hiện tại
  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = new Set([1, totalPages]);
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.add(i);
    const sorted = [...pages].sort((a, b) => a - b);
    const result = [];
    let prev = 0;
    for (const p of sorted) {
      if (p - prev > 1) result.push('...');
      result.push(p);
      prev = p;
    }
    return result;
  };

  return (
    <div className="pagination">
      <span>Rows per page:</span>
      <select
        value={limit}
        onChange={e => onLimitChange(Number(e.target.value))}
      >
        {LIMIT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
      </select>

      <div className="page-nav">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          ‹
        </button>

        {getPageNumbers().map((p, i) =>
          p === '...'
            ? <span key={`ellipsis-${i}`}>…</span>
            : (
              <button
                key={p}
                className={p === page ? 'active' : ''}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            )
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    </div>
  );
}
