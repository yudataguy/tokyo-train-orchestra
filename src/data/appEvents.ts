/**
 * Shared event map for the app's single EventBus. Centralizing it means
 * every service references the same type, so passing a bus that knows
 * about `flight-batch` to a service that only emits `arrival`/`error`
 * type-checks cleanly (EventBus<T> is invariant in T, so the types must
 * match exactly).
 */
import type { ArrivalEvent } from '../types';

export type AppEvents = {
  arrival: ArrivalEvent;
  error: { message: string };
};
