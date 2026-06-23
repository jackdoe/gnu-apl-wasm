const DRAFTS = 'apl-learn-drafts';

type Drafts = Record<string, string>;

const loadDrafts = (): Drafts => JSON.parse(localStorage.getItem(DRAFTS) || '{}') as Drafts;

const saveDrafts = (drafts: Drafts): void =>
  localStorage.setItem(DRAFTS, JSON.stringify(drafts));

export const loadDraft = (id: string): string =>
  loadDrafts()[id] ?? '';

export const saveDraft = (id: string, value: string): void => {
  const drafts = loadDrafts();
  if (value) drafts[id] = value;
  else delete drafts[id];
  saveDrafts(drafts);
};

export const clearDraft = (id: string): void => saveDraft(id, '');
