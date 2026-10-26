import fs from 'node:fs';
import path from 'node:path';
import { styleText } from 'node:util';
import { Option, type Command } from 'commander';
import { KIBAB_URL, KibabAPI, KibabError, type KibabFile, type KibabPatchFields, type KibabPatchFiles, type KibabPatchForm } from '#src/KibabAPI.js';
import { loadSession } from '#src/session.js';
import { AppCommandValidateError, type AppCommand } from '#src/utils/command.js';
import { printJson, type JsonOptions } from '#src/utils/json.js';
import { readTextFile } from '#src/utils/file.js';
import { renderBBCode } from '#src/utils/bbcode.js';
import { renderPatchCode } from '#src/utils/vkp.js';

interface PatchTextOptions {
	sw?: string;
	nameRu?: string;
	nameEn?: string;
	author?: string;
	porter?: string;
	respect?: string;
	filename?: string;
	ver?: string;
	desc?: string;
	patch?: string;
	deps?: string;
	conflicts?: string;
	updateOf?: string;
	insertionFor?: string;
}

export interface PatchOptions extends PatchTextOptions, JsonOptions {
	model?: string;
	name?: string;
	beta?: boolean;
	type?: string;
	descFile?: string;
	patchFile?: string;
	screenshot?: string;
	attachment?: string;
	rss?: boolean;
	updateDate?: boolean;
	dryRun?: boolean;
	force?: boolean;
	deleteScreenshot?: boolean;
	deleteAttachment?: boolean;
}

interface PatchChange {
	field: string;
	old: string;
	new: string;
}

const TEXT_OPTIONS: Record<keyof PatchTextOptions, string> = {
	sw:				'ph_sw',
	nameRu:			'p_name_RU',
	nameEn:			'p_name_EN',
	author:			'p_c',
	porter:			'p_p',
	respect:		'p_r',
	filename:		'p_dname',
	ver:			'p_ver',
	desc:			'p_shortdesc',
	patch:			'p_text',
	deps:			'p_dep',
	conflicts:		'p_conf',
	updateOf:		'p_old',
	insertionFor:	'p_body',
};

const ACTION_FIELDS = ['is_rss', 'no_upd_date'];

const FIELD_LABELS: Record<string, string> = {
	ph_model:		'Model',
	ph_sw:			'SW',
	p_name_RU:		'Name (RU)',
	p_name_EN:		'Name (EN)',
	p_c:			'Author',
	p_p:			'Porter',
	p_r:			'Respect',
	p_dname:		'File name',
	p_ver:			'Version',
	is_beta:		'Release',
	p_type:			'Type',
	p_shortdesc:	'Description',
	p_text:			'Patch',
	p_dep:			'Depends',
	p_conf:			'Conflicts',
	p_old:			'Update of',
	p_body:			'Insertion for',
	p_scr:			'Screenshot',
	p_file:			'Attachment',
};

const SCREENSHOT_TYPES: Record<string, string> = {
	'.png':		'image/png',
	'.gif':		'image/gif',
	'.jpg':		'image/jpeg',
	'.jpeg':	'image/jpeg',
};

const ATTACHMENT_TYPES: Record<string, string> = {
	'.zip':		'application/zip',
	'.rar':		'application/x-rar-compressed',
};

export function addPatchOptions(cmd: Command): Command {
	return cmd
		.option('-m, --model <model>', 'Phone model (name or ID), e.g. S75')
		.option('-s, --sw <sw>', 'Phone firmware version, e.g. 52')
		.option('-n, --name <name>', 'Patch name (both RU and EN)')
		.option('--name-ru <name>', 'Patch name (RU)')
		.option('--name-en <name>', 'Patch name (EN)')
		.option('-a, --author <author>', '(c) Author')
		.option('--porter <porter>', '(p) Porter')
		.option('--respect <respect>', '(r) Respect')
		.option('-f, --filename <name>', 'File name for storing (without .vkp)')
		.option('--ver <version>', 'Patch version')
		.option('--beta', 'Mark as beta version')
		.option('--no-beta', 'Mark as stable version')
		.option('--type <type>', 'Patch type (name or ID)')
		.option('--desc <text>', 'Short description')
		.addOption(new Option('--desc-file <file>', 'Short description from file ("-" for stdin)').conflicts('desc'))
		.option('--patch <code>', 'Patch code')
		.addOption(new Option('--patch-file <file>', 'Patch code from .vkp file ("-" for stdin)').conflicts('patch'))
		.option('--deps <ids>', 'Dependencies (comma separated patch IDs)')
		.option('--conflicts <ids>', 'Conflicts (comma separated patch IDs)')
		.option('--update-of <id>', 'This patch is an update of another patch: ID of the previous version (0 - none)')
		.option('--insertion-for <id>', 'This patch is an insertion for another patch: ID of the patch body (0 - none)')
		.option('--screenshot <file>', 'Upload new screenshot (PNG, GIF, JPG, max 1 MB)')
		.option('--attachment <file>', 'Upload new attachment (RAR, ZIP, max 5 MB)')
		.option('--rss', 'Announce the update in RSS (better to skip for typo fixes)')
		.option('--no-update-date', 'Keep the previous patch update date (for typo fixes, translations, etc)')
		.option('--dry-run', 'Show changes without saving')
		.option('--force', 'Save even if nothing changed')
		.option('-J, --json', 'Output result as JSON');
}

