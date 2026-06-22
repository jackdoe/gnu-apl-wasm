export type Block =
  | { type: 'prose'; md: string }
  | { type: 'cell'; code: string; setup?: string; inputs?: string[]; expect?: string }
  | { type: 'predict'; code: string; setup?: string; inputs?: string[]; prompt?: string }
  | { type: 'tryinput'; code: string; label?: string; ask?: string }
  | { type: 'hangman'; word?: string; lives?: number; label?: string }
  | {
      type: 'exercise';
      id: string;
      prompt: string;
      solution: string;
      test?: string;
      inputs?: string[];
      expected: string;
      hint: string;
      requires?: string;
    };

export type Topic = { title: string; blocks: Block[] };

export async function loadCurriculum(): Promise<Topic[]> {
  const manifest: string[] = await (await fetch('./content/_manifest.json')).json();
  return Promise.all(manifest.map(id => fetch(`./content/${id}.json`).then(r => r.json() as Promise<Topic>)));
}
