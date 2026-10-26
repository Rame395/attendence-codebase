// Reusable pagination footer with page-size selector
import { ChevronLeft, ChevronRight } from "lucide-react";

interface IPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  itemName: string;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 15, 25, 50];

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  itemName,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageSizeChange,
}: IPaginationProps) {
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);

  // page buttons: all when few, window around current when many
  const pageNums: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNums.push(i);
  } else {
    pageNums.push(1);
    if (safePage > 3) pageNums.push("...");
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pageNums.push(i);
    if (safePage < totalPages - 2) pageNums.push("...");
    pageNums.push(totalPages);
  }

  const handlePageSizeChange = (n: number) => {
    onPageSizeChange?.(n);
    onPageChange(1);
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-slate-100">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-xs text-slate-400">
          Showing {start + 1}–{end} of {total} {itemName}
        </p>
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            Show
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="border border-border rounded-lg px-2 py-1 bg-white text-xs outline-none focus:border-primary"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            per page
          </label>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage === 1}
            aria-label="Previous page"
            className="p-2 rounded-lg border border-border text-slate-500 hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <ChevronLeft size={14} />
          </button>
          {pageNums.map((p, i) =>
            p === "..." ? (
              <span key={`e${i}`} className="px-1 text-xs text-slate-400">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`min-w-8 h-8 px-2 rounded-lg text-xs font-bold transition-colors ${p === safePage ? "bg-primary text-white" : "border border-border text-slate-500 hover:border-primary hover:text-primary"}`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage === totalPages}
            aria-label="Next page"
            className="p-2 rounded-lg border border-border text-slate-500 hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}