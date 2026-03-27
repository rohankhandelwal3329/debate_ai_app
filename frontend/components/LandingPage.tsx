'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadUserSession, saveUserSession, type UserData } from '@/lib/sessionStorage';

/** Form fields always start empty */
const INITIAL_FORM = { name: '', pantherId: '', email: '' };

export default function LandingPage() {
  const router = useRouter();
  const [name, setName] = useState(INITIAL_FORM.name);
  const [pantherId, setPantherId] = useState(INITIAL_FORM.pantherId);
  const [email, setEmail] = useState(INITIAL_FORM.email);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.body.classList.add('student-landing');
    document.body.classList.remove('debate-active');
    return () => {
      document.body.classList.remove('student-landing');
    };
  }, []);

  useEffect(() => {
    if (loadUserSession()) {
      router.replace('/studio');
      return;
    }
    setReady(true);
  }, [router]);

  const onSubmitStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !pantherId.trim() || !email.trim()) return;
    const u: UserData = {
      name: name.trim(),
      pantherId: pantherId.trim(),
      email: email.trim(),
    };
    saveUserSession(u);
    router.push('/studio');
  };

  if (!ready) {
    return null;
  }

  return (
    <div className="student-shell">
      <header className="student-nav">
        <img src="/assets/ai-microphone.gif" alt="" width={36} height={36} />
        <span className="student-nav-title">CETLOE Debate AI</span>
        <span className="student-nav-spacer" />
        <span className="student-badge">Student access</span>
      </header>

      <main className="student-main">
        <div>
          <p className="student-copy-eyebrow">CETLOE · Voice practice</p>
          <h1 className="student-headline">
            Sharpen your arguments.{' '}
            <span className="student-gradient">Get coached in real time.</span>
          </h1>
          <p className="student-lede">
            Sign in with your campus details to enter the debate studio. Live transcription, an AI that takes the other
            side, and feedback when you finish—built for coursework and practice, not the open web.
          </p>
          <p className="student-note">
            This tool is for enrolled students only. Use the name, Panther ID, and email you were instructed to use for
            CETLOE sessions.
          </p>
          <div className="student-chips">
            <span className="student-chip">Live STT</span>
            <span className="student-chip">Coaching</span>
            <span className="student-chip">Voice replies</span>
          </div>
        </div>

        <div>
          <div className="student-mock hero-session-preview" aria-hidden="true">
            <div className="student-mock-head">
              <span className="student-mock-dot" />
              <span className="student-mock-dot" />
              <span className="student-mock-dot" />
              <span className="student-mock-title">Studio preview</span>
            </div>
            <div className="student-mock-body">
              <div className="student-mock-bubble user">
                Opening: we should prioritize evidence-based harm reduction.
              </div>
              <div className="student-mock-bubble ai">
                What trade-off are you willing to accept when individual liberty conflicts with that goal?
              </div>
            </div>
          </div>

          <form className="student-form-card" onSubmit={onSubmitStudent} style={{ marginTop: '1.25rem' }}>
            <h2>Enter the studio</h2>
            <p className="sub">Campus credentials</p>
            <div className="sf-field">
              <label>
                <span>Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Your name"
                  required
                />
              </label>
            </div>
            <div className="sf-field">
              <label>
                <span>Panther ID</span>
                <input
                  value={pantherId}
                  onChange={(e) => setPantherId(e.target.value)}
                  autoComplete="username"
                  placeholder="Campus ID"
                  required
                />
              </label>
            </div>
            <div className="sf-field">
              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="student@school.edu"
                  required
                />
              </label>
            </div>
            <button type="submit" className="sf-submit">
              Continue
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </form>
        </div>
      </main>

      <footer className="student-landing-footer">Made with ❤️ by CETLOE</footer>
    </div>
  );
}
