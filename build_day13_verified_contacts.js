import fs from 'node:fs';
import path from 'node:path';

const senderDir = 'C:/Users/gana0/.gemini/antigravity/scratch/gmail-agent-sender';

const leads = [
  { firm: 'Steptoe & Johnson', name: 'Monté L. Williams', email: 'monte.williams@steptoe-johnson.com', city: 'Woodlands', type: 'energy_corp' },
  { firm: 'Dinsmore & Shohl', name: 'Sarah R. Smith', email: 'sarah.smith@dinsmore.com', city: 'Houston', type: 'litigation' },
  { firm: 'Dorsey & Whitney', name: 'Robert Hale', email: 'hale.robert@dorsey.com', city: 'Dallas', type: 'venture_corp' },
  { firm: 'Stinson LLP', name: 'Paul Lackey', email: 'paul.lackey@stinson.com', city: 'Dallas', type: 'litigation' },
  { firm: 'Bonds Ellis', name: 'Christian Ellis', email: 'cellis@bondsellis.com', city: 'Fort Worth', type: 'commercial' },
  { firm: 'Reese Marketos', name: 'Pete Marketos', email: 'pete.marketos@rm-firm.com', city: 'Dallas', type: 'litigation' },
  { firm: 'McDowell Hetherington', name: 'David McDowell', email: 'david.mcdowell@mhllp.com', city: 'Houston', type: 'commercial' },
  { firm: 'Looper Goodwine', name: 'Donald Looper', email: 'dlooper@loopergoodwine.com', city: 'Houston', type: 'energy_title' },
  { firm: 'West Mermis', name: 'Lawrence West', email: 'lwest@westmermis.com', city: 'Houston', type: 'construction' },
  { firm: 'The Fowler Law Firm', name: 'Laura Fowler', email: 'lfowler@thefowlerlawfirm.com', city: 'Austin', type: 'commercial' },
  { firm: 'Patterson + Sheridan', name: 'B. Todd Patterson', email: 'tpatterson@pattersonsheridan.com', city: 'Houston', type: 'patent' },
  { firm: 'Boulware & Valoir', name: 'Meg Boulware', email: 'mboulware@boulwarevaloir.com', city: 'Houston', type: 'patent' },
  { firm: 'Egan Nelson', name: 'Shane M. Egan', email: 'shane.egan@egannelson.com', city: 'Austin', type: 'venture_corp' },
  { firm: 'The Cromeens Law Firm', name: 'Karalynn Cromeens', email: 'kcromeens@thecromeenslawfirm.com', city: 'Houston', type: 'construction' },
  { firm: 'Heim, Payne & Chorush', name: 'Russell Chorush', email: 'rchorush@hpcllp.com', city: 'Houston', type: 'litigation' },
  { firm: 'Reid Collins & Tsai', name: 'William T. Reid IV', email: 'wreid@reidcollins.com', city: 'Austin', type: 'litigation' },
  { firm: 'Santoyo Wehmeyer', name: 'Corey Frank Wehmeyer', email: 'cwehmeyer@swenergylaw.com', city: 'San Antonio', type: 'energy_title' },
  { firm: 'Kearney, McWilliams & Davis', name: 'Scott C. Kearney', email: 'skearney@kmd.law', city: 'Houston', type: 'energy_title' },
  { firm: 'ByrdAdatto', name: 'Bradford Adatto', email: 'badatto@byrdadatto.com', city: 'Dallas', type: 'commercial' },
  { firm: 'Leon Alcala', name: 'Sara Leon', email: 'sleon@leonalcala.com', city: 'Austin', type: 'commercial' },
  { firm: 'McCall, Parkhurst & Horton', name: 'Mark Malveaux', email: 'mmalveaux@mphlegal.com', city: 'Dallas', type: 'commercial' },
  { firm: 'Farrow-Gillespie Heath Wilmoth', name: 'Chris Wilmoth', email: 'chris.wilmoth@fghwlaw.com', city: 'Dallas', type: 'commercial' },
  { firm: 'Riddle & Butts', name: 'Christine Butts', email: 'christine@riddlebutts.com', city: 'Spring', type: 'commercial' },
  { firm: 'Law Offices of David Berg', name: 'David Berg', email: 'dberg@bafirm.com', city: 'Houston', type: 'litigation' },
  { firm: 'KHMR&G', name: 'Eric Meyertons', email: 'emeyertons@intprop.com', city: 'Austin', type: 'patent' },
  { firm: 'Sadler Law Group', name: 'Randall K. Sadler', email: 'rsadler@sadlerlaw.com', city: 'Houston', type: 'energy_title' },
  { firm: 'Kuiper Law Firm', name: 'Alex Kuiper', email: 'alex.kuiper@kuiperlawfirm.com', city: 'Houston', type: 'energy_title' },
  { firm: 'Mazurek, Belden & Burke', name: 'Thomas Chance Mazurek IV', email: 'cmazurek@mbb-legal.com', city: 'San Antonio', type: 'energy_title' },
  { firm: 'Vedder Price', name: 'William Kummerer', email: 'wkummerer@vedder.com', city: 'Dallas', type: 'commercial' },
  { firm: 'Mitchell Williams', name: 'Burnie Burner', email: 'bburner@mwlaw.com', city: 'Austin', type: 'commercial' },
  { firm: 'Gjerset & Lorenz', name: 'Jim Gjerset', email: 'gjerset@gl-law.com', city: 'Austin', type: 'commercial' },
  { firm: 'Brock Guerra Strandmo', name: 'John A. Guerra', email: 'jguerra@brock.law', city: 'San Antonio', type: 'commercial' },
  { firm: 'Cotton, Bledsoe, Tighe & Dawson', name: 'William E. Berry Jr.', email: 'wberry@cbtd.com', city: 'Midland', type: 'energy_title' },
  { firm: 'ScottHulse PC', name: 'Francisco J. Ortega', email: 'fort@scotthulse.com', city: 'El Paso', type: 'litigation' },
  { firm: 'Pakis, Giotes, Burleson', name: 'David N. Deaconson', email: 'deaconson@pakislaw.com', city: 'Waco', type: 'commercial' },
  { firm: 'Calvert & Associates', name: 'T. Marc Calvert', email: 'marc.calvert@calvertfirm.com', city: 'Cypress', type: 'litigation' },
  { firm: 'Michael Best & Friedrich', name: 'Aaron W. Barker', email: 'aaron.barker@michaelbest.com', city: 'Austin', type: 'venture_corp' },
  { firm: 'Liskow & Lewis', name: 'Michael A. Golemi', email: 'magolemi@liskow.com', city: 'Houston', type: 'commercial' },
  { firm: 'Gordon Arata', name: 'Adam J. Russ', email: 'aruss@gordonarata.com', city: 'Houston', type: 'energy_title' },
  { firm: 'Brown Sims', name: 'Robert M. Browning', email: 'rbrowning@brownsims.com', city: 'Houston', type: 'commercial' },
  { firm: 'Freeman Mills', name: 'Jason R. Mills', email: 'jmills@freemanmillspc.com', city: 'Dallas', type: 'energy_title' },
  { firm: 'Linebarger Goggan Blair & Sampson', name: 'Clifton F. Douglass III', email: 'clif.douglass@lgbs.com', city: 'San Antonio', type: 'commercial' },
  { firm: 'FordHarrison', name: 'David R. Anderson', email: 'danderson@fordharrison.com', city: 'Dallas', type: 'employment' },
  { firm: 'RashChapman LLP', name: 'Richard L. Morrison', email: 'rmorrison@rashchapman.com', city: 'Austin', type: 'energy_title' },
  { firm: 'Zukowski, Bresenhan & Piazza, L.L.P.', name: 'Pascal P. Piazza', email: 'ppp@zbplaw.com', city: 'Houston', type: 'litigation' },
  { firm: 'Stewart Law Group PLLC', name: 'Amy M. Stewart', email: 'astewart@stewartlawgrp.com', city: 'Dallas', type: 'employment' },
  { firm: 'Waters Kraus Paul & Siegel', name: 'Peter A. Kraus', email: 'kraus@waterskraus.com', city: 'Dallas', type: 'litigation' },
  { firm: 'Botkin Chiarello Calaf PLLC', name: 'Asra Syed', email: 'asra@bccaustin.com', city: 'Austin', type: 'litigation' },
  { firm: 'Vartabedian Katz Hester & Haynes LLP', name: 'Conrad Daniel Hester', email: 'conrad.hester@vkhh.com', city: 'Fort Worth', type: 'litigation' },
  { firm: 'Bailey Brauer PLLC', name: 'Clayton Bailey', email: 'cbailey@baileybrauer.com', city: 'Dallas', type: 'litigation' }
];

