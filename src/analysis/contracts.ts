import type { Region } from '../domain/regions';
export interface Frame { image: ImageData; timestampMs: number }
export interface Observation<T> { value: T | null; confidence: number }
/** Implementations must honor cancellation and never send pixels over the network. */
export interface ImageDetector<T> { detect(frame: Frame, signal: AbortSignal): Promise<Observation<T>> }
export interface FrameSource { read(region?: Region): Frame | null }
export interface StateTracker<T, S> { update(observation: Observation<T>, timestampMs: number): S; reset(): void }
export type YanusObservation = { seconds: number; iconPresent: boolean };
export type RuneObservation = { present: boolean };
