import fs from 'node:fs';
import path from 'node:path';

const senderDir = 'C:/Users/gana0/.gemini/antigravity/scratch/gmail-agent-sender';

// Exactly 50 verified leads
const leads = [
  { firm: 'Brewer, Attorneys & Counselors', name: 'William A. Brewer III', email: 'wab@brewerattorneys.com', city: 'Dallas', type: 'litigation' },
  { firm: 'Stephens Reed & Armstrong, PLLC', name: 'Jamarr M. Armstrong', email: 'jarmstrong@srapllc.com', city: 'Houston', type: 'employment' },
  { firm: 'Oliva Gibbs LLP', name: 'Zachary M. Oliva', email: 'zoliva@oglawyers.com', city: 'Houston', type: 'energy_title' },
  { firm: 'Elder Bray & Bankler PC', name: 'Matthew Bray', email: 'mbray@elderbray.com', city: 'San Antonio', type: 'venture_corp' },
  { firm: 'Gravely PC', name: 'Marc E. Gravely', email: 'mgravely@gravelylaw.com', city: 'San Antonio', type: 'construction' },
  { firm: 'The Snapka Law Firm', name: 'Kathryn Snapka', email: 'ksnapka@snapkalaw.com', city: 'Corpus Christi', type: 'litigation' },
  { firm: 'Muskat Devine LLP', name: 'Corey E. Devine', email: 'cdevine@muskatdevine.com', city: 'Houston', type: 'employment' },
  { firm: 'Allen Boone Humphries Robinson LLP', name: 'Stephen M. Robinson', email: 'srobinson@abhr.com', city: 'Houston', type: 'commercial' },
  { firm: 'Creedon PLLC', name: 'James Creedon', email: 'jcreedon@creedon.com', city: 'Frisco', type: 'patent' },
  { firm: 'Davis, Gerald & Cremer PC', name: 'Jacob M. Davidson', email: 'jdavidson@dgclaw.com', city: 'Midland', type: 'energy_title' },
  { firm: 'Dawson Springman', name: 'Alan Dawson', email: 'adawson@dawsonspringman.com', city: 'Midland', type: 'energy_title' },
  { firm: 'Hamm Law Group, PLLC', name: 'Morgan Hamm', email: 'mhamm@permianlaw.com', city: 'Midland', type: 'energy_title' },
  { firm: 'Bustos Law Firm, P.C.', name: 'Fernando M. Bustos', email: 'fbustos@bustoslawfirm.com', city: 'Lubbock', type: 'litigation' },
  { firm: 'Lovell, Isern & Farabough, LLP', name: 'John H. Lovell', email: 'jlovell@lovell-law.net', city: 'Amarillo', type: 'litigation' },
  { firm: 'McMahon Surovik Suttle, P.C.', name: 'Kelly Gill', email: 'kgill@mss.law', city: 'Abilene', type: 'commercial' },
  { firm: 'Barrera, Sanchez & Associates, P.C.', name: 'Marcus C. Barrera', email: 'marcus@barrerasanchez.com', city: 'McAllen', type: 'commercial' },
  { firm: 'Omar Ochoa Law Firm', name: 'Omar Ochoa', email: 'omar@omarochoalaw.com', city: 'McAllen', type: 'litigation' },
  { firm: 'J Cruz Law Firm', name: 'Juan J. Cruz', email: 'jcruz@jca-law.com', city: 'Laredo', type: 'commercial' },
  { firm: 'Ebadat PLLC', name: 'Nima Ebadat', email: 'nebadat@ebadatlaw.com', city: 'Austin', type: 'venture_corp' },
  { firm: 'Stephenson Fournier', name: 'Juli Fournier', email: 'jfournier@stephensonlaw.com', city: 'Houston', type: 'commercial' },
  { firm: 'The McLauchlan Law Group of Texas, PLLC', name: 'Peter A. McLauchlan', email: 'pmclauchlan@mclawglobal.com', city: 'Houston', type: 'commercial' },
  { firm: 'Nichols Weitzner Thomas LLP', name: 'Scott Nichols', email: 'snichols@nwtlaw.com', city: 'Houston', type: 'commercial' },
  { firm: 'Houston Law PLLC', name: 'Sam Houston', email: 'sam@shoustonlaw.com', city: 'Houston', type: 'commercial' },
  { firm: 'Clausewitz Reyes, PLLC', name: 'Shellie Reyes', email: 'sreyes@clausewitzreyes.com', city: 'San Antonio', type: 'litigation' },
  { firm: 'Enoch Kever PLLC', name: 'Craig T. Enoch', email: 'cenoch@enochkever.com', city: 'Austin', type: 'litigation' },
  { firm: 'Dorsett Johnson & Cisneros LLP', name: 'J.C. Johnson', email: 'jcjohnson@dorsettjohnson.com', city: 'Fort Worth', type: 'commercial' },
  { firm: 'RattikinLaw Fort Worth', name: 'Jeffrey A. Rattikin', email: 'jeff@rattikinlaw.com', city: 'Fort Worth', type: 'commercial' },
  { firm: 'West, Webb, Allbritton & Gentry, P.C.', name: 'Michael Gentry', email: 'mgentry@westwebblaw.com', city: 'College Station', type: 'commercial' },
  { firm: 'BSJ Law Group, PLLC', name: 'Brian S. Jacob', email: 'bjacob@bsjlawgroup.com', city: 'Waco', type: 'construction' },
  { firm: 'Lovein Ribman, P.C.', name: 'Robert M. Lovein', email: 'rlovein@loveinribman.com', city: 'Dallas', type: 'construction' },
  { firm: 'Forshee, PLLC', name: 'B. Jason Forshee', email: 'jason@forsheelaw.com', city: 'Dallas', type: 'venture_corp' },
  { firm: 'Peters Kussmaul Crosier PLLC', name: 'Drew T. Peters', email: 'drew@pkclegal.com', city: 'Dallas', type: 'venture_corp' },
  { firm: 'Platt Richmond PLLC', name: 'Steven Dimitt', email: 'sdimitt@plattrichmond.com', city: 'Dallas', type: 'commercial' },
  { firm: 'Thurman & Phillips, P.C.', name: 'Michael B. Thurman', email: 'mthurman@thurmanphillips.com', city: 'San Antonio', type: 'commercial' },
  { firm: 'Dwyer Murphy Calvert LLP', name: 'Patrick L. Dwyer', email: 'pdwyer@dmc-law.com', city: 'Austin', type: 'venture_corp' },
  { firm: 'Blizzard & Zimmerman Attorneys', name: 'Jacob Blizzard', email: 'jacob@blizzardlawfirm.com', city: 'Abilene', type: 'litigation' },
  { firm: 'PMBG Law', name: 'David Morales', email: 'dmorales@pmbglaw.com', city: 'Laredo', type: 'commercial' },
  { firm: 'Rodgers, Miller, Rodriguez & Fusco, P.C.', name: 'Dudley Rodgers', email: 'drodgers@rodgersmiller.com', city: 'Bryan', type: 'commercial' },
  { firm: 'Mier Law, PLLC', name: 'Brad Mier', email: 'bmier@mierlaw.com', city: 'Dallas', type: 'commercial' },
  { firm: 'Roberts & Willie, PLLC', name: 'Mark Roberts', email: 'mroberts@robertsandwillie.com', city: 'Dallas', type: 'commercial' },
  { firm: 'Scheuerman Law Firm PLLC', name: 'Hella Scheuerman', email: 'hella@sch-lawfirm.com', city: 'San Antonio', type: 'commercial' },
  { firm: 'Mousilli Legal Group PLLC', name: 'Feras Mousilli', email: 'feras@mousillilegal.com', city: 'Austin', type: 'patent' },
  { firm: 'pH IP Law PLLC', name: 'Amanda Schnepp', email: 'aschnepp@phiplaw.com', city: 'Austin', type: 'patent' },
  { firm: 'Williams Simons & Landis PC', name: 'Fred I. Williams', email: 'fwilliams@wsltrial.com', city: 'Austin', type: 'patent' },
  { firm: 'Alliance IP', name: 'Ross Culpepper', email: 'rculpepper@allianceip.com', city: 'Austin', type: 'patent' },
  { firm: 'Altum Legal', name: 'Austin Harms', email: 'austin@altumlegal.com', city: 'Austin', type: 'venture_corp' },
  { firm: 'Sprinkle IP Law Group, PC', name: 'Steven Sprinkle', email: 'steve@sprinklelaw.com', city: 'Austin', type: 'patent' },
  { firm: 'Law Offices of Ramon Garcia', name: 'Ramon Garcia', email: 'rgarcia@ramongarcia-law.com', city: 'McAllen', type: 'litigation' },
  { firm: 'Law Office of Silverio Martinez', name: 'Silverio Martinez', email: 'smartinez@silveriomartinezlaw.com', city: 'Laredo', type: 'commercial' },
  { firm: 'Hance Scarborough, LLP', name: 'Kent R. Hance', email: 'khance@hancelaw.com', city: 'Austin', type: 'commercial' }
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
  if (firstWord.toLowerCase() === 'the') {
    firstWord = firm.trim().split(/\s+/)[1];
  }
  return firstWord.replace(/[,;.]/g, '');
}