export function addPatchEditOptions(cmd: Command): Command {
	return addPatchOptions(cmd)
		.addOption(new Option('--delete-screenshot', 'Delete current screenshot').conflicts('screenshot'))
		.addOption(new Option('--delete-attachment', 'Delete current attachment').conflicts('attachment'));
}

export const cliPatchGet: AppCommand<JsonOptions, [string]> = async (id, options) => {
	const api = createAPI();
	const form = await api.getPatchForm(parsePatchId(id));
	if (options.json) {
		printJson(form.fields);
		return;
	}
	const fields = form.fields;
	const version = fields.p_ver ? ` v${fields.p_ver}` : '';
	console.log(styleText('bold', `${fields.p_name_RU}${version}`));
	if (fields.p_name_EN != fields.p_name_RU)
		console.log(styleText('bold', `${fields.p_name_EN}${version}`));
	console.log();
	const rows: [string, string][] = [
		['ID', `${fields.id}  ${styleText('dim', `${KIBAB_URL}/patches/details.php5?id=${fields.id}`)}`],
		['Model', `${getFieldTitle(form, 'ph_model')}v${fields.ph_sw}`],
		['Type', getFieldTitle(form, 'p_type')],
		['Release', getFieldTitle(form, 'is_beta')],
		['Author', fields.p_c ?? ''],
		['Porter', fields.p_p ?? ''],
		['Respect', fields.p_r ?? ''],
		['File name', `${fields.p_dname}.vkp`],
		['Depends', fields.p_dep ?? ''],
		['Conflicts', fields.p_conf ?? ''],
		['Update of', fields.p_old == '0' ? '' : fields.p_old ?? ''],
		['Insertion for', fields.p_body == '0' ? '' : fields.p_body ?? ''],
	];
	for (const [label, value] of rows.filter(([, value]) => value != ''))
		console.log(`${styleText('dim', label.padEnd(14))}${value}`);
	console.log();
	console.log(renderBBCode(normalizeValue(fields.p_shortdesc ?? '')));
	console.log();
	console.log(renderPatchCode(normalizeValue(fields.p_text ?? '')));
};

export const cliPatchEdit: AppCommand<PatchOptions, [string]> = async (id, options) => {
	const patchId = parsePatchId(id);
	const api = createAPI();
	const form = await api.getPatchForm(patchId);
	const fields = applyOptions(form, options);
	const files = getFiles(options);

	const changes = getChanges(form.fields, fields);
	const uploads = Object.keys(files);
	const deletes = [
		...(options.deleteScreenshot ? ['p_scr'] : []),
		...(options.deleteAttachment ? ['p_file'] : []),
	];
	const changed = changes.length > 0 || uploads.length > 0 || !!options.force;
	const result = (status: string) => ({ id: patchId, status, changes, uploads, deletes });

	if (!options.json)
		printChanges(form, changes, files, deletes);
	if (!changed && !deletes.length) {
		if (options.json) {
			printJson(result('unchanged'));
		} else {
			console.info(`Patch ${patchId} is up to date.`);
		}
		return;
	}
	if (options.dryRun) {
		if (options.json)
			printJson(result('dry-run'));
		return;
	}

	if (changed) {
		await api.savePatch(fields, files);
		const saved = await api.getPatchForm(patchId);
		const mismatch = Object.keys(fields).find((k) => !ACTION_FIELDS.includes(k) && !isSameValue(saved.fields[k], fields[k]));
		if (mismatch)
			throw new KibabError(`Patch ${patchId} is saved, but field "${mismatch}" is not: sent ${JSON.stringify(fields[mismatch])}, saved ${JSON.stringify(saved.fields[mismatch] ?? '')}`);
	}
	if (options.deleteScreenshot)
		await api.deleteScreenshot(patchId);
	if (options.deleteAttachment)
		await api.deleteAttachment(patchId);
	if (options.json) {
		printJson(result('saved'));
	} else {
		console.info(styleText('green', `Patch ${patchId} saved.`));
	}
};

export const cliPatchAdd: AppCommand<PatchOptions> = async (options) => {
	if (!options.model)
		throw new AppCommandValidateError(`--model is required.`);

	const api = createAPI();
	const form = await api.getPatchForm();
	const fields = applyOptions(form, options);
	const files = getFiles(options);

	const changes = getChanges(form.fields, fields);
	if (!options.json)
		printChanges(form, changes, files, []);
	if (options.dryRun) {
		if (options.json)
			printJson({ status: 'dry-run', changes });
		return;
	}

	const response = await api.savePatch(fields, files);
	const url = new URL(response.headers.get('location') ?? '', KIBAB_URL);
	const id = url.searchParams.get('id');
	if (options.json) {
		printJson({ id: id ? +id : undefined, url: url.href, status: 'saved', changes });
	} else {
		console.info(styleText('green', `Patch added: ${url.href}`));
	}
};

