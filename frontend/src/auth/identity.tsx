/**
 * Sign-in state (Identity STUB, PRD FR-01 / §20).
 *
 * Helpdesk never sees a password. Identity is a documented stub (PRD §20):
 * the login page lets you pick one of the stub accounts.
 * Real SSO later: replace signIn/signOut here; pages keep using useIdentity().
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setApiUser } from '../api/client';
import type { User } from '../api/types';

type IdentityState = {
  user: User | null;
  users: User[];
  ready: boolean;
  signIn: (id: number) => void;
  signOut: () => void;
  error: string | null;
};

const IdentityContext = createContext<IdentityState | null>(null);
const STORAGE_KEY = 'helpdesk.session';

function readSession(): number | null {
  // ?as=3 signs in as that demo user (handy for demos and screenshots)
  const fromUrl = new URLSearchParams(window.location.search).get('as');
  if (fromUrl) return Number(fromUrl);
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

function writeSession(id: number | null) {
  try {
    if (id == null) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    /* private mode — fine */
  }
}

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .users()
      .then((list) => {
        setUsers(list);
        const restored = list.find((u) => u.id === readSession()) ?? null;
        setApiUser(restored);
        setUser(restored);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setReady(true));
  }, []);

  const signIn = (id: number) => {
    const next = users.find((u) => u.id === id) ?? null;
    setApiUser(next);
    setUser(next);
    writeSession(next?.id ?? null);
  };

  const signOut = () => {
    setApiUser(null);
    setUser(null);
    writeSession(null);
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
    window.location.hash = '/';
  };

  return (
    <IdentityContext.Provider value={{ user, users, ready, signIn, signOut, error }}>{children}</IdentityContext.Provider>
  );
}

export function useIdentity() {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error('useIdentity must be used inside IdentityProvider');
  return ctx;
}

/** Two roles: requester (customer) and admin, who runs the Helpdesk. */
export const isStaff = (u: User | null) => u?.role === 'admin';
