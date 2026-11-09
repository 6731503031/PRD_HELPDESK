/**
 * Admin — basic ticket counts + manage categories (PRD §2 Admin, F23/F24)
 */
import { useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { Priority, TicketStatus } from '../api/types';
import { ErrorNotice, Field, Loading, Notice, Panel } from '../components/ui';
import { PRIORITY_LABEL, STATUS_LABEL } from '../lib/format';
import { useAsync } from '../lib/useAsync';

export function Admin() {
  const stats = useAsync(() => api.stats(), []);
  const cats = useAsync(() => api.categories(true), []);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text?: string; error?: unknown } | null>(null);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setResult(null);
    try {
      await api.addCategory(name.trim(), description.trim());
      setResult({ ok: true, text: `เพิ่มหมวด ${name.trim()} แล้ว` });
      setName('');
      setDescription('');
      void cats.reload();
    } catch (err) {
      setResult({ ok: false, error: err });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: number, active: boolean) => {
    setResult(null);
    try {
      await api.setCategoryActive(id, active);
      setResult({ ok: true, text: active ? 'เปิดใช้หมวดหมู่แล้ว' : 'ปิดใช้หมวดหมู่แล้ว' });
      void cats.reload();
    } catch (err) {
      setResult({ ok: false, error: err });
    }
  };

  return (
    <div className="page">
      <div className="page__head">
        <h1>จัดการหมวดหมู่</h1>
        <p>หมวดหมู่ที่ผู้แจ้งเลือกได้ตอนแจ้งปัญหา เพิ่มใหม่หรือปิดใช้หมวดที่ไม่ใช้แล้ว</p>
      </div>

      <Panel title="จำนวนคำร้อง">
        {stats.loading && !stats.data ? (
          <Loading />
        ) : stats.error ? (
          <ErrorNotice error={stats.error} />
        ) : stats.data ? (
          <div className="layout-split">
            <div>
              <h3>ตามสถานะ</h3>
              <table className="table table--static mt-2">
                <tbody>
                  {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => (
                    <tr key={s}>
                      <td>{STATUS_LABEL[s]}</td>
                      <td className="num cell-end">{stats.data!.by_status[s] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3>ตามความเร่งด่วน</h3>
              <table className="table table--static mt-2">
                <tbody>
                  {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                    <tr key={p}>
                      <td>{PRIORITY_LABEL[p]}</td>
                      <td className="num cell-end">{stats.data!.by_priority[p] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted mt-2">รวมทั้งหมด {stats.data.total} คำร้อง</p>
            </div>
          </div>
        ) : null}
      </Panel>

      <Panel title="หมวดหมู่">
        <div aria-live="polite">
          {result?.ok && <Notice tone="ok" title={result.text} />}
          {result && !result.ok && <ErrorNotice error={result.error} />}
        </div>

        {cats.loading && !cats.data ? (
          <Loading />
        ) : cats.error ? (
          <ErrorNotice error={cats.error} />
        ) : (
          <div className={`table-wrap${result ? ' mt-4' : ''}`}>
            <table className="table table--static">
              <caption className="visually-hidden">หมวดหมู่ทั้งหมด</caption>
              <thead>
                <tr>
                  <th scope="col">ชื่อ</th>
                  <th scope="col">คำอธิบาย</th>
                  <th scope="col">สถานะ</th>
                  <th scope="col"><span className="visually-hidden">การจัดการ</span></th>
                </tr>
              </thead>
              <tbody>
                {cats.data?.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="muted">{c.description ?? '–'}</td>
                    <td>{c.is_active ? 'เปิดใช้' : <span className="muted">ปิดใช้</span>}</td>
                    <td className="cell-end">
                      <button className="btn btn--plain btn--small" onClick={() => toggle(c.id, !c.is_active)}>
                        {c.is_active ? 'ปิดใช้' : 'เปิดใช้'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form className="form form--narrow mt-5" onSubmit={add}>
          <h3>เพิ่มหมวดหมู่</h3>
          <Field id="cat-name" label="ชื่อหมวดหมู่" required>
            <input id="cat-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
          </Field>
          <Field id="cat-desc" label="คำอธิบาย" hint="ช่วยให้ผู้แจ้งเลือกหมวดได้ถูก">
            <input id="cat-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
          </Field>
          <div className="form-actions">
            <button className="btn" type="submit" disabled={saving || name.trim().length < 2}>
              {saving ? 'กำลังเพิ่ม…' : 'เพิ่มหมวดหมู่'}
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
