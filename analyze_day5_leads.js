import fs from 'node:fs';

const content = fs.readFileSync('load_day5_leads.js', 'utf8');
const regex = /email:\s*['"]([^'"]+)['"]/g;
const emails = [];
let m;
while ((m = regex.exec(content)) !== null) {
  emails.push(m[1].toLowerCase().trim());
}

console.log('Total emails in Day 5:', emails.length);

const supRaw = JSON.parse(fs.readFileSync('data/suppression_list.json', 'utf8'));
const sup = new Set(supRaw.map(s => (typeof s === 'string' ? s.toLowerCase() : (s.email || '').toLowerCase().trim().replace(/\.$/, ''))));

const active = emails.filter(e => !sup.has(e));
const suppressed = emails.filter(e => sup.has(e));

console.log('Active Day 5 leads eligible for follow-up:', active.length);
console.log('Suppressed leads filtered out:', suppressed.length);
if (suppressed.length > 0) {
  console.log('Suppressed:', suppressed);
}
console.log('First 5 active:', active.slice(0, 5));
