import fs from 'node:fs';

export function getVersion(): string {
	return JSON.parse(fs.readFileSync(new URL(import.meta.resolve('#package.json')), 'utf-8')).version;
}
