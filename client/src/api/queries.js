import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  authTelegram,
  banUser,
  blockUser,
  confirmPhoto,
  getAdminReports,
  getAdminUser,
  getAdminUsersByIp,
  getBrowse,
  getEvents,
  getKeywords,
  getMatchProfile,
  getMatches,
  getMe,
  getPendingPhotos,
  getTicket,
  likeUser,
  passUser,
  photoUploadSignature,
  reportUser,
  resolveReport,
  reviewPhoto,
  setVerificationLevel,
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
  matchProfile: (matchId) => ['match-profile', matchId],
  adminReports: (status) => ['admin', 'reports', status],
  adminPendingPhotos: ['admin', 'photos', 'pending'],
  adminUser: (userId) => ['admin', 'user', userId],
  ticket: ['events', 'ticket'],
  events: (ticket) => ['events', ticket],
}

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: getMe,
    staleTime: 30_000,
  })
}

export function useBrowse() {
  return useQuery({
    queryKey: queryKeys.browse,
    queryFn: getBrowse,
    staleTime: 15_000,
  })
}

export function useMatches() {
  return useQuery({
    queryKey: queryKeys.matches,
    queryFn: getMatches,
    staleTime: 15_000,
  })
}

export function useMatchProfile(matchId) {
  return useQuery({
    queryKey: queryKeys.matchProfile(matchId),
    queryFn: () => getMatchProfile(matchId),
    enabled: Boolean(matchId),
    staleTime: 30_000,
  })
}

export function useKeywords() {
  return useQuery({
    queryKey: queryKeys.keywords,
    queryFn: getKeywords,
    staleTime: 60 * 60 * 1000,
  })
}

export function useAdminReports(status) {
  return useQuery({
    queryKey: queryKeys.adminReports(status),
    queryFn: () => getAdminReports(status),
    staleTime: 20_000,
    enabled: Boolean(status),
  })
}

export function useAdminPendingPhotos() {
  return useQuery({
    queryKey: queryKeys.adminPendingPhotos,
    queryFn: getPendingPhotos,
    staleTime: 20_000,
  })
}

export function useAdminUser(userId) {
  return useQuery({
    queryKey: queryKeys.adminUser(userId),
    queryFn: () => getAdminUser(userId),
    staleTime: 20_000,
    enabled: Boolean(userId),
  })
}

export function useTicket() {
  return useMutation({
    mutationFn: ({ matchId }) => getTicket(matchId),
  })
}

export function useMatchEvents(ticket) {
  return useQuery({
    queryKey: queryKeys.events(ticket),
    queryFn: getEvents,
    staleTime: 0,
    enabled: Boolean(ticket),
  })
}

export function useTelegramLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: authTelegram,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
    },
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
    },
  })
}

export function useUpdateKeywords() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateKeywords,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
      if (variables && variables.matchId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.matchProfile(variables.matchId) })
      }
    },
  })
}

export function usePhotoUploadSignature() {
  return useMutation({
    mutationFn: photoUploadSignature,
  })
}

export function useConfirmPhoto() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: confirmPhoto,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
    },
  })
}

export function useLikeUser() {
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

export function usePassUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: passUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.browse })
    },
  })
}

export function useShareContact() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ matchId }) => shareContact(matchId),
    onSuccess: (_data, { matchId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches })
      queryClient.invalidateQueries({ queryKey: queryKeys.matchProfile(matchId) })
    },
  })
}

export function useUnmatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ match_id }) => unmatch({ match_id }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.matches })
      queryClient.invalidateQueries({ queryKey: queryKeys.matchProfile(variables.match_id) })
    },
  })
}

export function useBlockUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: blockUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.browse })
      queryClient.invalidateQueries({ queryKey: queryKeys.matches })
    },
  })
}

export function useReportUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: reportUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminReports('open') })
    },
  })
}
