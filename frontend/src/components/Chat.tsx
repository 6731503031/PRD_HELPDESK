/**
 * One conversation per ticket: requester <-> admin (PRD FR-11). Messenger-style:
 * mine on the right in blue, theirs on the left in grey with an avatar, bursts grouped, day dividers,
 * a round composer. New messages arrive by quiet polling (real-time push is out of scope in the PRD).
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { Comment } from '../api/types';
import { useIdentity } from '../auth/identity';
import { closeInTime, dayLabel, formatDateTime, formatTime, sameDay } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Avatar, Icon } from './Icon';
import { ErrorNotice, Loading } from './ui';

type Row = { c: Comment; mine: boolean; first: boolean; last: boolean; day: string | null };

/** Group neighbours: same author, same day, within 5 minutes. */
function arrange(list: Comment[], myId: number | undefined): Row[] {
  const together = (a: Comment, b: Comment) => a.author_id === b.author_id && sameDay(a.created_at, b.created_at) && closeInTime(a.created_at, b.created_at);
  return list.map((c, i) => {
    const prev = list[i - 1];
    const next = list[i + 1];
    return {
      c,
      mine: c.author_id === myId,
      first: !prev || !together(prev, c),
      last: !next || !together(c, next),
      day: !prev || !sameDay(prev.created_at, c.created_at) ? dayLabel(c.created_at) : null,
    };
  });
}

export function Chat({ ticketId }: { ticketId: number }) {
  const { user } = useIdentity();
  const { data, error, loading, refresh, setData } = useAsync(() => api.comments(ticketId), [ticketId, user?.id]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<unknown>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // New messages show up without a reload, while the tab is visible.
  useEffect(() => {
    if (error) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [error, refresh]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [data?.length, ticketId]);

  const grow = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const added = await api.addComment(ticketId, body);
      setText('');
      setData((prev) => [...(prev ?? []), added]); // show it at once; polling keeps it in sync
      window.requestAnimationFrame(grow);
    } catch (err) {
      setSendError(err);
    } finally {
      setSending(false);
    }
  };

  const rows = arrange(data ?? [], user?.id);

  return (
    <div className="chatbox">
      <div className="thread__log" ref={logRef} aria-live="polite" aria-label="ข้อความ">
        {loading && !data ? (
          <Loading variant="text" label="กำลังโหลดข้อความ…" />
        ) : error ? (
          <ErrorNotice error={error} />
        ) : rows.length === 0 ? (
          <p className="thread__empty">ยังไม่มีข้อความ ส่งข้อความแรกเพื่อเริ่มคุยได้เลย</p>
        ) : (
          rows.map(({ c, mine, first, last, day }) => (
            <div key={c.id} className="burst">
              {day && <div className="day">{day}</div>}
              <div className={`mx ${mine ? 'mx--mine' : 'mx--them'} ${first && last ? 'is-single' : first ? 'is-first' : last ? 'is-last' : 'is-mid'}`}>
                {!mine && <span className="mx__av">{last && <Avatar name={c.author_name} size={28} />}</span>}
                <div className="mx__col">
                  <div className="bub" title={formatDateTime(c.created_at)}>{c.content}</div>
                  {last && <span className="mx__time">{formatTime(c.created_at)}</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {sendError ? <div className="thread__note"><ErrorNotice error={sendError} /></div> : null}

      <form className="composer" onSubmit={send}>
        <label className="visually-hidden" htmlFor={`msg-${ticketId}`}>พิมพ์ข้อความ</label>
        <textarea
          id={`msg-${ticketId}`}
          ref={inputRef}
          className="composer__input"
          rows={1}
          placeholder="พิมพ์ข้อความ…"
          value={text}
          maxLength={2000}
          onChange={(e) => {
            setText(e.target.value);
            grow();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button className="composer__send" type="submit" disabled={sending || !text.trim()} aria-label="ส่งข้อความ">
          <Icon name="send" size={18} />
        </button>
      </form>
    </div>
  );
}
