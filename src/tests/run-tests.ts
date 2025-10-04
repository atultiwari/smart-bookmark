import { runAllTests } from './test-helpers.js';
import './url.test.js';
import './migration.test.js';
import './filter.test.js';

(async () => {
  const failures = await runAllTests();
  if (failures > 0) {
    console.error(`\n${failures} test(s) failed.`);
    process.exit(1);
  } else {
    console.log('\nAll tests passed.');
  }
})();
