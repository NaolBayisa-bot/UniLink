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
