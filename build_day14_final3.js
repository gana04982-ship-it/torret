import fs from 'node:fs';
import path from 'node:path';

const senderDir = 'C:/Users/gana0/.gemini/antigravity/scratch/gmail-agent-sender';

const leads = [
  {
    firm: 'Drenner Group',
    firstName: 'Steve',
    firmShort: 'Drenner',
    email: 'sdrenner@drennergroup.com',
    type: 'commercial'
  },
  {
    firm: 'Liles Parker PLLC',
    firstName: 'Robert',
    firmShort: 'Liles Parker',
    email: 'rliles@lilesparker.com',
    type: 'commercial'
  },
  {
    firm: 'Barton Law',
    firstName: 'Matt',
    firmShort: 'Barton',
    email: 'matt@bartonfirm.com',
    type: 'litigation'
  }
];

const leadsWithCopy = leads.map(lead => {
  const { firstName, firmShort, email, type } = lead;
  let subject = '';
  let body = '';

  if (type === 'litigation') {
    subject = `Trial exhibits - ${firmShort}?`;
    body = `Hi ${firstName},

Prepping high-stakes commercial trials in Texas state and federal courts ties up associates cross-referencing multi-terabyte productions and transcript citations under extreme time pressure.

We built a private pipeline that extracts deposition keywords, flags trial exhibit inconsistencies, and generates hyperlinked examination outlines in minutes.

Open to a 3-minute glance this week?

Best,
Ganesh`;
  } else {
    subject = `Docket tracking - ${firmShort}?`;
    body = `Hi ${firstName},

Coordinating high-volume commercial disputes across Texas courts creates constant pressure tracking strict discovery responses and expert designation deadlines.

We engineered a private automation that scans court docket filings, validates statutory cutoff dates against local county rules, and syncs calendar alerts automatically.

Open to a brief 3-minute look this week?

Best,
Ganesh`;
  }

  // Word count validations
  const subWords = subject.trim().split(/\s+/).length;
  const bodyWords = body.trim().split(/\s+/).length;
  if (subWords > 5) {
    throw new Error(`Subject too long (${subWords} words): "${subject}"`);
  }
  if (bodyWords > 65) {
    throw new Error(`Body too long (${bodyWords} words) for ${email}`);
  }

  return {
    email,
    subject,
    body,
    status: 'pending',
    sent_at: ''
  };
});

function escapeCSVField(str) {
  if (str == null) return '';
  const s = String(str);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const headers = ['email', 'subject', 'body', 'status', 'sent_at'];
const csvLines = [
  headers.join(','),
  ...leadsWithCopy.map(l => [
    escapeCSVField(l.email),
    escapeCSVField(l.subject),
    escapeCSVField(l.body),
    escapeCSVField(l.status),
    escapeCSVField(l.sent_at)
  ].join(','))
];

const targetCsv = path.join(senderDir, 'contacts_day14_final3.csv');
fs.writeFileSync(targetCsv, csvLines.join('\n') + '\n', 'utf-8');

console.log(`🎉 Successfully generated contacts_day14_final3.csv with ${leadsWithCopy.length} pristine leads!`);
leadsWithCopy.forEach((l, idx) => {
  const subW = l.subject.trim().split(/\s+/).length;
  const bodyW = l.body.trim().split(/\s+/).length;
  console.log(`${idx + 1}. ${l.email} | Subj (${subW}w): "${l.subject}" | Body: ${bodyW}w`);
});
