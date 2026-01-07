// Use require.resolve to find package.json relative to this module
// This works correctly whether running from src/ or dist/
import * as fs from 'fs';
import * as path from 'path';

function findPackageJson(): { version: string; name: string } {
  // Try multiple possible locations
  const possiblePaths = [
    path.resolve(__dirname, '..', 'package.json'), // from src/
    path.resolve(__dirname, '..', '..', 'package.json'), // from dist/
  ];

  for (const p of possiblePaths) {
    try {
      const content = fs.readFileSync(p, 'utf-8');

      return JSON.parse(content);
    } catch {
      // Try next path
    }
  }

  // Fallback values if package.json cannot be found
  return { version: '0.0.0', name: '@forestadmin/mcp-server' };
}

const packageJson = findPackageJson();

export const VERSION: string = packageJson.version;
export const NAME: string = packageJson.name;
