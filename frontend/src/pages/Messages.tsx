/**
 * Messages — the conversation of each ticket, for both roles (PRD FR-11).
 *   left   list of my conversations (admin: all tickets) — can be collapsed
 *   centre the conversation, Messenger-style
 *   right  ticket details — can be collapsed
 * One ticket = one conversation. Requester <-> admin only; Team 10 never appears here.
 */
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { isStaff, useIdentity } from '../auth/identity';
import { Avatar, Icon } from '../components/Icon';
import { Chat } from '../components/Chat';
import { ErrorNotice, Loading, Notice, PriorityText, StatusBadge } from '../components/ui';
import { formatDateTime, listTime, maintenanceLabel } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { usePersisted } from '../lib/usePersisted';

const wide = () => window.matchMedia('(min-width: 861px)').matches;

export function Messages({ selectedId }: { selectedId?: number }) {
  const { user } = useIdentity();
  const staff = isStaff(user);
  const { data, error, loading, refresh } = useAsync(() => (staff ? api.queue() : api.myTickets()), [user?.id]);
  const [search, setSearch] = useState('');
  const [listOpen, setListOpen] = usePersisted('helpdesk.chat.list', true);
  const [infoOpen, setInfoOpen] = usePersisted('helpdesk.chat.info', window.matchMedia('(min-width: 1280px)').matches);

  // Newest activity first (a new message bumps the ticket's updated_at).
  const sorted = useMemo(() => [...(data ?? [])].sort((a, b) => b.updated_at.localeCompare(a.updated_at)), [data]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? sorted.filter((t) => [t.ticket_number, t.title, t.customer_name ?? ''].some((s) => s.toLowerCase().includes(q))) : sorted;
  }, [sorted, search]);
  const selected = sorted.find((t) => t.id === selectedId) ?? null;

  // The list stays fresh (order, times) while the tab is visible.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  // On a wide screen, open the latest conversation straight away.
  useEffect(() => {
    if (!selectedId && sorted.length && wide()) window.location.replace(`#/chat/${sorted[0].id}`);
  }, [selectedId, sorted]);

  const other = staff ? selected?.customer_name ?? 'ผู้แจ้ง' : 'ผู้ดูแล Helpdesk';
  const ticketHref = (id: number) => (staff ? `#/queue/${id}` : `#/my/${id}`);

  return (
    <div className={`msgs${listOpen ? '' : ' msgs--no-list'}${infoOpen ? '' : ' msgs--no-info'}${selectedId ? ' msgs--has-conv' : ''}`}>
      {/* Left: conversations */}
      <aside className="msgs__list" aria-label="รายการบทสนทนา">
        <div className="msgs__listhead">
          <h1 className="msgs__h">ข้อความ</h1>
          <button className="icon-btn" onClick={() => setListOpen(false)} aria-label="ซ่อนรายการบทสนทนา" title="ซ่อนรายการ">
            <Icon name="sidebar" />
          </button>
        </div>
        <label className="search msgs__search">
          <span className="visually-hidden">ค้นหา</span>
          <Icon name="search" size={16} />
          <input className="input" placeholder={staff ? 'ค้นหาเลขที่ เรื่อง ผู้แจ้ง' : 'ค้นหาเลขที่ หรือเรื่อง'} value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>

        <div className="msgs__items">
          {loading && !data ? (
            <div className="msgs__pad"><Loading variant="table" /></div>
          ) : error ? (
            <div className="msgs__pad"><ErrorNotice error={error} /></div>
          ) : rows.length === 0 ? (
            <div className="empty">
              <p>{search ? 'ไม่พบบทสนทนาที่ค้นหา' : staff ? 'ยังไม่มีคำร้อง' : 'คุณยังไม่มีคำร้อง'}</p>
              {!staff && !search && <a className="btn" href="#/new">แจ้งปัญหาใหม่</a>}
            </div>
          ) : (
            rows.map((t) => (
              <a key={t.id} className="conv" href={`#/chat/${t.id}`} aria-current={t.id === selectedId ? 'true' : undefined}>
                <Avatar name={staff ? t.customer_name : 'Helpdesk'} size={40} />
                <span className="conv__body">
                  <span className="conv__top">
                    <span className="conv__num">{t.ticket_number}</span>
                    <span className="conv__time">{listTime(t.updated_at)}</span>
                  </span>
                  <span className="conv__title">{staff && t.customer_name ? `${t.customer_name} · ` : ''}{t.title}</span>
                  <span className="conv__meta"><StatusBadge status={t.status} /></span>
                </span>
              </a>
            ))
          )}
        </div>
      </aside>

      {/* Centre: the conversation */}
      <section className="thread" aria-label="บทสนทนา">
        {selected ? (
          <>
            <header className="thread__head">
              {!listOpen && (
                <button className="icon-btn" onClick={() => setListOpen(true)} aria-label="แสดงรายการบทสนทนา" title="แสดงรายการ">
                  <Icon name="sidebar" />
                </button>
              )}
              <a className="icon-btn thread__back" href="#/chat" aria-label="กลับไปรายการ"><Icon name="back" /></a>
              <Avatar name={staff ? other : 'Helpdesk'} size={38} />
              <div className="thread__title">
                <strong>{selected.title}</strong>
                <span className="muted small">{selected.ticket_number} · {other}</span>
              </div>
              <a className="btn btn--secondary btn--small" href={ticketHref(selected.id)}>ดูคำร้อง</a>
              <button className="icon-btn thread__infotoggle" onClick={() => setInfoOpen(!infoOpen)} aria-pressed={infoOpen} aria-label={infoOpen ? 'ซ่อนรายละเอียดคำร้อง' : 'แสดงรายละเอียดคำร้อง'} title="รายละเอียดคำร้อง">
                <Icon name="panelRight" />
              </button>
            </header>
            <Chat key={selected.id} ticketId={selected.id} />
          </>
        ) : (
          <>
            <header className="thread__head">
              {!listOpen && (
                <button className="icon-btn" onClick={() => setListOpen(true)} aria-label="แสดงรายการบทสนทนา" title="แสดงรายการ">
                  <Icon name="sidebar" />
                </button>
              )}
            </header>
            <div className="thread__blank">
              {selectedId && !loading ? (
                <Notice tone="warn" title="ไม่พบคำร้องนี้">
                  <p className="small">อาจไม่ใช่คำร้องของคุณ หรือถูกลบไปแล้ว</p>
                </Notice>
              ) : (
                <>
                  <Icon name="chat" size={40} />
                  <p>เลือกบทสนทนาทางซ้ายเพื่อเริ่มคุย</p>
                </>
              )}
            </div>
          </>
        )}
      </section>

      {/* Right: ticket details */}
      <aside className="msgs__info" aria-label="รายละเอียดคำร้อง">
        {selected && (
          <>
            <div>
              <p className="muted small">{selected.ticket_number}</p>
              <h2 className="msgs__infotitle">{selected.title}</h2>
              <div className="inline mt-2"><StatusBadge status={selected.status} /><PriorityText priority={selected.priority} /></div>
            </div>
            <dl className="meta">
              <dt>หมวดหมู่</dt>
              <dd><span className="chip">{selected.category_name ?? '–'}</span></dd>
              <dt>ผู้แจ้ง</dt>
              <dd className="person"><Avatar name={selected.customer_name} size={22} /> {selected.customer_name ?? `#${selected.customer_id}`}</dd>
              <dt>แจ้งเมื่อ</dt>
              <dd>{formatDateTime(selected.created_at)}</dd>
            </dl>
            {selected.maintenance_work_order_id && (
              <Notice tone="info" title={`ใบงานซ่อม ${selected.maintenance_work_order_id}`}>
                <p className="small">{maintenanceLabel(selected.maintenance_status)}</p>
              </Notice>
            )}
            <a className="btn btn--secondary" href={ticketHref(selected.id)}>เปิดหน้าคำร้อง</a>
          </>
        )}
      </aside>
    </div>
  );
}
