import fs from 'node:fs';

export function readTextFile(file: string): string {
	const data = fs.readFileSync(file == '-' ? 0 : file);
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(data);
	} catch {
		return new TextDecoder('windows-1251').decode(data);
	}
}
