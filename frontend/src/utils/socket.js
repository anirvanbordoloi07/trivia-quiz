import { io } from 'socket.io-client'

const DEFAULT_LOCAL_SOCKET_URL = 'http://localhost:3001'
const DEFAULT_PRODUCTION_SOCKET_URL = 'https://trivia-quiz-backend-z9jo.onrender.com'

function resolveSocketUrl() {
  const configuredUrl = import.meta.env.VITE_SOCKET_URL?.trim()
  const isPlaceholder =
    !configuredUrl || configuredUrl.includes('YOUR-RENDER-BACKEND')

  if (!isPlaceholder) {
    return configuredUrl
  }

  return window.location.hostname === 'localhost'
    ? DEFAULT_LOCAL_SOCKET_URL
    : DEFAULT_PRODUCTION_SOCKET_URL
}

const SOCKET_URL = resolveSocketUrl()

let socket = null

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })
  }
  return socket
}

export function connectSocket() {
  const s = getSocket()
  if (!s.connected) {
    s.connect()
  }
  return s
}

export function disconnectSocket() {
  if (socket && socket.connected) {
    socket.disconnect()
  }
}

export default getSocket
