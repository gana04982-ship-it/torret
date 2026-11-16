import fs from 'node:fs';
import path from 'node:path';

const senderDir = 'C:/Users/gana0/.gemini/antigravity/scratch/gmail-agent-sender';
const brainScratch = 'C:/Users/gana0/.gemini/antigravity/brain/bc622bf4-8573-4029-b5e1-1d0c764c5a6d/scratch';

const contactedDomains = new Set(JSON.parse(fs.readFileSync(path.join(brainScratch, 'contacted_domains.json'), 'utf8')).map(d => d.toLowerCase().trim()));
const contactedEmails = new Set(JSON.parse(fs.readFileSync(path.join(brainScratch, 'all_contacted_emails.json'), 'utf8')).map(e => e.toLowerCase().trim()));
const suppressionList = new Set(JSON.parse(fs.readFileSync(path.join(brainScratch, 'suppression_list.json'), 'utf8')).map(s => (typeof s === 'string' ? s : s.email || '').toLowerCase().trim()));

const replacements = [
  { firm: 'Lewis Roca', firstName: 'Alfonso', firmShort: 'Lewis Roca', email: 'alopez@lewisroca.com', type: 'commercial' },
  { firm: 'Snell & Wilmer', firstName: 'Tracy', firmShort: 'Snell', email: 'tolson@swlaw.com', type: 'commercial' },
  { firm: 'Armstrong Teasdale', firstName: 'Danica', firmShort: 'Armstrong', email: 'dmathes@atllp.com', type: 'commercial' },
  { firm: 'Buchanan Ingersoll & Rooney', firstName: 'Bruce', firmShort: 'Buchanan', email: 'bruce.oakley@bipc.com', type: 'litigation' },
  { firm: 'Benesch', firstName: 'Michael', firmShort: 'Benesch', email: 'mstrug@beneschlaw.com', type: 'commercial' },
  { firm: 'Honigman LLP', firstName: 'Donald', firmShort: 'Honigman', email: 'dbaty@honigman.com', type: 'commercial' },
  { firm: 'Fish & Richardson', firstName: 'David', firmShort: 'Fish', email: 'hoffman@fr.com', type: 'patent' },
  { firm: 'Cooley LLP', firstName: 'Rachel', firmShort: 'Cooley', email: 'rthorn@cooley.com', type: 'venture_corp' },
  { firm: 'Akin Gump', firstName: 'Scott', firmShort: 'Akin', email: 'sbarnard@akingump.com', type: 'litigation' },
  { firm: 'Paul, Weiss', firstName: 'Sean', firmShort: 'Paul Weiss', email: 'swheeler@paulweiss.com', type: 'venture_corp' },
  { firm: 'A&O Shearman', firstName: 'Samuel', firmShort: 'Shearman', email: 'samuel.cooper@aoshearman.com', type: 'litigation' },
  { firm: 'Lathrop GPM', firstName: 'Robert', firmShort: 'Lathrop', email: 'robert.lord@lathropgpm.com', type: 'commercial' },
  { firm: 'Carter Arnett', firstName: 'Leon', firmShort: 'Carter Arnett', email: 'lcarter@carterarnett.com', type: 'litigation' },
  { firm: 'Dechert LLP', firstName: 'Lindsey', firmShort: 'Dechert', email: 'lindsey.cohan@dechert.com', type: 'litigation' },
  { firm: 'Steptoe LLP', firstName: 'David', firmShort: 'Steptoe', email: 'disaak@steptoe.com', type: 'commercial' },
  { firm: 'Mayer LLP', firstName: 'Michael', firmShort: 'Mayer', email: 'mmayer@mayerllp.com', type: 'litigation' }
];

console.log(`Checking ${replacements.length} replacement leads against registries...`);

for (const r of replacements) {
  const domain = r.email.split('@')[1].toLowerCase().trim();
  const email = r.email.toLowerCase().trim();
  if (contactedDomains.has(domain)) {
    throw new Error(`Domain collision in replacements: ${domain}`);
  }
  if (contactedEmails.has(email)) {
    throw new Error(`Email collision in replacements: ${email}`);
  }
  if (suppressionList.has(email)) {
    throw new Error(`Suppression collision in replacements: ${email}`);
  }
}

console.log('All 16 replacements cleared collision checks!');

const leadsWithCopy = replacements.map(lead => {
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
  } else if (type === 'patent') {
    subject = `Patent docketing - ${firmShort}?`;
    body = `Hi ${firstName},

Managing high-volume USPTO office actions and patent filings creates constant risk of missed priority dates and administrative docketing bottlenecks.

We built an automation that scans USPTO notices, extracts response deadlines, and updates docketing calendars automatically without human re-entry.

Worth a brief 3-minute look this week?

Best,
Ganesh`;
  } else if (type === 'venture_corp') {
    subject = `Closing binders - ${firmShort}?`;
    body = `Hi ${firstName},

Closing fast-paced venture financings and acquisitions involves heavy coordination tracking investor signature packets and updating capitalization trackers.

We deployed an n8n automation that audits NVCA closing checklists, syncs investor signature pages, and compiles indexed transaction binders automatically.

Worth a brief 3-minute preview this week?

Best,
Ganesh`;
  } else {
    // commercial / general
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

const targetCsv = path.join(senderDir, 'contacts_day14_replacements.csv');
fs.writeFileSync(targetCsv, csvLines.join('\n') + '\n', 'utf-8');

console.log(`🎉 Successfully generated contacts_day14_replacements.csv with ${leadsWithCopy.length} pristine leads!`);
console.log(`Path: ${targetCsv}`);
leadsWithCopy.forEach((l, idx) => {
  const subW = l.subject.trim().split(/\s+/).length;
  const bodyW = l.body.trim().split(/\s+/).length;
  console.log(`${idx + 1}. ${l.email} | Subj (${subW}w): "${l.subject}" | Body: ${bodyW}w`);
});
