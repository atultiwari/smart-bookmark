declare module 'node:assert/strict' {
  interface BasicAssert {
    (value: unknown, message?: string | Error): void;
    equal(actual: unknown, expected: unknown, message?: string | Error): void;
    strictEqual(actual: unknown, expected: unknown, message?: string | Error): void;
    ok(value: unknown, message?: string | Error): void;
  }

  const assert: BasicAssert;
  export default assert;
}

declare const process: {
  exit(code?: number): never;
};
