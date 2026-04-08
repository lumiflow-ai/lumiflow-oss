import { useCallback, useEffect, useMemo, useState } from "react";

const DEFAULT_ITEMS_PER_PAGE = 20;

type UsePaginationOptions<T> = {
  items: T[];
  isLoading?: boolean;
  itemsPerPage?: number;
  initialPage?: number;
};

type UsePaginationResult<T> = {
  page: number;
  totalPages: number;
  paginatedItems: T[];
  goToPage: (page: number) => void;
};

export function usePagination<T>({
  items,
  isLoading = false,
  itemsPerPage = DEFAULT_ITEMS_PER_PAGE,
  initialPage = 1,
}: UsePaginationOptions<T>): UsePaginationResult<T> {
  const [page, setPage] = useState(initialPage);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(items.length / itemsPerPage)), [items.length, itemsPerPage]);

  useEffect(() => {
    if (isLoading) return;
    if (page < 1) {
      setPage(1);
      return;
    }
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [isLoading, page, totalPages]);

  const paginatedItems = useMemo(() => {
    if (items.length === 0) return [];
    const startIndex = (page - 1) * itemsPerPage;
    return items.slice(startIndex, startIndex + itemsPerPage);
  }, [items, page, itemsPerPage]);

  const goToPage = useCallback(
    (nextPage: number) => {
      if (isLoading) return;
      setPage((currentPage) => {
        if (!Number.isFinite(nextPage)) return currentPage;
        if (nextPage < 1) return 1;
        if (nextPage > totalPages) return totalPages;
        return nextPage;
      });
    },
    [isLoading, totalPages],
  );

  return useMemo(() => ({ page, totalPages, paginatedItems, goToPage }), [page, totalPages, paginatedItems, goToPage]);
}
