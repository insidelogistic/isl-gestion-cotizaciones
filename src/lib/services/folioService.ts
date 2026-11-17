import { getAsyncDb } from '../db';

export function extractCompanyPrefix(companyName?: string): string {
  if (!companyName) return 'GEN';
  const cleaned = companyName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase();

  return cleaned.slice(0, 3).padEnd(3, 'X');
}

export async function generateNextFolio(
  yearInput?: number,
  companyName?: string
): Promise<string> {
  const db = await getAsyncDb();
  const year =
    yearInput ??
    Number(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
      }).format(new Date())
    );

  const companyPrefix = extractCompanyPrefix(companyName);

  return db.transaction(async (tx) => {
    const row = await tx.get<{ last_number: number }>(
      'SELECT last_number FROM folio_sequences WHERE year = ?',
      year
    );

    const nextNum = (row?.last_number ?? 0) + 1;

    if (row) {
      await tx.run('UPDATE folio_sequences SET last_number = ? WHERE year = ?', nextNum, year);
    } else {
      await tx.run(
        'INSERT INTO folio_sequences (year, last_number) VALUES (?, ?)',
        year,
        nextNum
      );
    }

    const padded = String(nextNum).padStart(4, '0');
    return `COT-${year}-${companyPrefix}-${padded}`;
  });
}
