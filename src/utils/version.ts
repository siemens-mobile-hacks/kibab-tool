import fs from 'node:fs';

export function getVersion(): string {
	return JSON.parse(fs.readFileSync(new URL('../../../package.json', import.meta.url), 'utf-8')).version;
}
