import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  blockUser,
  getBrowse,
  getKeywords,
  getMatchProfile,
  getMatches,
  getMe,
  likeUser,
  reportUser,
  shareContact,
  unmatch,
  updateKeywords,
  updateProfile,
} from './endpoints.js'

export const queryKeys = {
  me: ['me'],
  browse: ['browse'],
  matches: ['matches'],
  keywords: ['keywords'],
  match: (matchId) => ['match', matchId],
}

export function useMeQuery() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: getMe,
    staleTime: 30_000,
  })
}

export function useBrowseQuery() {
  return useQuery({
    queryKey: queryKeys.browse,
    queryFn: getBrowse,
    staleTime: 15_000,
  })
}

export function useMatchesQuery() {
  return useQuery({
    queryKey: queryKeys.matches,
    queryFn: getMatches,
    staleTime: 15_000,
  })
}

export function useKeywordsQuery() {
  return useQuery({
    queryKey: queryKeys.keywords,
    queryFn: getKeywords,
    staleTime: 60_000,
  })
}

export function useMatchProfileQuery(matchId) {
  return useQuery({
    queryKey: queryKeys.match(matchId),
    queryFn: () => getMatchProfile(matchId),
    enabled: Boolean(matchId),
    staleTime: 30_000,
  })
}

export function useProfileMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
    },
  })
}

export function useKeywordsMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateKeywords,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
    },
  })
}

export function useLikeMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: likeUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.browse })
      queryClient.invalidateQueries({ queryKey: queryKeys.matches })
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
    },
  })
}

export function useShareContactMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ matchId }) => shareContact(matchId),
    onSuccess: (_data, { matchId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches })
      queryClient.invalidateQueries({ queryKey: queryKeys.match(matchId) })
    },
  })
}

export function useUnmatchMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: unmatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches })
      queryClient.invalidateQueries({ queryKey: queryKeys.browse })
    },
  })
}

export function useBlockUserMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: blockUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.browse })
    },
  })
}

export function useReportMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: reportUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
    },
  })
}
