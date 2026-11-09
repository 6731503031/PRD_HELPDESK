/**
 * App shell: left sidebar (logo, signed-in user, role-aware menu) + main area.
 *
 *   Requester (customer)        Admin (runs the Helpdesk)
 *   #/new      Create ticket     #/queue        Dashboard + ticket list
 *   #/my       My tickets        #/queue/:id    Ticket workspace
 *   #/my/:id   Ticket status     #/admin        Manage categories
 *   #/chat     Messages          #/chat         Messages
 *   #/profile  My details        #/staff        Admin sign-in (separate link, not shown to requesters)
 *
 * Two roles only. The admin does not file tickets, so never sees the requester screens.
 * The left sidebar folds into an icon rail (state remembered in this browser).
 */
import { useEffect } from 'react';
import { isStaff, useIdentity } from './auth/identity';
import { Avatar, Icon, type IconName } from './components/Icon';
import { Logo } from './components/Logo';
import { Loading, Notice } from './components/ui';
import { ROLE_LABEL } from './lib/format';
import { match, navigate, usePath } from './lib/router';
import { Admin } from './pages/Admin';
import { Messages } from './pages/Messages';
import { Profile } from './pages/Profile';
import { Dashboard } from './pages/Dashboard';
import { CreateTicket } from './pages/CreateTicket';
import { Login } from './pages/Login';
import { usePersisted } from './lib/usePersisted';
import { MyTickets } from './pages/MyTickets';

export function App() {
  const { user, ready, signOut, error } = useIdentity();
  const path = usePath();
  const staff = isStaff(user);
  const [navOpen, setNavOpen] = usePersisted('helpdesk.sidebar', true);

  // Each role lands on its own screens only.
  useEffect(() => {
    if (!user) return;
    if (path === '/') navigate(staff ? '/queue' : '/new');
    else if (path === '/staff') navigate(staff ? '/queue' : '/new');
    else if (staff && (path === '/new' || path === '/profile' || path.startsWith('/my'))) navigate('/queue');
    else if (!staff && (path.startsWith('/queue') || path === '/admin')) navigate('/my');
  }, [path, user, staff]);

  const nav: { href: string; label: string; icon: IconName }[] = staff
    ? [
        { href: '/queue', label: 'Dashboard', icon: 'dashboard' },
        { href: '/chat', label: 'Messages', icon: 'chat' },
        { href: '/admin', label: 'Categories', icon: 'settings' },
      ]
    : [
        { href: '/new', label: 'Report an issue', icon: 'plus' },
        { href: '/my', label: 'My tickets', icon: 'ticket' },
        { href: '/chat', label: 'Messages', icon: 'chat' },
        { href: '/profile', label: 'My profile', icon: 'user' },
      ];

  let page = null;
  let params: Record<string, string> | null;
  if (path === '/new') page = <CreateTicket />;
  else if (path === '/my') page = <MyTickets />;
  else if ((params = match('/my/:id', path))) page = <MyTickets selectedId={Number(params.id)} />;
  else if (path === '/queue') page = <Dashboard />;
  else if ((params = match('/queue/:id', path))) page = <Dashboard selectedId={Number(params.id)} />;
  else if (path === '/admin') page = <Admin />;
  else if (path === '/chat') page = <Messages />;
  else if ((params = match('/chat/:id', path))) page = <Messages selectedId={Number(params.id)} />;
  else if (path === '/profile') page = <Profile />;

  const skip = (
    <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
      Skip to content
    </a>
  );

  if (ready && !user && !error) {
    return (
      <>
        {skip}
        <main id="main" tabIndex={-1}>
          <Login />
        </main>
      </>
    );
  }

  return (
    <>
      {skip}
      <div className={`shell${navOpen ? '' : ' shell--collapsed'}`}>
        <aside className="sidebar">
          <div className="sidebar__top">
            <a className="brand" href={`#${staff ? '/queue' : '/new'}`}>
              <Logo size={36} />
              <span className="brand__name">
                Helpdesk
                <span className="brand__sub">University Digital Campus</span>
              </span>
            </a>
            <button
              className="icon-btn sidebar-toggle"
              onClick={() => setNavOpen(!navOpen)}
              aria-expanded={navOpen}
              aria-label={navOpen ? 'Collapse menu' : 'Expand menu'}
              title={navOpen ? 'Collapse menu' : 'Expand menu'}
            >
              <Icon name="sidebar" />
            </button>
          </div>

          {user && (
            <div className="usercard">
              <Avatar name={user.full_name} size={36} />
              <div>
                <div className="usercard__name">{user.full_name}</div>
                <div className="usercard__role">{ROLE_LABEL[user.role]}</div>
              </div>
            </div>
          )}

          <nav className="side-nav" aria-label="Main menu">
            {user &&
              nav.map((n) => (
                <a key={n.href} href={`#${n.href}`} title={n.label} aria-current={path.startsWith(n.href) ? 'page' : undefined}>
                  <Icon name={n.icon} />
                  <span className="side-label">{n.label}</span>
                </a>
              ))}
          </nav>

          {user && (
            <div className="sidebar__foot">
              <button className="side-out" onClick={signOut} title="Sign out">
                <Icon name="logout" />
                <span className="side-label">Sign out</span>
              </button>
              <p className="sidebar__credit">Student Support Pod, Team 14</p>
            </div>
          )}
        </aside>

        <main id="main" className="main" tabIndex={-1}>
          {error ? (
            <div className="page">
              <Notice tone="error" title="Cannot connect to the system">
                <p>{error}</p>
              </Notice>
            </div>
          ) : user ? (
            // Pages mount only once the signed-in user is known, so their first request
            // always carries the identity headers (no 401 race on hard reload).
            <div key={path} className="route">{page}</div>
          ) : (
            <div className="page"><Loading variant="dashboard" /></div>
          )}
        </main>
      </div>
    </>
  );
}
