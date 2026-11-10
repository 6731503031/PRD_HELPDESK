/**
 * Privacy notice (ประกาศความเป็นส่วนตัว) — PDPA พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562, PRD §13 Data Protection.
 * Owner: P1
 *
 * The ONE place the notice text lives. It is shown:
 *   - in the sign-in form (a new requester must tick "I agree" before a profile is created)
 *   - as a full screen after sign-in when the person has not accepted the current version yet
 *   - at #/privacy (link in the sidebar) and on "My profile", where consent can be withdrawn
 *
 * Changed the meaning of the text? Bump PRIVACY_NOTICE_VERSION here AND in backend/src/core/privacy.ts
 * (backend/test/privacy.test.ts checks they match). Everyone is then asked to accept again.
 * Contact address uses the demo domain of the Identity stub (uni.ac.th): replace it before real use.
 */

export const PRIVACY_NOTICE_VERSION = '1.0';
export const PRIVACY_NOTICE_UPDATED = '2026-11-10';
export const PRIVACY_CONTACT = 'privacy@uni.ac.th';

export type PrivacyLang = 'th' | 'en';

/** A paragraph (string) or a bullet list (string[]). */
export type Block = string | string[];
export type NoticeSection = { id: string; title: string; blocks: Block[] };

export type NoticeText = {
  title: string;
  updated: string;
  summaryTitle: string;
  summary: string[];
  sections: NoticeSection[];
  /** The tick box text. Kept separate from everything else (PDPA s.19: consent must be clearly separate). */
  consent: string;
};

