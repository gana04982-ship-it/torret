import fs from 'node:fs';
import path from 'node:path';

const content = fs.readFileSync('load_day5_leads.js', 'utf8');

// Match each lead block
const emailRegex = /email:\s*['"]([^'"]+)['"]/g;
const subjectRegex = /subject:\s*['"]([^'"]+)['"]/g;
const bodyRegex = /body:\s*`Hi\s+([^,\n]+),/g;

const emails = [];
const subjects = [];
const names = [];

let m;
while ((m = emailRegex.exec(content)) !== null) emails.push(m[1].trim());
while ((m = subjectRegex.exec(content)) !== null) subjects.push(m[1].trim());
while ((m = bodyRegex.exec(content)) !== null) names.push(m[1].trim());

console.log(`Parsed ${emails.length} emails, ${subjects.length} subjects, ${names.length} names.`);

const leads = [];
for (let i = 0; i < emails.length; i++) {
  leads.push({
    email: emails[i],
    subject: subjects[i],
    name: names[i] || 'there'
  });
}

const brainScratch = 'C:/Users/gana0/.gemini/antigravity/brain/bc622bf4-8573-4029-b5e1-1d0c764c5a6d/scratch';
fs.writeFileSync(path.join(brainScratch, 'day5_parsed_leads.json'), JSON.stringify(leads, null, 2), 'utf8');
console.log('Saved day5_parsed_leads.json cleanly!');
console.log('Sample lead 1:', leads[0]);
console.log('Sample lead 2:', leads[1]);
