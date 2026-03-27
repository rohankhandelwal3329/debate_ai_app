function apiOrigin(): string {
  const explicit = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');
  if (explicit) return explicit;

  // Dev fallback: Next runs on :3000 while API runs on :8000.
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    const p = window.location.port;
    if ((h === 'localhost' || h === '127.0.0.1') && p === '3000') {
      return 'http://127.0.0.1:8000';
    }
  }
  return '';
}

async function parseError(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return (j.detail as string) || res.statusText || 'Request failed';
  } catch {
    return res.statusText || 'Request failed';
  }
}

export async function startDebate(userName: string, pantherId = '', email = '') {
  const origin = apiOrigin();
  const res = await fetch(`${origin}/api/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_name: userName,
      panther_id: pantherId,
      email,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{
    session_id: string;
    text: string;
    audio_base64: string;
    phase: string;
  }>;
}

export async function processTurn(
  sessionId: string,
  audioBase64: string | null,
  text: string | null
) {
  const origin = apiOrigin();
  const res = await fetch(`${origin}/api/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      audio_base64: audioBase64,
      text,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{
    text: string;
    audio_base64: string;
    phase: string;
    is_complete: boolean;
    topic?: string;
    user_side?: string;
    user_text?: string;
  }>;
}

export async function endSession(sessionId: string) {
  const origin = apiOrigin();
  const res = await fetch(`${origin}/api/session/${sessionId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await parseError(res));
}
