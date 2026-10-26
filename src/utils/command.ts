import { KibabError } from '#src/KibabAPI.js';
import { printJson, type JsonOptions } from '#src/utils/json.js';

export type AppCommand<T, A extends unknown[] = []> = (...args: [...A, options: T]) => Promise<void>;

export class AppCommandValidateError extends Error { }

export function createAppCommand<T extends JsonOptions, A extends unknown[] = []>(handler: AppCommand<T, A>) {
	return async (...params: unknown[]): Promise<void> => {
		const options = params[params.length - 2] as T;
		const args = params.slice(0, params.length - 2) as A;
		try {
			await handler(...args, options);
		} catch (e) {
			process.exitCode = 1;
			if (options.json) {
				printJson({ error: e instanceof Error ? e.message : String(e) });
			} else if (e instanceof AppCommandValidateError || e instanceof KibabError) {
				console.error(`ERROR: ${e.message}`);
			} else {
				console.error(e);
			}
		}
	};
}