function createAPI(): KibabAPI {
	return new KibabAPI(loadSession());
}

function parsePatchId(id: string): number {
	const m = id.match(/^(?:.*[?&]id=)?(\d+)$/);
	if (!m)
		throw new AppCommandValidateError(`Invalid patch ID: ${id}`);
	return +m[1]!;
}

function findOption(form: KibabPatchForm, field: string, value: string): string {
	const options = form.options[field] ?? [];
	const option = options.find((o) => o.value == value || o.title.toLowerCase() == value.toLowerCase());
	if (!option)
		throw new AppCommandValidateError(`Invalid value "${value}" for ${field}, allowed: ${options.map((o) => `${o.title} (${o.value})`).join(', ')}`);
	return option.value;
}

function applyOptions(form: KibabPatchForm, options: PatchOptions): KibabPatchFields {
	const fields = { ...form.fields };
	if (options.model != undefined)
		fields.ph_model = findOption(form, 'ph_model', options.model);
	if (options.name != undefined)
		fields.p_name_RU = fields.p_name_EN = options.name;
	for (const [option, field] of Object.entries(TEXT_OPTIONS)) {
		const value = options[option as keyof PatchTextOptions];
		if (value != undefined)
			fields[field] = value;
	}
	if (options.beta != undefined)
		fields.is_beta = options.beta ? '2' : '1';
	if (options.type != undefined)
		fields.p_type = findOption(form, 'p_type', options.type);
	if (options.descFile != undefined)
		fields.p_shortdesc = readTextFile(options.descFile);
	if (options.patchFile != undefined)
		fields.p_text = readTextFile(options.patchFile);
	if (options.rss)
		fields.is_rss = 'on';
	if (options.updateDate === false)
		fields.no_upd_date = 'on';
	if (fields.p_dname && !/^[A-Za-z0-9_-]+$/.test(fields.p_dname))
		throw new AppCommandValidateError(`File name may contain only latin letters, digits, "-" and "_": ${JSON.stringify(fields.p_dname)}`);
	for (const [field, maxLength] of Object.entries(form.maxLength)) {
		if ((fields[field] ?? '').length > maxLength)
			throw new AppCommandValidateError(`Value of ${field} is too long (max ${maxLength} chars): ${JSON.stringify(fields[field])}`);
	}
	return fields;
}

function readUploadFile(file: string, types: Record<string, string>): KibabFile {
	const contentType = types[path.extname(file).toLowerCase()];
	if (!contentType)
		throw new AppCommandValidateError(`Unsupported file type: ${file}, allowed: ${Object.keys(types).join(', ')}`);
	return { name: path.basename(file), contentType, data: fs.readFileSync(file) };
}

function getFiles(options: PatchOptions): KibabPatchFiles {
	const files: KibabPatchFiles = {};
	if (options.screenshot != undefined)
		files.p_scr = readUploadFile(options.screenshot, SCREENSHOT_TYPES);
	if (options.attachment != undefined)
		files.p_file = readUploadFile(options.attachment, ATTACHMENT_TYPES);
	return files;
}

function normalizeValue(value: string): string {
	return value.replace(/\r\n/g, '\n').trim();
}

function isSameValue(a: string | undefined, b: string | undefined): boolean {
	return normalizeValue(a ?? '') == normalizeValue(b ?? '');
}

function getChanges(oldFields: KibabPatchFields, newFields: KibabPatchFields): PatchChange[] {
	const changes: PatchChange[] = [];
	for (const field of new Set([...Object.keys(oldFields), ...Object.keys(newFields)])) {
		const oldValue = oldFields[field] ?? '';
		const newValue = newFields[field] ?? '';
		if (!ACTION_FIELDS.includes(field) && !isSameValue(oldValue, newValue))
			changes.push({ field, old: oldValue, new: newValue });
	}
	return changes;
}

function getFieldTitle(form: KibabPatchForm, field: string, value = form.fields[field] ?? ''): string {
	return form.options[field]?.find((o) => o.value == value)?.title ?? value;
}

function formatLines(text: string): string {
	const lines = normalizeValue(text).split('\n').length;
	return `${lines} ${lines == 1 ? 'line' : 'lines'}`;
}

function printChanges(form: KibabPatchForm, changes: PatchChange[], files: KibabPatchFiles, deletes: string[]): void {
	const value = (field: string, str: string) => {
		if (/\n/.test(str))
			return formatLines(str);
		return getFieldTitle(form, field, str) || styleText('dim', '(empty)');
	};
	const rows: [string, string][] = [
		...changes.map((c): [string, string] => [c.field, `${styleText('red', value(c.field, c.old))} -> ${styleText('green', value(c.field, c.new))}`]),
		...Object.entries(files).map(([field, file]): [string, string] => [field, styleText('green', `upload ${file.name}`)]),
		...deletes.map((field): [string, string] => [field, styleText('red', 'delete')]),
	];
	for (const [field, text] of rows)
		console.info(`${styleText('dim', (FIELD_LABELS[field] ?? field).padEnd(14))}${text}`);
}
