import type { Block } from '../content.js';
import type { Engine } from '../engine.js';
import { trackFocus } from '../dom.js';
import { renderProse } from './prose.js';
import { renderCell } from './cell.js';
import { renderPredict } from './predict.js';
import { renderTryInput } from './tryinput.js';
import { renderHangman } from './hangman.js';
import { renderExercise } from './exercise.js';

export type BlockCtx = {
  engine: Engine;
  focus: ReturnType<typeof trackFocus>;
  progress: { pass(id: string): void; has(id: string): boolean };
  navigation?: { hasNext(id: string): boolean; next(id: string): void };
};
export type Rendered = { el: HTMLElement; run?: () => void };

export function renderBlock(block: Block, ctx: BlockCtx): Rendered {
  switch (block.type) {
    case 'prose': return renderProse(block);
    case 'cell': return renderCell(block, ctx);
    case 'predict': return renderPredict(block, ctx);
    case 'tryinput': return renderTryInput(block, ctx);
    case 'hangman': return renderHangman(block, ctx);
    case 'exercise': return renderExercise(block, ctx);
  }
}
