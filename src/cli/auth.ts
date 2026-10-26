import { input, password } from '@inquirer/prompts';
import { KibabAPI } from '#src/KibabAPI.js';
import { deleteSession, getSessionFile, saveSession } from '#src/session.js';
import type { AppCommand } from '#src/utils/command.js';
import { printJson, type JsonOptions } from '#src/utils/json.js';

interface LoginOptions extends JsonOptions {
	login?: string;
	password?: string;
}

export const cliLogin: AppCommand<LoginOptions> = async (options) => {
	const login = options.login ?? (process.env.KIBAB_LOGIN || await input({ message: 'Login:', required: true }));
	const pass = options.password ?? (process.env.KIBAB_PASSWORD || await password({ message: 'Password:', mask: '*' }));
	const api = new KibabAPI();
	await api.login(login, pass);
	saveSession(api.cookies);
	if (options.json) {
		printJson({ login, sessionFile: getSessionFile() });
	} else {
		console.info(`Logged in as ${login}, session saved to ${getSessionFile()}`);
	}
};

export const cliLogout: AppCommand<JsonOptions> = async (options) => {
	const deleted = deleteSession();
	if (options.json) {
		printJson({ deleted, sessionFile: getSessionFile() });
	} else if (deleted) {
		console.info(`Session ${getSessionFile()} deleted.`);
	} else {
		console.info(`Not logged in.`);
	}
};
