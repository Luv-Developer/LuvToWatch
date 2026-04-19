export function createRoomKey() {
  const random = crypto.getRandomValues(new Uint32Array(2))
  return `${random[0].toString(36)}-${random[1].toString(36)}`.slice(0, 16)
}

export function getGuestIdentity(roomKey) {
  const storageKey = `guest:${roomKey}`
  const existing = window.localStorage.getItem(storageKey)
  if (existing) {
    return JSON.parse(existing)
  }

  const guest = {
    id: `guest-${crypto.randomUUID()}`,
    name: `Guest-${Math.floor(Math.random() * 900 + 100)}`,
  }
  window.localStorage.setItem(storageKey, JSON.stringify(guest))
  return guest
}
