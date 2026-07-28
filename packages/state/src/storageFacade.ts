/**
 * Re-exports @rack-app/data's storage/repository layer so downstream
 * packages (ui) can construct persistence without importing
 * @rack-app/data directly (Engineering File Plan §1.2 — ui depends on
 * state, canvas, rules-engine only). Mirrors entityTypes.ts's facade
 * pattern, scoped specifically to storage construction.
 */
export {
  RackAppDatabase,
  createIndexedDbRepository,
  ProjectRepository,
  LayoutRepository,
  TemplateRepository,
  ShareLinkRepository,
} from "@rack-app/data";
export type { DeleteTemplateOptions, Repository } from "@rack-app/data";
