import fs from 'node:fs';

function parseCSV(content) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentField);
      if (currentRow.some((f) => f.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((f) => f.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  const rawHeaders = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((row, idx) => {
    const obj = { _rowIndex: idx };
    rawHeaders.forEach((h, i) => {
      obj[h] = row[i] ? row[i].trim() : '';
    });
    return obj;
  });
}

const content = fs.readFileSync('C:/Users/gana0/.gemini/antigravity/scratch/gmail-agent-sender/contacts_day13_verified_50.csv', 'utf8');
const rows = parseCSV(content);
const pending = rows.filter(r => r.status === 'pending');
console.log(`Pending count: ${pending.length}`);
pending.forEach(p => console.log(`Row ${p._rowIndex + 1}: ${p.email} | ${p.subject}`));
