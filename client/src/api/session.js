let currentToken = null
const listeners = new Set()

export function getToken() {
  return currentToken
}

export function setToken(token) {
  currentToken = token
  listeners.forEach((listener) => listener(currentToken))
}

export function clearToken() {
  currentToken = null
  listeners.forEach((listener) => listener(currentToken))
}

export function subscribeToToken(listener) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}
