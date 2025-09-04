// Test file for pre-commit hook
export function testFunction(param: string) {
  // Fixed: using proper type
  const message = 'Testing pre-commit hook with Biome';
  const value: number = 42;
  console.log(message, param, value);
  return message;
}
