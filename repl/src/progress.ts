const PASSED = 'apl-learn-passed';

export const loadPassed = (): Set<string> =>
  new Set(JSON.parse(localStorage.getItem(PASSED) || '[]') as string[]);

export const savePassed = (s: Set<string>): void =>
  localStorage.setItem(PASSED, JSON.stringify([...s]));
