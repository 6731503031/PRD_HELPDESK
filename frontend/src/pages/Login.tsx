/**
 * Sign-in (PRD FR-01). No password field on purpose: Helpdesk must never handle
 * credentials. Identity is a documented stub (PRD §20): the account picker below
 * stands in for a real SSO page.
 */
import { useState } from 'react';
import type { Role, User } from '../api/types';
import { useIdentity } from '../auth/identity';
import { Notice } from '../components/ui';
import { ROLE_LABEL } from '../lib/format';

const ROLE_ORDER: Role[] = ['customer', 'agent', 'admin'];
const ROLE_NOTE: Record<Role, string> = {
  customer: 'นักศึกษา อาจารย์ บุคลากร: แจ้งปัญหาและติดตามคำร้องของตัวเอง',
  agent: 'เจ้าหน้าที่ Helpdesk: คัดกรอง มอบหมาย และปิดงาน',
  admin: 'ผู้ดูแลระบบ: จัดการหมวดหมู่และดูภาพรวม',
};

export function Login() {
  const { users, signIn, error } = useIdentity();
  const [step, setStep] = useState<'start' | 'choose'>('start');

  return (
    <div className="login">
      <section className="login__intro" aria-labelledby="login-title">
        <p className="login__platform">University Digital Campus</p>
        <h1 id="login-title">Helpdesk</h1>
        <p className="login__lead">แจ้งปัญหาการใช้งาน อุปกรณ์ อาคาร และบัญชีผู้ใช้ ได้ในที่เดียว และติดตามได้ว่าคำร้องอยู่ขั้นไหน</p>
        <ul className="login__points">
          <li>ได้เลขคำร้องทันทีหลังแจ้ง</li>
          <li>เห็นสถานะและข้อความจากเจ้าหน้าที่</li>
          <li>งานซ่อมถูกส่งต่อฝ่ายซ่อมบำรุงและแสดงความคืบหน้าให้</li>
        </ul>
      </section>

      <section className="login__box panel" aria-labelledby="signin-title">
        <div className="panel__body">
          <h2 id="signin-title">เข้าสู่ระบบ</h2>

          {error ? (
            <div style={{ marginTop: 16 }}>
              <Notice tone="error" title="เชื่อมต่อระบบไม่ได้">
                <p>{error}</p>
              </Notice>
            </div>
          ) : step === 'start' ? (
            <>
              <p className="muted" style={{ marginTop: 8 }}>ใช้บัญชีมหาวิทยาลัยบัญชีเดียวกับระบบอื่นของมหาวิทยาลัย</p>
              <button className="btn btn--block" style={{ marginTop: 24 }} onClick={() => setStep('choose')} disabled={!users.length}>
                เข้าสู่ระบบด้วยบัญชีมหาวิทยาลัย
              </button>
              <p className="muted small" style={{ marginTop: 16 }}>
                Helpdesk ไม่เก็บรหัสผ่านของคุณ การยืนยันตัวตนทำโดยระบบ Identity ของมหาวิทยาลัย
              </p>
            </>
          ) : (
            <>
              <Notice tone="warn" title="โหมดทดสอบ">
                <p className="small">ระบบนี้ใช้บัญชีทดสอบ (Identity stub) เลือกบัญชีที่ต้องการใช้งาน</p>
              </Notice>
              {ROLE_ORDER.map((role) => {
                const group = users.filter((u: User) => u.role === role);
                if (!group.length) return null;
                return (
                  <fieldset key={role} className="login__group">
                    <legend>{ROLE_LABEL[role]}</legend>
                    <p className="muted small">{ROLE_NOTE[role]}</p>
                    <div className="login__accounts">
                      {group.map((u) => (
                        <button key={u.id} className="account" onClick={() => signIn(u.id)}>
                          <span className="account__name">{u.full_name}</span>
                          <span className="account__mail">{u.email}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                );
              })}
              <button className="btn btn--plain" style={{ marginTop: 16 }} onClick={() => setStep('start')}>
                ย้อนกลับ
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
