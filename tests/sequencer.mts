import { BaseSequencer } from 'vitest/node';

/**
 * Run order matters because some API tests deliberately change the demo data:
 * database + unit tests (which expect the pristine seed) first, read-only API tests next, mutating ones last.
 */
const MUTATING = ['deliverables', 'feedback', 'workflow', 'risk.test', 'peer.test', 'similarity-flow', 'admin.test', 'auth.test'];

export default class DemoSafeSequencer extends BaseSequencer {
  async sort(files: Parameters<BaseSequencer['sort']>[0]) {
    const rank = (f: string) => (f.includes('/db/tests/') || f.includes('/tests/unit/') ? 0 : MUTATING.some((m) => f.includes(m)) ? 2 : 1);
    return [...files].sort((a, b) => rank(a.moduleId) - rank(b.moduleId) || a.moduleId.localeCompare(b.moduleId));
  }
}
