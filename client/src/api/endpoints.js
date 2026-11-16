import { apiFetch } from './client.js'

export function authTelegram(initData) {
  return apiFetch('/auth/telegram', {
    method: 'POST',
    body: { init_data: initData },
  })
}

export function getMe() {
  return apiFetch('/me')
}

export function updateProfile(payload) {
  return apiFetch('/profile', {
    method: 'POST',
    body: payload,
  })
}

export function getBrowse() {
  return apiFetch('/browse')
}

export function passUser(payload) {
  return apiFetch('/pass', {
    method: 'POST',
    body: payload,
  })
}

export function likeUser(payload) {
  return apiFetch('/like', {
    method: 'POST',
    body: payload,
  })
}

export function getMatches() {
  return apiFetch('/matches')
}

export function getMatchProfile(matchId) {
  return apiFetch(`/match/${matchId}/profile`)
}

export function shareContact(matchId) {
  return apiFetch(`/match/${matchId}/share-contact`, {
    method: 'POST',
  })
}

export function unmatch(payload) {
  return apiFetch('/unmatch', {
    method: 'POST',
    body: payload,
  })
}

export function blockUser(payload) {
  return apiFetch('/block', {
    method: 'POST',
    body: payload,
  })
}

export function reportUser(payload) {
  return apiFetch('/report', {
    method: 'POST',
    body: payload,
  })
}

export function getKeywords() {
  return apiFetch('/keywords')
}

export function updateKeywords(payload) {
  return apiFetch('/profile/keywords', {
    method: 'POST',
    body: payload,
  })
}

// Photo upload endpoints
export function photoUploadSignature() {
  return apiFetch('/photo/upload-signature', {
    method: 'POST',
  })
}

export function confirmPhoto(payload) {
  return apiFetch('/photo/confirm', {
    method: 'POST',
    body: payload,
  })
}

// Event endpoints
export function getTicket(matchId) {
  return apiFetch('/events/ticket', {
    method: 'POST',
    body: { match_id: matchId },
  })
}

export function getEvents() {
  return apiFetch('/events')
}

// Admin endpoints
export function getPendingPhotos() {
  return apiFetch('/admin/photos/pending')
}

export function reviewPhoto(payload) {
  return apiFetch('/admin/photos/review', {
    method: 'POST',
    body: payload,
  })
}

export function getAdminReports(status) {
  const url = status ? `/admin/reports?status=${encodeURIComponent(status)}` : '/admin/reports'
  return apiFetch(url)
}

export function resolveReport(payload) {
  return apiFetch('/admin/resolve-report', {
    method: 'POST',
    body: payload,
  })
}

export function banUser(payload) {
  return apiFetch('/admin/ban-user', {
    method: 'POST',
    body: payload,
  })
}

export function getAdminUser(userId) {
  return apiFetch(`/admin/users/${userId}`)
}

export function setVerificationLevel(payload) {
  return apiFetch('/admin/set-verification-level', {
    method: 'POST',
    body: payload,
  })
}

export function getAdminUsersByIp(signupIp) {
  return apiFetch(`/admin/users?signup_ip=${encodeURIComponent(signupIp)}`)
}
