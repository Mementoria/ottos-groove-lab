import { compileForCheck } from '../audio/compile';
import { isRenderable, layerExpression } from '../program/codegen';
import type { Program } from '../program/types';

/**
 * The sources of the layers whose code won't evaluate (an unclosed bracket in a pattern, say).
 * Each layer is compiled on its own with the check compiler, which throws on the same parse
 * errors as playback. Muted layers count: Strudel still parses them.
 */
export async function brokenSourceIds(p: Program): Promise<string[]> {
  const verdicts = await Promise.all(
    p.layers.filter(isRenderable).map((l) =>
      compileForCheck(layerExpression(l)).then(
        () => null,
        () => l.source.id,
      ),
    ),
  );
  return verdicts.filter((id): id is string => id !== null);
}