export const PRIVACY_NOTICE: Record<PrivacyLang, NoticeText> = {
  th: {
    title: 'ประกาศความเป็นส่วนตัว (Privacy Notice)',
    updated: `ฉบับที่ ${PRIVACY_NOTICE_VERSION} · ปรับปรุงล่าสุด 10 พฤศจิกายน 2569`,
    summaryTitle: 'สรุปสั้น ๆ',
    summary: [
      'เราเก็บแค่ชื่อที่คุณตั้งเอง อีเมลติดต่อ (ไม่บังคับ) และเรื่องที่คุณแจ้ง เพื่อแก้ปัญหาให้คุณเท่านั้น',
      'ไม่มีรหัสผ่าน ไม่ขอเลขบัตรประชาชน ไม่ขาย และไม่ใช้ข้อมูลเพื่อการตลาด',
      'งานซ่อมส่งให้ฝ่ายซ่อมบำรุงเฉพาะหัวข้อ รายละเอียด และสถานที่ ไม่ส่งชื่อหรืออีเมลของคุณ',
      'ถอนความยินยอมได้ทุกเมื่อที่หน้า "My profile" และขอดู แก้ไข หรือลบข้อมูลได้',
    ],
    sections: [
      {
        id: 'controller',
        title: '1. ผู้ควบคุมข้อมูลส่วนบุคคล',
        blocks: [
          'ระบบ Helpdesk ของ University Digital Campus (Student Support Pod, ทีม 14) เป็นผู้เก็บและดูแลข้อมูลของคุณในระบบนี้',
          `ติดต่อเรื่องข้อมูลส่วนบุคคล: อีเมล ${PRIVACY_CONTACT} หรือส่งข้อความในหน้า Messages ของคำร้อง`,
        ],
      },
      {
        id: 'data',
        title: '2. ข้อมูลที่เราเก็บ',
        blocks: [
          [
            'ชื่อที่แสดง (display name) ที่คุณตั้งเอง ไม่จำเป็นต้องเป็นชื่อจริง',
            'อีเมลติดต่อ (ไม่บังคับ) ใช้ติดต่อกลับเท่านั้น ไม่ได้ใช้เข้าสู่ระบบ',
            'เนื้อหาคำร้อง: หัวข้อ รายละเอียด สถานที่ (เช่น อาคาร ห้อง) หมวดหมู่ และความเร่งด่วน',
            'ข้อความแชทระหว่างคุณกับเจ้าหน้าที่ และประวัติสถานะของคำร้องพร้อมวันเวลา',
            'บันทึกว่าคุณยอมรับหรือถอนความยินยอมตามประกาศฉบับใด เมื่อไร',
            'ข้อมูลในเบราว์เซอร์ของคุณ (localStorage / sessionStorage) เพื่อจำว่าคุณเข้าสู่ระบบอยู่ ไม่ใช้คุกกี้ติดตามหรือโฆษณา',
          ],
          'เราไม่เก็บรหัสผ่าน เลขบัตรประชาชน หรือข้อมูลทางการเงิน กรุณาอย่าใส่ข้อมูลเหล่านี้ หรือข้อมูลส่วนตัวของผู้อื่น ลงในคำร้องหรือแชท',
        ],
      },
      {
        id: 'sensitive',
        title: '3. ข้อมูลอ่อนไหว (เรื่องสุขภาพกายและใจ)',
        blocks: [
          'หากคุณแจ้งเรื่องในหมวด Wellbeing หรือเล่าเรื่องสุขภาพในคำร้อง ข้อมูลนั้นเป็นข้อมูลอ่อนไหวตามมาตรา 26 เราใช้เพื่อดูแลคำร้องนั้นและแนะนำบริการที่เหมาะสมเท่านั้น และไม่ส่งรายละเอียดคำร้องให้ทีม Wellbeing (ทีม 16)',
          'การยอมรับประกาศนี้ถือเป็นความยินยอมโดยชัดแจ้งให้ใช้ข้อมูลอ่อนไหวที่คุณเลือกแจ้งเองตามวัตถุประสงค์นี้ หากไม่ต้องการ ไม่ต้องใส่ข้อมูลนั้นลงในระบบ',
        ],
      },
      {
        id: 'purpose',
        title: '4. เราใช้ข้อมูลเพื่ออะไร',
        blocks: [
          [
            'รับเรื่อง ติดตาม และแก้ไขปัญหาที่คุณแจ้ง',
            'ให้เจ้าหน้าที่ติดต่อหรือคุยกับคุณในแชทของคำร้อง',
            'ส่งงานซ่อมอาคารและอุปกรณ์ให้ฝ่ายซ่อมบำรุงดำเนินการ',
            'ให้ AI ช่วยแนะนำหมวดหมู่และความเร่งด่วน โดยคุณและเจ้าหน้าที่แก้ไขผลได้เสมอ',
            'ทำสถิติภาพรวมของระบบ เช่น จำนวนคำร้องต่อหมวด โดยไม่ระบุตัวบุคคล',
          ],
          'เราไม่ใช้ข้อมูลของคุณเพื่อการตลาด ไม่ขาย และไม่ใช้ตัดสินใจเรื่องใดเกี่ยวกับตัวคุณโดยอัตโนมัติ',
        ],
      },
      {
        id: 'basis',
        title: '5. ฐานทางกฎหมาย',
        blocks: [
          'เราใช้ข้อมูลตามความยินยอมของคุณ (มาตรา 19) และสำหรับข้อมูลอ่อนไหว ใช้ตามความยินยอมโดยชัดแจ้ง (มาตรา 26) คุณถอนความยินยอมได้ทุกเมื่อ',
        ],
      },
      {
        id: 'sharing',
        title: '6. ใครเห็นหรือได้รับข้อมูลของคุณ',
        blocks: [
          [
            'เจ้าหน้าที่ Helpdesk (admin) เห็นคำร้องทั้งหมดเพื่อทำงาน ผู้แจ้งคนอื่นเห็นคำร้องของคุณไม่ได้',
            'ฝ่ายซ่อมบำรุง (ทีม 10) ได้รับเฉพาะหัวข้อ รายละเอียด สถานที่ และประเภทงานซ่อม ของคำร้องหมวด Facility เจ้าหน้าที่ตรวจและลบข้อมูลส่วนตัวก่อนส่ง และไม่ส่งชื่อ อีเมล หรือเบอร์โทร',
            'ทีม Wellbeing (ทีม 16) ไม่ได้รับข้อมูลใด ๆ จากคำร้องของคุณ',
            'Cloudflare ผู้ให้บริการเซิร์ฟเวอร์ ฐานข้อมูล และ AI ประมวลผลแทนเรา (ผู้ประมวลผลข้อมูล) AI ได้รับเฉพาะข้อความของคำร้อง ไม่ได้รับชื่อหรืออีเมล',
          ],
          'เซิร์ฟเวอร์ของ Cloudflare อาจอยู่นอกประเทศไทย ผู้ให้บริการมีมาตรการคุ้มครองข้อมูลตามมาตรฐานสากล (มาตรา 28)',
        ],
      },
      {
        id: 'retention',
        title: '7. เก็บไว้นานแค่ไหน',
        blocks: [
          'เก็บตลอดเวลาที่คำร้องยังไม่ปิด และอีก 1 ปีหลังคำร้องได้รับการแก้ไข จากนั้นลบหรือทำให้ไม่สามารถระบุตัวตนได้ บันทึกการยินยอมเก็บไว้เป็นหลักฐานตามระยะเวลาเดียวกัน',
        ],
      },
      {
        id: 'rights',
        title: '8. สิทธิของคุณ',
        blocks: [
          [
            'ถอนความยินยอมเมื่อใดก็ได้ ที่หน้า "My profile" ง่ายเท่ากับตอนให้ความยินยอม',
            'ขอดูหรือขอสำเนาข้อมูลของคุณ',
            'แก้ไขชื่อและอีเมลได้เองที่หน้า "My profile" หรือขอให้แก้ข้อมูลอื่นที่ไม่ถูกต้อง',
            'ขอให้ลบ ระงับการใช้ หรือคัดค้านการใช้ข้อมูล',
            'ขอรับข้อมูลในรูปแบบที่อ่านได้ด้วยเครื่อง (สิทธิขอโอนย้ายข้อมูล)',
            'ร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (สคส.)',
          ],
          `ใช้สิทธิได้ที่ ${PRIVACY_CONTACT} เราจะตอบภายใน 30 วัน`,
        ],
      },
      {
        id: 'decline',
        title: '9. ถ้าไม่ยินยอม หรือถอนความยินยอม',
        blocks: [
          'คุณยังอ่านหน้านี้ได้ แต่จะแจ้งปัญหาผ่านระบบไม่ได้ เพราะเราต้องใช้ข้อมูลข้างต้นในการดูแลเรื่องของคุณ ติดต่อ Helpdesk ช่องทางอื่นได้ตามปกติ',
          'การถอนความยินยอมไม่กระทบสิ่งที่ทำไปแล้วก่อนถอน หากต้องการให้ลบคำร้องเดิม แจ้งที่อีเมลข้างต้น',
        ],
      },
      {
        id: 'security',
        title: '10. การรักษาความปลอดภัย',
        blocks: [
          'ระบบตรวจสิทธิ์ทุกครั้งที่เรียกข้อมูล ผู้แจ้งเห็นได้เฉพาะคำร้องของตัวเอง การรับส่งข้อมูลเข้ารหัสด้วย HTTPS และข้อมูลลับของระบบไม่ถูกเก็บในซอร์สโค้ด',
        ],
      },
      {
        id: 'changes',
        title: '11. การแก้ไขประกาศนี้',
        blocks: [
          'หากเราเปลี่ยนสาระสำคัญของประกาศ จะเพิ่มเลขฉบับ และขอให้คุณอ่านและยอมรับใหม่ก่อนใช้งานต่อ',
        ],
      },
    ],
    consent:
      'ฉันได้อ่านและเข้าใจประกาศความเป็นส่วนตัวนี้แล้ว และยินยอมให้ Helpdesk เก็บ ใช้ และเปิดเผยข้อมูลส่วนบุคคลของฉัน รวมถึงข้อมูลอ่อนไหวที่ฉันเลือกแจ้งเอง ตามวัตถุประสงค์ที่ระบุไว้',
  },

  en: {
    title: 'Privacy Notice',
    updated: `Version ${PRIVACY_NOTICE_VERSION} · last updated 10 November 2026`,
    summaryTitle: 'In short',
    summary: [
      'We keep only the name you choose, an optional contact email and what you report, and use them only to solve your issue.',
      'No passwords, no national ID numbers, no selling and no marketing.',
      'Repairs go to Maintenance with the title, description and location only, never your name or email.',
      'You can withdraw consent at any time on "My profile", and ask to see, correct or delete your data.',
    ],
    sections: [
      {
        id: 'controller',
        title: '1. Who is responsible for your data',
        blocks: [
          'The Helpdesk of University Digital Campus (Student Support Pod, Team 14) collects and looks after your data in this system.',
          `Privacy contact: ${PRIVACY_CONTACT}, or send a message in the Messages page of your ticket.`,
        ],
      },
      {
        id: 'data',
        title: '2. What we collect',
        blocks: [
          [
            'A display name you choose. It does not have to be your real name.',
            'A contact email (optional), used only to reach you. It is not used to sign in.',
            'Ticket content: subject, description, location (e.g. building, room), category and urgency.',
            'Chat messages between you and the Helpdesk team, and the ticket status history with dates and times.',
            'A record of which version of this notice you accepted or withdrew, and when.',
            'Data in your browser (localStorage / sessionStorage) that remembers you are signed in. No tracking or advertising cookies.',
          ],
          'We do not collect passwords, national ID numbers or financial data. Please do not put these, or other people’s personal details, in a ticket or chat.',
        ],
      },
      {
        id: 'sensitive',
        title: '3. Sensitive data (physical and mental health)',
        blocks: [
          'If you report a Wellbeing issue or describe a health matter, that is sensitive data under section 26 of the PDPA. We use it only to handle that ticket and suggest a suitable service, and we do not send the ticket details to the Wellbeing team (Team 16).',
          'Accepting this notice is your explicit consent for us to use sensitive data you choose to give, for this purpose only. If you do not want that, do not enter it.',
        ],
      },
      {
        id: 'purpose',
        title: '4. Why we use it',
        blocks: [
          [
            'To receive, track and solve the issue you report.',
            'So the Helpdesk team can contact you or chat with you on the ticket.',
            'To pass building and equipment repairs to Maintenance.',
            'So AI can suggest a category and urgency. You and the Helpdesk team can always change the result.',
            'For overall statistics, such as tickets per category, without identifying anyone.',
          ],
          'We do not use your data for marketing, we do not sell it, and we do not make automated decisions about you.',
        ],
      },
      {
        id: 'basis',
        title: '5. Legal basis',
        blocks: [
          'We rely on your consent (section 19), and on your explicit consent for sensitive data (section 26). You can withdraw it at any time.',
        ],
      },
      {
        id: 'sharing',
        title: '6. Who sees or receives your data',
        blocks: [
          [
            'Helpdesk administrators see all tickets in order to work on them. Other requesters cannot see yours.',
            'Maintenance (Team 10) receives only the subject, description, location and repair type of Facility tickets. An administrator checks and removes personal details first. Names, emails and phone numbers are never sent.',
            'The Wellbeing team (Team 16) receives nothing from your ticket.',
            'Cloudflare runs the servers, database and AI on our behalf (data processor). The AI receives only the ticket text, never your name or email.',
          ],
          'Cloudflare servers may be outside Thailand. The provider protects data to international standards (section 28).',
        ],
      },
      {
        id: 'retention',
        title: '7. How long we keep it',
        blocks: [
          'While the ticket is open and for 1 year after it is resolved. After that it is deleted or made anonymous. The consent record is kept as evidence for the same period.',
        ],
      },
      {
        id: 'rights',
        title: '8. Your rights',
        blocks: [
          [
            'Withdraw consent at any time on "My profile", as easily as you gave it.',
            'See your data or get a copy of it.',
            'Change your name and email yourself on "My profile", or ask us to correct anything else.',
            'Ask us to delete your data, restrict its use, or object to its use.',
            'Get your data in a machine-readable format (data portability).',
            'Complain to the Personal Data Protection Committee (PDPC) of Thailand.',
          ],
          `To use a right, write to ${PRIVACY_CONTACT}. We reply within 30 days.`,
        ],
      },
      {
        id: 'decline',
        title: '9. If you do not agree, or withdraw',
        blocks: [
          'You can still read this page, but you cannot report issues through this system, because we need the data above to handle them. You can still contact the Helpdesk in other ways.',
          'Withdrawing does not affect what was done before. To have earlier tickets deleted, write to the address above.',
        ],
      },
      {
        id: 'security',
        title: '10. Security',
        blocks: [
          'Access is checked on every request and requesters see only their own tickets. Data is sent over HTTPS, and system secrets are never stored in the source code.',
        ],
      },
      {
        id: 'changes',
        title: '11. Changes to this notice',
        blocks: [
          'If we change anything important, we raise the version number and ask you to read and accept it again before you continue.',
        ],
      },
    ],
    consent:
      'I have read and understood this privacy notice, and I agree that the Helpdesk may collect, use and disclose my personal data, including sensitive data I choose to give, for the purposes described.',
  },
};