const leadsWithCopy = leads.map(lead => {
  let firstName = cleanFirstName(lead.name);
  if (lead.email === 'wab@brewerattorneys.com') firstName = 'William';
  if (lead.email === 'jason@forsheelaw.com') firstName = 'Jason';
  if (lead.email === 'jcjohnson@dorsettjohnson.com') firstName = 'JC';

  const firmShort = cleanFirmName(lead.firm);
  let subject = '';
  let body = '';

  if (lead.type === 'energy_title') {
    subject = `Permian title workflows - ${firmShort}?`;
    body = `Hi ${firstName},

Preparing drilling title opinions and division order runs leaves deal teams chasing outstanding curative instruments and compiling closing binders manually.

We engineered a secure document workflow that tracks title defects, extracts county deed filings, and compiles indexed closing binders automatically.

Worth a quick 3-minute glance this week?

Best,
Ganesh`;
  } else if (lead.type === 'litigation') {
    subject = `Trial exhibit indexing - ${firmShort}?`;
    body = `Hi ${firstName},

Prepping high-stakes commercial trials in Texas state and federal courts ties up associates cross-referencing multi-terabyte productions and transcript citations under extreme time pressure.

We built a private pipeline that extracts deposition keywords, flags trial exhibit inconsistencies, and generates hyperlinked examination outlines in minutes.

Open to a 3-minute glance this week?

Best,
Ganesh`;
  } else if (lead.type === 'patent') {
    subject = `Patent docket workflows - ${firmShort}?`;
    body = `Hi ${firstName},

Managing high-volume USPTO office actions and patent filings creates constant risk of missed priority dates and administrative docketing bottlenecks.

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

Tracking strict statutory mechanic's lien notice deadlines across Texas county clerk filings leaves paralegals manually calculating trapped fund dates.

We built an automation that validates statutory notice windows against project completion dates and generates compliant Texas property code filings automatically.

Worth a quick 3-minute glance this week?

Best,
Ganesh`;
  } else if (lead.type === 'employment') {
    subject = `EEOC docket workflows - ${firmShort}?`;
    body = `Hi ${firstName},

Managing workplace disputes and restrictive covenant suits ties up paralegals cross-referencing payroll records and tracking strict EEOC right-to-sue windows.

We built a private automation that indexes wage productions, flags charge filing deadlines, and syncs status reports directly to practice management.

Open to a brief 3-minute look this week?

Best,
Ganesh`;
  } else {
    // commercial / general
    subject = `Docket deadline tracking - ${firmShort}?`;
    body = `Hi ${firstName},

Coordinating high-volume commercial disputes across Texas courts creates constant pressure tracking strict discovery responses and expert designation deadlines.

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

const targetCsv = path.join(senderDir, 'contacts_day14_verified_50.csv');
fs.writeFileSync(targetCsv, csvLines.join('\n') + '\n', 'utf-8');

console.log(`🎉 Generated contacts_day14_verified_50.csv with ${leadsWithCopy.length} pristine leads!`);
console.log(`Path: ${targetCsv}`);
console.log('Sample Lead 1:', leadsWithCopy[0]);
console.log('Sample Lead 50:', leadsWithCopy[49]);
