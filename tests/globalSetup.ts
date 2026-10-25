import { execSync } from 'node:child_process';

/** After a run that was allowed to change data, put the demo back (migrate + seed incl. MongoDB). */
export default function setup() {
  return () => {
    if (process.env.ALLOW_MUTATING_TESTS !== '1') return;
    console.log('\nRestoring demo data (db:reset + db:seed) ...');
    execSync('npm run db:reset --silent && npm run db:seed --silent', { stdio: 'ignore', cwd: process.cwd() });
  };
}
