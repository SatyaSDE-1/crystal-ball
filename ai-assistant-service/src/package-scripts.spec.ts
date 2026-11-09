import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const { scripts } = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8'),
) as { scripts: Record<string, string> };

describe('npm scripts', () => {
  it('has a demo:fail script that starts the service with FORCE_LLM_FAILURE=true', () => {
    expect(scripts['demo:fail']).toMatch(/FORCE_LLM_FAILURE=true/);
    expect(scripts['demo:fail']).toMatch(/nest start/);
  });
});
