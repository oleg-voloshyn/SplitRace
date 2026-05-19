import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

// ---- Query key factory --------------------------------------------------
// Centralising keys keeps invalidation precise — when a screen invalidates a
// branch (e.g. `tournaments.mine()`), the array shape stays canonical.

const keys = {
  me: () => ['me'],
  tournaments: {
    list: () => ['tournaments', 'list'],
    mine: () => ['tournaments', 'mine'],
    detail: (slug) => ['tournaments', 'detail', slug],
    leaderboard: (slug, gender) => ['tournaments', 'leaderboard', slug, gender ?? null]
  },
  notifications: () => ['notifications'],
  activities: () => ['activities'],
  segments: {
    mine: () => ['segments', 'mine'],
    detail: (id) => ['segments', 'detail', id]
  }
};

// ---- Helpers for paginated endpoints -----------------------------------

function infiniteListQuery(queryKey, fetcher, opts = {}) {
  return {
    queryKey,
    queryFn: ({ pageParam = 1 }) => fetcher(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage?.pagy?.next ?? undefined,
    ...opts
  };
}

function flattenItems(data) {
  return data?.pages.flatMap((page) => page.items ?? []) ?? [];
}

function topLevelMeta(data, key) {
  return data?.pages[0]?.[key];
}

// ---- Queries ------------------------------------------------------------

function useMe(options = {}) {
  return useQuery({ queryKey: keys.me(), queryFn: api.me, ...options });
}

function useTournaments() {
  const query = useInfiniteQuery(infiniteListQuery(keys.tournaments.list(), api.tournaments));
  return { ...query, items: flattenItems(query.data) };
}

function useMyTournaments() {
  const query = useInfiniteQuery(infiniteListQuery(keys.tournaments.mine(), api.myTournaments));
  return { ...query, items: flattenItems(query.data) };
}

function useTournament(slug, options = {}) {
  return useQuery({
    queryKey: keys.tournaments.detail(slug),
    queryFn: () => api.tournament(slug),
    enabled: Boolean(slug),
    ...options
  });
}

function useLeaderboard(slug, { gender } = {}) {
  const query = useInfiniteQuery(
    infiniteListQuery(keys.tournaments.leaderboard(slug, gender), (page) => api.leaderboard(slug, page), {
      enabled: Boolean(slug)
    })
  );
  return { ...query, items: flattenItems(query.data) };
}

function useNotifications() {
  const query = useInfiniteQuery(infiniteListQuery(keys.notifications(), api.notifications));
  return {
    ...query,
    items: flattenItems(query.data),
    unreadCount: topLevelMeta(query.data, 'unread_count') ?? 0
  };
}

function useActivities() {
  const query = useInfiniteQuery(infiniteListQuery(keys.activities(), api.activities));
  return { ...query, items: flattenItems(query.data) };
}

function useMySegments(options = {}) {
  return useQuery({ queryKey: keys.segments.mine(), queryFn: api.mySegments, ...options });
}

function useSegment(id, options = {}) {
  return useQuery({
    queryKey: keys.segments.detail(id),
    queryFn: () => api.segment(id),
    enabled: Boolean(id),
    ...options
  });
}

// ---- Mutations ---------------------------------------------------------
// Each mutation declares which query branches it invalidates so callers
// don't have to remember which lists to refetch.

function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateMe,
    onSuccess: (user) => qc.setQueryData(keys.me(), user)
  });
}

function useCreateTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createTournament,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.tournaments.mine() })
  });
}

function useUpdateTournament(slug) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params) => api.updateTournament(slug, params),
    onSuccess: (updated) => {
      qc.setQueryData(keys.tournaments.detail(slug), updated);
      qc.invalidateQueries({ queryKey: keys.tournaments.mine() });
    }
  });
}

function useDeleteTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug) => api.deleteTournament(slug),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.tournaments.mine() })
  });
}

function useJoinTournament(slug) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.joinTournament(slug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.tournaments.detail(slug) });
      qc.invalidateQueries({ queryKey: keys.tournaments.list() });
    }
  });
}

function useSubmitTournamentForReview(slug) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.submitTournamentForReview(slug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.tournaments.detail(slug) });
      qc.invalidateQueries({ queryKey: keys.tournaments.mine() });
    }
  });
}

// Accepts `{ slug, ...params }` so callers can both reuse one hook per
// tournament AND drive a sequence of adds against a freshly-created slug
// (e.g. the new-tournament wizard).
function useAddTournamentSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, ...params }) => api.addTournamentSegment(slug, params),
    onSuccess: (updated, { slug }) => qc.setQueryData(keys.tournaments.detail(slug), updated)
  });
}

function useRemoveTournamentSegment(slug) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (segmentId) => api.removeTournamentSegment(slug, segmentId),
    onSuccess: (updated) => qc.setQueryData(keys.tournaments.detail(slug), updated)
  });
}

function useCreateSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createSegment,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.segments.mine() })
  });
}

function useSaveActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.saveActivity,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.activities() })
  });
}

function useReadAllNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.readAllNotifications,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications() })
  });
}

function useReportCheating() {
  return useMutation({ mutationFn: api.reportCheating });
}

export {
  flattenItems,
  keys,
  useActivities,
  useAddTournamentSegment,
  useCreateSegment,
  useCreateTournament,
  useDeleteTournament,
  useJoinTournament,
  useLeaderboard,
  useMe,
  useMySegments,
  useMyTournaments,
  useNotifications,
  useReadAllNotifications,
  useRemoveTournamentSegment,
  useReportCheating,
  useSaveActivity,
  useSegment,
  useSubmitTournamentForReview,
  useTournament,
  useTournaments,
  useUpdateMe,
  useUpdateTournament
};
