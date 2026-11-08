/**
 * App shell: left sidebar (logo, signed-in user, role-aware menu) + main area.
 *
 *   Requester (customer)        Admin (runs the Helpdesk)
 *   #/new      Create ticket     #/queue        Dashboard + ticket list
 *   #/my       My tickets        #/queue/:id    Ticket workspace
 *   #/my/:id   Ticket status     #/admin        Admin (admin only)
 *
 * Two roles only. The admin does not file tickets, so never sees the requester screens.
 */
import { useEffect } from 'react';
import { isStaff, useIdentity } from './auth/identity';
import { Avatar, Icon, type IconName } from './components/Icon';
import { Logo } from './components/Logo';
import { Loading, Notice } from './components/ui';
import { ROLE_LABEL } from './lib/format';
import { match, navigate, usePath } from './lib/router';
import { Admin } from './pages/Admin';
import { Dashboard } from './pages/Dashboard';
import { CreateTicket } from './pages/CreateTicket';
import { Login } from './pages/Login';
import { MyTickets } from './pages/MyTickets';

export function App() {
  const { user, ready, signOut, error } = useIdentity();
  const path = usePath();
  const staff = isStaff(user);

  // Each role lands on its own screens only.
  useEffect(() => {
    if (!user) return;
    if (path === '/') navigate(staff ? '/queue' : '/new');
    else if (staff && (path === '/new' || path.startsWith('/my'))) navigate('/queue');
    else if (!staff && (path.startsWith('/queue') || path === '/admin')) navigate('/my');
  }, [path, user, staff]);

  const nav: { href: string; label: string; icon: IconName }[] = staff
    ? [
        { href: '/queue', label: 'แดชบอร์ด', icon: 'dashboard' },
        { href: '/admin', label: 'จัดการหมวดหมู่', icon: 'settings' },
      ]
    : [
        { href: '/new', label: 'แจ้งปัญหาใหม่', icon: 'plus' },
        { href: '/my', label: 'คำร้องของฉัน', icon: 'ticket' },
      ];

  let page = null;
  let params: Record<string, string> | null;
  if (path === '/new') page = <CreateTicket />;
  else if (path === '/my') page = <MyTickets />;
  else if ((params = match('/my/:id', path))) page = <MyTickets selectedId={Number(params.id)} />;
  else if (path === '/queue') page = <Dashboard />;
  else if ((params = match('/queue/:id', path))) page = <Dashboard selectedId={Number(params.id)} />;
  else if (path === '/admin') page = <Admin />;

  const skip = (
    <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
      ข้ามไปยังเนื้อหา
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
      <div className="shell">
        <aside className="sidebar">
          <a className="brand" href={`#${staff ? '/queue' : '/new'}`}>
            <Logo size={36} />
            <span className="brand__name">
              Helpdesk
              <span className="brand__sub">University Digital Campus</span>
            </span>
          </a>

          {user && (
            <div className="usercard">
              <Avatar name={user.full_name} size={36} />
              <div>
                <div className="usercard__name">{user.full_name}</div>
                <div className="usercard__role">{ROLE_LABEL[user.role]}</div>
              </div>
            </div>
          )}

          <nav className="side-nav" aria-label="เมนูหลัก">
            {user &&
              nav.map((n) => (
                <a key={n.href} href={`#${n.href}`} aria-current={path.startsWith(n.href) ? 'page' : undefined}>
                  <Icon name={n.icon} />
                  {n.label}
                </a>
              ))}
          </nav>

          {user && (
            <div className="sidebar__foot">
              <button className="side-out" onClick={signOut}>
                <Icon name="logout" />
                ออกจากระบบ
              </button>
              <p className="sidebar__credit">Student Support Pod, Team 14</p>
            </div>
          )}
        </aside>

        <main id="main" className="main" tabIndex={-1}>
          {error ? (
            <div className="page">
              <Notice tone="error" title="เชื่อมต่อระบบไม่ได้">
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
