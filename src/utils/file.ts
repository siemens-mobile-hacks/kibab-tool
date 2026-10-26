import fs from 'node:fs';
import iconv from 'iconv-lite';

export function readTextFile(file: string): string {
	const data = fs.readFileSync(file == '-' ? 0 : file);
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(data);
	} catch {
		return iconv.decode(data, 'win1251');
	}
}
