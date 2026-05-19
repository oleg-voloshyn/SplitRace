import { useCallback, useEffect, useRef, useState } from 'react';

// Drives an infinite-scroll list against an API endpoint that returns
// `{ items, pagy: { next, ... } }`. Pass a memoized `fetchPage(page)`.
//
// Returns:
//   items         — accumulated items across pages (null while first load is pending)
//   meta          — extra top-level fields from the latest response (e.g. unread_count)
//   loading       — true until the first page resolves
//   loadingMore   — true while a subsequent page is being appended
//   refreshing    — true while pull-to-refresh is in flight
//   hasNext       — there's another page to load
//   onEndReached  — call when the list approaches the end
//   onRefresh     — call to reload from page 1
//   reload        — same as onRefresh but without the refreshing flag
function usePaginatedList(fetchPage, { autoLoad = true } = {}) {
  const [items, setItems] = useState(null);
  const [meta, setMeta] = useState({});
  const [nextPage, setNextPage] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  const loadPage = useCallback(
    async (page, mode) => {
      if (inFlight.current) {
        return;
      }
      inFlight.current = true;
      try {
        const data = await fetchPage(page);
        const { items: pageItems = [], pagy, ...rest } = data || {};
        setItems((prev) => (mode === 'append' && prev ? [...prev, ...pageItems] : pageItems));
        setNextPage(pagy?.next ?? null);
        setMeta(rest);
      } finally {
        inFlight.current = false;
      }
    },
    [fetchPage]
  );

  useEffect(() => {
    if (!autoLoad) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        await loadPage(1, 'replace');
      } catch {
        if (!cancelled) {
          setItems([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [autoLoad, loadPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPage(1, 'replace');
    } catch {
      // keep current items on failure
    } finally {
      setRefreshing(false);
    }
  }, [loadPage]);

  const onEndReached = useCallback(async () => {
    if (!nextPage || loadingMore || inFlight.current) {
      return;
    }
    setLoadingMore(true);
    try {
      await loadPage(nextPage, 'append');
    } catch {
      // ignore — user can retry by scrolling again
    } finally {
      setLoadingMore(false);
    }
  }, [nextPage, loadingMore, loadPage]);

  return {
    items,
    meta,
    loading: items === null,
    loadingMore,
    refreshing,
    hasNext: nextPage != null,
    onEndReached,
    onRefresh,
    reload: () => loadPage(1, 'replace')
  };
}

export { usePaginatedList };
