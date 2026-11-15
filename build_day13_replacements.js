import fs from 'node:fs';
import path from 'node:path';

const senderDir = 'C:/Users/gana0/.gemini/antigravity/scratch/gmail-agent-sender';

const replacements = [
  {
    name: 'Christine E. Reinhard',
    email: 'creinhard@fennemorelaw.com',
    firm: 'Fennemore',
    subject: 'EEOC docket workflows - Fennemore?',
    body: `Hi Christine,

Managing multi-plaintiff workplace disputes and restrictive covenant suits ties up paralegals cross-referencing payroll records and tracking strict EEOC right-to-sue windows.

We built a private automation that indexes wage productions, flags charge filing deadlines, and syncs status reports directly to practice management.

Open to a brief 3-minute look this week?

Best,
Ganesh`
  },
  {
    name: 'Ken Bullock',
    email: 'kbullock@fbtlaw.com',
    firm: 'Frost Brown Todd',
    subject: 'Trial exhibit indexing - Frost?',
    body: `Hi Ken,

Prepping high-stakes commercial trials in Texas courts ties up associates cross-referencing multi-terabyte productions and transcript citations under extreme time pressure.

We built a private pipeline that extracts deposition keywords, flags trial exhibit inconsistencies, and generates hyperlinked examination outlines in minutes.

Open to a 3-minute glance this week?

Best,
Ganesh`
  }
];

function escapeCSVField(str) {
  if (str == null) return '';
  const s = String(str);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const headers = ['email', 'subject', 'body', 'status', 'sent_at', 'in_reply_to'];
const rows = [
  headers.join(','),
  ...replacements.map(r => [
    escapeCSVField(r.email),
    escapeCSVField(r.subject),
    escapeCSVField(r.body),
    escapeCSVField('pending'),
    escapeCSVField(''),
    escapeCSVField('')
  ].join(','))
];

const csvContent = rows.join('\n');
const targetPath = path.join(senderDir, 'contacts_day13_replacements.csv');
fs.writeFileSync(targetPath, csvContent, 'utf-8');

console.log(`Generated ${replacements.length} replacements in: ${targetPath}`);

// Verification
replacements.forEach((lead, i) => {
  const bodyWords = lead.body.trim().split(/\s+/).length;
  const subjWords = lead.subject.trim().split(/\s+/).length;
  console.log(`Lead ${i+1}: ${lead.email} | Subj words: ${subjWords} | Body words: ${bodyWords}`);
  if (bodyWords > 65) console.error(`[VIOLATION] Body word count: ${bodyWords}`);
  if (subjWords > 5) console.error(`[VIOLATION] Subj word count: ${subjWords}`);
});
