import { styleText } from 'node:util';
import { KibabAPI } from '#src/KibabAPI.js';
import { AppCommandValidateError, type AppCommand } from '#src/utils/command.js';
import { printJson, type JsonOptions } from '#src/utils/json.js';


export const cliModels: AppCommand<JsonOptions> = async (options) => {
	const models = await new KibabAPI().getModels();
	if (options.json) {
		printJson(models);
		return;
	}
	const swByModel = new Map<string, string[]>();
	for (const model of models)
		swByModel.set(model.model, [...swByModel.get(model.model) ?? [], model.sw]);
	for (const [model, sw] of swByModel)
		console.log(`${styleText('bold', model.padEnd(8))}${sw.map((v) => `v${v}`).join(', ')}`);
};

export const cliPatches: AppCommand<JsonOptions, [string]> = async (name, options) => {
	const api = new KibabAPI();
	const models = await api.getModels();
	const model = models.find((m) => m.name.toLowerCase() == name.toLowerCase());
	if (!model) {
		const similar = models.filter((m) => m.model.toLowerCase() == name.replace(/v\w*$/i, '').toLowerCase());
		throw new AppCommandValidateError(`Unknown model: ${name}${similar.length ? `, available: ${similar.map((m) => m.name).join(', ')}` : ''}`);
	}

	const patches = await api.getPatches(model);
	if (options.json) {
		printJson(patches);
		return;
	}
	for (const patch of patches)
		console.log(`${styleText('yellow', String(patch.id))}  ${styleText('dim', patch.updated)}  ${formatName(patch.nameRu, patch.nameEn)}  ${styleText('dim', `© ${patch.author}`)}`);
};

export const cliSearch: AppCommand<JsonOptions, [string]> = async (query, options) => {
	const results = await new KibabAPI().search(query);
	if (options.json) {
		printJson(results);
		return;
	}
	for (const result of results)
		console.log(`${styleText('yellow', String(result.id))}  ${styleText('cyan', result.model.padEnd(9))} ${formatName(result.nameRu, result.nameEn)}`);
};

function formatName(nameRu: string, nameEn: string): string {
	return nameEn == nameRu ? styleText('bold', nameRu) : `${styleText('bold', nameRu)} ${styleText('dim', `/ ${nameEn}`)}`;
}
