/**
 * The single deterministic resolver for the account → template → instance
 * override chain (anchors-per-upright, spacer length, capacity margin).
 * Every formula consumes its output, never raw settings — without one owner
 * for this precedence, each formula risks re-implementing (and
 * inconsistently resolving) the override chain on its own (Engineering File
 * Plan §2.5).
 *
 * Note: the toppling-ratio threshold is deliberately NOT resolved through
 * this chain — it is a fixed code constant with only a per-instance
 * exception flag, never a settings-level override (Spec §6.5; see
 * structural/toppling.ts).
 */

export type OverrideSource = "account" | "template" | "instance";

export interface OverrideChain<T> {
  readonly accountDefault: T;
  readonly templateOverride?: T;
  readonly instanceOverride?: T;
}

export interface ResolvedOverride<T> {
  readonly value: T;
  readonly source: OverrideSource;
}

export function resolveOverride<T>(chain: OverrideChain<T>): ResolvedOverride<T> {
  if (chain.instanceOverride !== undefined) {
    return { value: chain.instanceOverride, source: "instance" };
  }
  if (chain.templateOverride !== undefined) {
    return { value: chain.templateOverride, source: "template" };
  }
  return { value: chain.accountDefault, source: "account" };
}
