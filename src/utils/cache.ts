import os from 'node:os';
import path from 'node:path';

export function getCacheDir(): string {
	const home = os.homedir();
	switch (process.platform) {
		case 'win32':
			return path.join(process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local'), 'kibab-tool', 'Cache');
		case 'darwin':
			return path.join(home, 'Library', 'Caches', 'kibab-tool');
		default:
			return path.join(process.env.XDG_CACHE_HOME || path.join(home, '.cache'), 'kibab-tool');
	}
}
