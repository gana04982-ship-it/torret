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

const content = fs.readFileSync('C:/Users/gana0/.gemini/antigravity/scratch/gmail-agent-sender/contacts_day14_replacements.csv', 'utf8');
const rows = parseCSV(content);

const stats = rows.reduce((acc, r) => {
  acc[r.status] = (acc[r.status] || 0) + 1;
  return acc;
}, {});

console.log('Total rows:', rows.length);
console.log('Status breakdown:', stats);

rows.forEach(r => {
  console.log(`- Row ${r._rowIndex + 1}: ${r.email} | Status: ${r.status} | SentAt: ${r.sent_at}`);
});
