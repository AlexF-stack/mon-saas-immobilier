import { EventEmitter } from 'events'

type RealtimeListener = (payload: string) => void

declare global {
  // eslint-disable-next-line no-var
  var __antiRealtimeBus: EventEmitter | undefined
}

const realtimeBus = global.__antiRealtimeBus ?? new EventEmitter()
realtimeBus.setMaxListeners(0)
if (!global.__antiRealtimeBus) {
  global.__antiRealtimeBus = realtimeBus
}

function toEventName(channel: string) {
  return `realtime:${channel}`
}

export function publishRealtime(channel: string, payload: unknown) {
  realtimeBus.emit(toEventName(channel), JSON.stringify(payload ?? {}))
}

export function subscribeRealtime(channel: string, listener: RealtimeListener) {
  const eventName = toEventName(channel)
  realtimeBus.on(eventName, listener)
  return () => {
    realtimeBus.off(eventName, listener)
  }
}
