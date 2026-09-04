import type { TopupTransaction } from './topup.service'

type TopupEventListener = (transaction: TopupTransaction) => void

const listenersByTopupId = new Map<string, Set<TopupEventListener>>()

export function subscribeToTopupEvents(
  topupId: string,
  listener: TopupEventListener,
): () => void {
  const listeners = listenersByTopupId.get(topupId) ?? new Set<TopupEventListener>()
  listeners.add(listener)
  listenersByTopupId.set(topupId, listeners)

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) listenersByTopupId.delete(topupId)
  }
}

export function publishTopupEvent(
  topupId: string,
  transaction: TopupTransaction,
): void {
  for (const listener of listenersByTopupId.get(topupId) ?? []) {
    try {
      listener(transaction)
    } catch {
      // A disconnected client must not make a successful webhook fail.
    }
  }
}