function cleanFirstName(name) {
  let clean = name.trim().replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.)\s*/i, '');
  const parts = clean.split(/\s+/);
  if (parts.length > 1 && /^[A-Z]\.?$/i.test(parts[0])) {
    return parts[1].replace(/[.,]/g, '');
  }
  return parts[0].replace(/[.,]/g, '');
}

function cleanFirmName(firm) {
  let firstWord = firm.trim().split(/\s+/)[0];
  return firstWord.replace(/[,;.]/g, '');
}

const leadsWithCopy = leads.map(lead => {
  let firstName = cleanFirstName(lead.name);
  if (lead.email === 'hale.robert@dorsey.com') firstName = 'Robert';
  if (lead.email === 'cmazurek@mbb-legal.com') firstName = 'Chance';
  if (lead.email === 'fort@scotthulse.com') firstName = 'Francisco';
  if (lead.email === 'clif.douglass@lgbs.com') firstName = 'Clifton';
  if (lead.email === 'rmorrison@rashchapman.com') firstName = 'Rick';

  const firmShort = cleanFirmName(lead.firm);
  let subject = '';
  let body = '';

  if (lead.type === 'energy_title') {
    subject = `Title curative workflows - ${firmShort}?`;
    body = `Hi ${firstName},

Preparing mineral run sheets and drilling title opinions leaves deal teams chasing outstanding curative instruments and compiling closing binders manually.

We engineered a secure document workflow that tracks title defects, extracts county deed filings, and compiles indexed closing binders automatically.

Worth a quick 3-minute glance this week?

Best,
Ganesh`;
  } else if (lead.type === 'litigation') {
    subject = `Trial exhibit indexing - ${firmShort}?`;
    body = `Hi ${firstName},

Prepping high-stakes commercial trials in Texas courts ties up associates cross-referencing multi-terabyte productions and transcript citations under extreme time pressure.

We built a private pipeline that extracts deposition keywords, flags trial exhibit inconsistencies, and generates hyperlinked examination outlines in minutes.

Open to a 3-minute glance this week?

Best,
Ganesh`;
  } else if (lead.type === 'patent') {
    subject = `Patent docket workflows - ${firmShort}?`;
    body = `Hi ${firstName},

Managing high-volume USPTO office actions and foreign patent filings creates constant risk of missed priority dates and administrative docketing bottlenecks.

We built an automation that scans USPTO notices, extracts response deadlines, and updates docketing calendars automatically without human re-entry.

Worth a brief 3-minute look this week?

Best,
Ganesh`;
  } else if (lead.type === 'venture_corp') {
    subject = `Venture closing binders - ${firmShort}?`;
    body = `Hi ${firstName},

Closing fast-paced venture financings and acquisitions involves heavy coordination tracking investor signature packets and updating capitalization trackers.

We deployed an n8n automation that audits NVCA closing checklists, syncs investor signature pages, and compiles indexed transaction binders automatically.

Worth a brief 3-minute preview this week?

Best,
Ganesh`;
  } else if (lead.type === 'construction') {
    subject = `Lien filing workflows - ${firmShort}?`;
    body = `Hi ${firstName},

Tracking strict statutory mechanic's lien notice deadlines across Texas county clerk filings leaves paralegals manually calculating trapped fund trapping dates.

We built an automation that validates statutory notice windows against project completion dates and generates compliant Texas property code filings automatically.

Worth a quick 3-minute glance this week?

Best,
Ganesh`;
  } else if (lead.type === 'employment') {
    subject = `EEOC docket workflows - ${firmShort}?`;
    body = `Hi ${firstName},

Managing multi-plaintiff workplace disputes and restrictive covenant suits ties up paralegals cross-referencing payroll records and tracking strict EEOC right-to-sue windows.

We built a private automation that indexes wage productions, flags charge filing deadlines, and syncs status reports directly to practice management.

Open to a brief 3-minute look this week?

Best,
Ganesh`;
  } else {
    // commercial / general
    subject = `Docket deadline tracking - ${firmShort}?`;
    body = `Hi ${firstName},

Coordinating complex commercial matters and regulatory dockets creates constant pressure tracking strict discovery responses and expert designation deadlines.

We engineered a private automation that scans court docket filings, validates statutory cutoff dates against local county rules, and syncs calendar alerts automatically.

Open to a brief 3-minute look this week?

Best,
Ganesh`;
  }

  return {
    email: lead.email,
    subject,
    body,
    status: 'pending',
    sent_at: '',
    in_reply_to: ''
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

const headers = ['email', 'subject', 'body', 'status', 'sent_at', 'in_reply_to'];
const rows = [
  headers.join(','),
  ...leadsWithCopy.map(r => [
    escapeCSVField(r.email),
    escapeCSVField(r.subject),
    escapeCSVField(r.body),
    escapeCSVField(r.status),
    escapeCSVField(r.sent_at),
    escapeCSVField(r.in_reply_to)
  ].join(','))
];

const csvContent = rows.join('\n');
const targetPath = path.join(senderDir, 'contacts_day13_verified_50.csv');
fs.writeFileSync(targetPath, csvContent, 'utf-8');

console.log(`Generated ${leadsWithCopy.length} contacts in: ${targetPath}`);

// Verification
let maxWords = 0;
let maxSubjectWords = 0;
let violations = 0;

leadsWithCopy.forEach((lead, i) => {
  const bodyWords = lead.body.trim().split(/\s+/).length;
  const subjWords = lead.subject.trim().split(/\s+/).length;
  if (bodyWords > maxWords) maxWords = bodyWords;
  if (subjWords > maxSubjectWords) maxSubjectWords = subjWords;

  if (bodyWords > 65) {
    console.error(`[VIOLATION] Row ${i+1} body words: ${bodyWords}`);
    violations++;
  }
  if (subjWords > 5) {
    console.error(`[VIOLATION] Row ${i+1} subject words: ${subjWords}`);
    violations++;
  }
  if (!lead.body.startsWith('Hi ')) {
    console.error(`[VIOLATION] Row ${i+1} salutation: ${lead.body.slice(0, 10)}`);
    violations++;
  }
  if (!lead.body.endsWith('Best,\nGanesh')) {
    console.error(`[VIOLATION] Row ${i+1} sign-off`);
    violations++;
  }
  if (lead.body.includes('http://') || lead.body.includes('https://') || lead.body.includes('www.')) {
    console.error(`[VIOLATION] Row ${i+1} contains link`);
    violations++;
  }
});

console.log(`Total violations: ${violations}`);
console.log(`Max body word count: ${maxWords} (limit: 65)`);
console.log(`Max subject word count: ${maxSubjectWords} (limit: 5)`);
