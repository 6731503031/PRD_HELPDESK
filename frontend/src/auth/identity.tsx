/**
 * Sign-in state (Identity STUB, PRD FR-01 / §20).
 *
 * Helpdesk never sees a password and verifies nothing:
 *   - Requester: clicks "เข้าสู่ระบบ", gives a display name (+ optional contact email) once. The server gives
 *     that browser a guest id (>= 1000); the browser remembers it, so the next click goes straight in.
 *   - Admin: opens the separate link /#/staff and clicks once.
 * Real SSO later: replace signInGuest / signInStaff here (and identity.ts / auth.ts on the server);
 * pages keep using useIdentity().
 *
 * PDPA: a requester's consent to the privacy notice is loaded with the user. App.tsx shows
 * ConsentScreen instead of every page until it is accepted (admins are staff, not asked).
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiError, api, setApiUser } from '../api/client';
import type { ConsentStatus, Role, User } from '../api/types';
import { PRIVACY_NOTICE_VERSION } from '../lib/privacy';

const SESSION_KEY = 'helpdesk.session'; // this tab only
const GUEST_KEY = 'helpdesk.guest'; // this browser: the guest profile to come back to
const GUEST_ID_MIN = 1000;
const STAFF_ID = 5;

type Session = { id: number; role: Role };

type IdentityState = {
  user: User | null;
  ready: boolean;
  error: string | null;
  /** A guest profile remembered in this browser (lets "เข้าสู่ระบบ" skip the form). */
  savedGuest: User | null;
  signInGuest: (name: string, email: string) => Promise<void>;
  /** true = signed in again; false = nothing saved or the server no longer knows it (show the form). */
  continueAsSavedGuest: () => Promise<boolean>;
  signInStaff: () => Promise<void>;
  updateProfile: (name: string, email: string) => Promise<void>;
  signOut: () => void;
  /** PDPA consent of the signed-in requester (null for the admin, or when it could not be loaded). */
  consent: ConsentStatus | null;
  acceptConsent: () => Promise<void>;
  /** Records the withdrawal, then signs out. */
  withdrawConsent: () => Promise<void>;
};

/** Requesters only. A failed load counts as "not accepted": the consent screen then shows the error on Accept. */
const loadConsent = (me: User): Promise<ConsentStatus | null> =>
  me.role === 'customer' ? api.consent().catch(() => null) : Promise.resolve(null);

const IdentityContext = createContext<IdentityState | null>(null);

function read<T>(storage: 'session' | 'local', key: string): T | null {
  try {
    const raw = (storage === 'session' ? window.sessionStorage : window.localStorage).getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(storage: 'session' | 'local', key: string, value: unknown) {
  try {
    const s = storage === 'session' ? window.sessionStorage : window.localStorage;
    if (value == null) s.removeItem(key);
    else s.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode — fine */
  }
}

/** ?as=5 signs in as that demo user (handy for demos and screenshots). */
async function sessionFromUrl(): Promise<Session | null> {
  const raw = new URLSearchParams(window.location.search).get('as');
  if (!raw) return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (id >= GUEST_ID_MIN) return { id, role: 'customer' };
  const found = (await api.users()).find((u) => u.id === id);
  return found ? { id, role: found.role } : null;
}

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [savedGuest, setSavedGuest] = useState<User | null>(() => read<User>('local', GUEST_KEY));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState<ConsentStatus | null>(null);

  // Restore the session of this tab (and ask the server who it is, so a stale one is dropped).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const session = (await sessionFromUrl()) ?? read<Session>('session', SESSION_KEY);
        if (session) {
          setApiUser(session);
          const me = await api.me();
          const c = await loadConsent(me);
          if (alive) {
            setConsent(c);
            setUser(me);
          }
        }
      } catch (e) {
        setApiUser(null);
        write('session', SESSION_KEY, null);
        if (alive && e instanceof ApiError && e.status === 0) setError(e.message);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /** Consent is loaded before the user is set, so a requester never sees a page flash before the consent screen. */
  const enter = async (me: User) => {
    setApiUser({ id: me.id, role: me.role });
    write('session', SESSION_KEY, { id: me.id, role: me.role });
    setConsent(await loadConsent(me));
    setUser(me);
  };

  /** The guest ticked "I agree" in the sign-in form: the server stores that consent with the new profile. */
  const signInGuest = async (name: string, email: string) => {
    const created = await api.createGuest(name, email, PRIVACY_NOTICE_VERSION);
    write('local', GUEST_KEY, created);
    setSavedGuest(created);
    await enter(created);
  };

  const continueAsSavedGuest = async () => {
    if (!savedGuest) return false;
    setApiUser({ id: savedGuest.id, role: 'customer' });
    try {
      await enter(await api.me());
      return true;
    } catch (e) {
      setApiUser(null);
      if (e instanceof ApiError && e.status === 0) throw e; // offline: keep the saved profile
      write('local', GUEST_KEY, null); // the server no longer knows it (e.g. database reset)
      setSavedGuest(null);
      return false;
    }
  };

  const signInStaff = async () => {
    setApiUser({ id: STAFF_ID, role: 'admin' });
    try {
      await enter(await api.me());
    } catch (e) {
      setApiUser(null);
      throw e;
    }
  };

  const updateProfile = async (name: string, email: string) => {
    const updated = await api.updateProfile(name, email);
    setUser(updated);
    write('local', GUEST_KEY, updated);
    setSavedGuest(updated);
  };

  const signOut = () => {
    setApiUser(null);
    setUser(null);
    setConsent(null);
    write('session', SESSION_KEY, null);
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
    window.location.hash = '/';
  };

  const acceptConsent = async () => {
    setConsent(await api.acceptConsent(PRIVACY_NOTICE_VERSION));
  };

  const withdrawConsent = async () => {
    await api.withdrawConsent();
    signOut();
  };

  return (
    <IdentityContext.Provider
      value={{ user, ready, error, savedGuest, signInGuest, continueAsSavedGuest, signInStaff, updateProfile, signOut, consent, acceptConsent, withdrawConsent }}
    >
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity() {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error('useIdentity must be used inside IdentityProvider');
  return ctx;
}

/** Two roles: requester (customer) and admin, who runs the Helpdesk. */
export const isStaff = (u: User | null) => u?.role === 'admin';
/** A guest is a requester made by "เข้าสู่ระบบ"; the demo accounts (ids below 1000) are not guests. */
export const isGuest = (u: User | null) => !!u && u.id >= GUEST_ID_MIN;
