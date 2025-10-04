export type TestDefinition = {
  name: string;
  fn: () => void | Promise<void>;
};

const tests: TestDefinition[] = [];

export function test(name: string, fn: () => void | Promise<void>): void {
  tests.push({ name, fn });
}

export async function runAllTests(): Promise<number> {
  let failures = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✅ ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`❌ ${name}`);
      console.error(error);
    }
  }
  return failures;
}
