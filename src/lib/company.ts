import type { LineConfig } from '../types';

/** Operator that runs a line. Derived from the ODPT railway URI rather than
 *  stored in lines.json, so adding a line needs no extra bookkeeping. */
export type Company = 'tokyoMetro' | 'toei' | 'jrEast' | 'other';

export const COMPANY_ORDER: Company[] = ['tokyoMetro', 'toei', 'jrEast', 'other'];

export const COMPANY_LABEL_KEY: Record<Company, 'companyTokyoMetro' | 'companyToei' | 'companyJREast' | 'companyOther'> = {
  tokyoMetro: 'companyTokyoMetro',
  toei: 'companyToei',
  jrEast: 'companyJREast',
  other: 'companyOther',
};

export function companyOf(line: LineConfig): Company {
  const r = line.odptRailway;
  if (r.startsWith('odpt.Railway:TokyoMetro.')) return 'tokyoMetro';
  if (r.startsWith('odpt.Railway:Toei.')) return 'toei';
  if (r.startsWith('odpt.Railway:JR-East.')) return 'jrEast';
  return 'other';
}

/** Lines bucketed by operator, in COMPANY_ORDER, empty groups dropped. */
export function groupByCompany(lines: LineConfig[]): { company: Company; lines: LineConfig[] }[] {
  const g: Record<Company, LineConfig[]> = { tokyoMetro: [], toei: [], jrEast: [], other: [] };
  for (const line of lines) g[companyOf(line)].push(line);
  return COMPANY_ORDER.map((company) => ({ company, lines: g[company] })).filter((x) => x.lines.length > 0);
}
