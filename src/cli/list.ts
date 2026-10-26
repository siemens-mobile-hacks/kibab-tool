import { KibabAPI } from '#src/KibabAPI.js';
import { AppCommandValidateError, type AppCommand } from '#src/utils/command.js';
import { printJson, type JsonOptions } from '#src/utils/json.js';

export const cliModels: AppCommand<JsonOptions> = async (options) => {
	const models = await new KibabAPI().getModels();
	if (options.json) {
		printJson(models);
		return;
	}
	for (const model of models)
		console.log(model.name);
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
		console.log(`${patch.id}\t${patch.updated}\t${patch.nameRu}`);
};

export const cliSearch: AppCommand<JsonOptions, [string]> = async (query, options) => {
	const results = await new KibabAPI().search(query);
	if (options.json) {
		printJson(results);
		return;
	}
	for (const result of results)
		console.log(`${result.id}\t${result.model}\t${result.nameRu}`);
};
