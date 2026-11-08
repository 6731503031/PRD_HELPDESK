/**
 * App shell: institution bar (with demo sign-in), masthead, role-aware navigation, routes.
 *
 *   #/new          Create ticket        (everyone)
 *   #/my, #/my/:id My tickets           (everyone)
 *   #/queue[/:id]  Agent queue          (agent, admin)
 *   #/admin        Admin                (admin)
 */
import { useEffect } from 'react';
import { isStaff, useIdentity } from './auth/identity';
import { Notice } from './components/ui';
import { ROLE_LABEL } from './lib/format';
import { match, navigate, usePath } from './lib/router';
import { Admin } from './pages/Admin';
import { AgentQueue } from './pages/AgentQueue';
import { CreateTicket } from './pages/CreateTicket';
import { Login } from './pages/Login';
import { MyTickets } from './pages/MyTickets';

export function App() {
  const { user, ready, signOut, error } = useIdentity();
  const path = usePath();
  const staff = isStaff(user);

  // Land each role on its main screen.
  useEffect(() => {
    if (!user) return;
    if (path === '/') navigate(staff ? '/queue' : '/new');
    else if (path.startsWith('/queue') && !staff) navigate('/my');
    else if (path === '/admin' && user.role !== 'admin') navigate(staff ? '/queue' : '/my');
  }, [path, user, staff]);

  const nav = [
    { href: '/new', label: 'แจ้งปัญหาใหม่', show: true },
    { href: '/my', label: 'คำร้องของฉัน', show: true },
    { href: '/queue', label: 'คิวงานเจ้าหน้าที่', show: staff },
    { href: '/admin', label: 'ผู้ดูแลระบบ', show: user?.role === 'admin' },
  ].filter((n) => n.show);

  let page = null;
  let params: Record<string, string> | null;
  if (!user) page = null;
  else if (path === '/new') page = <CreateTicket />;
  else if (path === '/my') page = <MyTickets />;
  else if ((params = match('/my/:id', path))) page = <MyTickets selectedId={Number(params.id)} />;
  else if (path === '/queue') page = <AgentQueue />;
  else if ((params = match('/queue/:id', path))) page = <AgentQueue selectedId={Number(params.id)} />;
  else if (path === '/admin') page = <Admin />;

  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        ข้ามไปยังเนื้อหา
      </a>

      <div className="institution">
        <div className="institution__inner">
          <span className="institution__name">University Digital Campus</span>
          {user && (
            <div className="identity">
              <span>
                {user.full_name} <span className="identity__role">{ROLE_LABEL[user.role]}</span>
              </span>
              <button className="identity__out" onClick={signOut}>ออกจากระบบ</button>
            </div>
          )}
        </div>
      </div>

      {ready && !user && !error ? (
        <main id="main" tabIndex={-1}>
          <Login />
        </main>
      ) : (
      <>
      <header className="masthead">
        <div className="masthead__inner">
          <div className="masthead__title">
            <h1>Helpdesk</h1>
            <p>ระบบแจ้งปัญหาและติดตามคำร้อง สำหรับนักศึกษาและบุคลากร</p>
          </div>
          <nav className="nav" aria-label="เมนูหลัก">
            {nav.map((n) => (
              <a key={n.href} href={`#${n.href}`} aria-current={path.startsWith(n.href) ? 'page' : undefined}>
                {n.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        {error ? (
          <div className="page">
            <Notice tone="error" title="เชื่อมต่อระบบไม่ได้">
              <p>{error}</p>
            </Notice>
          </div>
        ) : (
          page
        )}
      </main>
      </>
      )}

      <footer className="footer">
        <div className="footer__inner">
          Helpdesk, Student Support Pod. ดูแลโดย Team 14 ข้อมูลผู้ใช้อ้างอิงจากระบบ Identity ของมหาวิทยาลัย
        </div>
      </footer>
    </>
  );
}
