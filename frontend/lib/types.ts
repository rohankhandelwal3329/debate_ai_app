/**
 * Shared UI types used across StudioPage and its sub-components.
 * Centralised here to avoid re-defining the same types in multiple files.
 */

export type Conn =
  | 'ready'
  | 'connecting'
  | 'connected'
  | 'recording'
  | 'processing'
  | 'speaking'
  | 'debate-over'
  | 'error';

export type VizState = 'active' | 'recording' | 'speaking' | null;

export type ChatMsg = { id: string; role: 'user' | 'ai'; text: string };
