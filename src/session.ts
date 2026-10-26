import fs from 'node:fs';
import path from 'node:path';
import { getCacheDir } from '#src/utils/cache.js';
import type { KibabCookies } from '#src/KibabAPI.js';

export function getSessionFile(): string {
	return path.join(getCacheDir(), 'session.json');
}

export function loadSession(): KibabCookies | undefined {
	const file = getSessionFile();
	if (!fs.existsSync(file))
		return undefined;
	return JSON.parse(fs.readFileSync(file, 'utf-8')) as KibabCookies;
}

export function saveSession(cookies: KibabCookies): void {
	const file = getSessionFile();
	fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
	fs.writeFileSync(file, JSON.stringify(cookies, undefined, '\t'), { mode: 0o600 });
}

export function deleteSession(): boolean {
	const file = getSessionFile();
	if (!fs.existsSync(file))
		return false;
	fs.unlinkSync(file);
	return true;
}
