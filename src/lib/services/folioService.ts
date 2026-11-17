import { getDb } from '../db';

export function extractCompanyPrefix(companyName?: string): string {
  if (!companyName) return 'GEN';
  const cleaned = companyName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase();

  return cleaned.slice(0, 3).padEnd(3, 'X');
}

export function generateNextFolio(yearInput?: number, companyName?: string): string {
  const db = getDb();
  const year =
    yearInput ??
    Number(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
      }).format(new Date())
    );

  const companyPrefix = extractCompanyPrefix(companyName);

  db.exec('BEGIN IMMEDIATE TRANSACTION');
  try {
    const row = db
      .prepare('SELECT last_number FROM folio_sequences WHERE year = ?')
      .get(year) as { last_number: number } | undefined;

    const nextNum = (row?.last_number ?? 0) + 1;

    if (row) {
      db.prepare('UPDATE folio_sequences SET last_number = ? WHERE year = ?').run(nextNum, year);
    } else {
      db.prepare('INSERT INTO folio_sequences (year, last_number) VALUES (?, ?)').run(year, nextNum);
    }

    db.exec('COMMIT');
    const padded = String(nextNum).padStart(4, '0');
    return `COT-${year}-${companyPrefix}-${padded}`;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
