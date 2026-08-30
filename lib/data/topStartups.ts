import startups from './topStartups.json';

export interface StartupValuation {
  name: string;
  valuationUsd: number;
  lastRoundDate: string;
  sector: string;
}

/** Manually-curated, checked-in dataset — update lib/data/topStartups.json by hand. */
export function getTopStartups(): StartupValuation[] {
  return startups as StartupValuation[];
}
