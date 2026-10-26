import crypto from 'node:crypto';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

export type KibabCookies = Record<string, string>;

export type KibabPatchFields = Record<string, string>;

export interface KibabSelectOption {
	value: string;
	title: string;
}

export interface KibabPatchForm {
	fields: KibabPatchFields;
	options: Record<string, KibabSelectOption[]>;
	maxLength: Record<string, number>;
}

export interface KibabFile {
	name: string;
	contentType: string;
	data: Buffer;
}

export type KibabPatchFiles = Partial<Record<'p_scr' | 'p_file', KibabFile>>;

export interface KibabModel {
	name: string;
	model: string;
	sw: string;
	modelId: number;
	swId: number;
}

export interface KibabPatchListItem {
	id: number;
	nameRu: string;
	nameEn: string;
	author: string;
	porter: string;
	respect: string;
	added: string;
	updated: string;
}

export interface KibabSearchResult {
	id: number;
	model: string;
	nameRu: string;
	nameEn: string;
}

interface KibabRequestBody {
	contentType: string;
	data: string | Buffer;
}

export const KIBAB_URL = 'https://patches.kibab.com';

export class KibabError extends Error { }

export class KibabAPI {
	cookies: KibabCookies;

	constructor(cookies: KibabCookies = {}) {
		this.cookies = { ...cookies };
	}

	isLoggedIn(): boolean {
		return this.cookies.login != undefined && this.cookies.password != undefined;
	}

	async login(login: string, password: string): Promise<void> {
		await this.request('/auth.php5', {
			contentType: 'application/x-www-form-urlencoded; charset=windows-1251',
			data: encodeFormData({ action: 'login', login, password }),
		});
		if (!this.isLoggedIn())
			throw new KibabError(`Invalid login or password.`);
	}

	async getModels(): Promise<KibabModel[]> {
		const $ = cheerio.load(await this.requestHTML('/patches/phonelist.php5'));
		const models: KibabModel[] = [];
		for (const link of $('a[href*="action=disp_patches"]')) {
			const url = new URL($(link).attr('href') ?? '', KIBAB_URL);
			const m = $(link).text().trim().match(/^Патчи для ((.+)v(\w+))$/);
			if (!m)
				throw new Error(`Invalid model link: ${$.html(link)}`);
			models.push({
				name:		m[1]!,
				model:		m[2]!,
				sw:			m[3]!,
				modelId:	+url.searchParams.get('ph_model')!,
				swId:		+url.searchParams.get('ph_sw')!,
			});
		}
		return models;
	}

	async getPatches(model: KibabModel): Promise<KibabPatchListItem[]> {
		const $ = cheerio.load(await this.requestHTML(`/patches/index.php5?ph_model=${model.modelId}&ph_sw=${model.swId}&action=disp_patches`));
		const patches: KibabPatchListItem[] = [];
		for (const link of $('table.patches a.patch_name')) {
			const cells = $(link).closest('tr').children('td');
			const [nameRu, nameEn] = splitLines($, $(link).html());
			const credits = splitLines($, cells.eq(2).html());
			const credit = (prefix: string) => credits.find((line) => line.startsWith(prefix))?.slice(prefix.length).trim() ?? '';
			patches.push({
				id:			parsePatchLinkId($(link).attr('href')),
				nameRu:		nameRu ?? '',
				nameEn:		nameEn ?? '',
				author:		credit('©'),
				porter:		credit('§'),
				respect:	credit('®'),
				added:		parseDate(cells.eq(3).text()),
				updated:	parseDate(cells.eq(4).text()),
			});
		}
		return patches;
	}

	async search(query: string): Promise<KibabSearchResult[]> {
		const $ = cheerio.load(await this.requestHTML(`/patches/search.php5?${encodeFormData({ action: 'search', kw: query })}`));
		const results: KibabSearchResult[] = [];
		for (const link of $('table.maintext a[href*="details.php5?id="]')) {
			const [nameRu, nameEn] = splitLines($, $(link).html());
			results.push({
				id:		parsePatchLinkId($(link).attr('href')),
				model:	$(link).closest('tr').children('td').first().text().trim(),
				nameRu:	nameRu ?? '',
				nameEn:	nameEn ?? '',
			});
		}
		return results;
	}

	async getPatchForm(id?: number): Promise<KibabPatchForm> {
		if (!this.isLoggedIn())
			throw new KibabError(`Not logged in, use "kibab-tool login" first.`);

		const url = id != undefined ? `/patches/addpatch.php5?id=${id}&action=edit_patch` : `/patches/addpatch.php5`;
		const $ = cheerio.load(await this.requestHTML(url));
		const form = $('#PatchAddForm');
		if (!form.length)
			throw new KibabError(`Patch form not found (url=${url}), session expired or no access to the patch.`);

		const fields: KibabPatchFields = {};
		const options: Record<string, KibabSelectOption[]> = {};
		const maxLength: Record<string, number> = {};
		for (const el of form.find('input, textarea, select')) {
			const input = $(el);
			const name = input.attr('name');
			const type = input.attr('type') ?? 'text';
			if (!name || type == 'button' || type == 'submit' || type == 'file')
				continue;
			if (type == 'checkbox' && input.attr('checked') == undefined)
				continue;
			if (name in fields)
				throw new Error(`Duplicate form field: ${name}`);
			if (input.attr('maxlength') != undefined)
				maxLength[name] = +input.attr('maxlength')!;

			if (el.tagName == 'select') {
				options[name] = input.find('option').toArray().map((o) => ({
					value: $(o).attr('value') ?? '',
					title: $(o).text().trim(),
				}));
				fields[name] = input.find('option[selected]').attr('value') ?? options[name][0]?.value ?? '';
			} else if (el.tagName == 'textarea') {
				fields[name] = input.text();
			} else if (type == 'checkbox') {
				fields[name] = input.attr('value') ?? 'on';
			} else if (type == 'hidden' || type == 'text') {
				fields[name] = input.attr('value') ?? '';
			} else {
				throw new Error(`Unknown form field: ${$.html(el)}`);
			}
		}
		return { fields, options, maxLength };
	}

	async savePatch(fields: KibabPatchFields, files: KibabPatchFiles = {}): Promise<Response> {
		const response = await this.request('/patches/addpatch.php5', encodeMultipart(fields, files));
		if (response.status != 302) {
			const $ = cheerio.load(iconv.decode(Buffer.from(await response.arrayBuffer()), 'win1251'));
			const content = $('#PatchAddForm').closest('td.cnt_td');
			const errors = content.find('.maintext > font[color=red]').toArray().map((el) => $(el).text().trim());
			const code = content.contents().first().text().match(/EXC \d+/)?.[0];
			throw new KibabError(`Patch is not saved: ${errors.join('; ') || 'unknown error'} (${code ?? `HTTP ${response.status}`})`);
		}
		return response;
	}

	async deleteScreenshot(id: number): Promise<void> {
		await this.request(`/patches/addpatch.php5?action=del_screenshot&patch_id=${id}`);
	}

	async deleteAttachment(id: number): Promise<void> {
		await this.request(`/patches/addpatch.php5?action=del_attachment&patch_id=${id}`);
	}

	async request(url: string, body?: KibabRequestBody): Promise<Response> {
		const response = await fetch(`${KIBAB_URL}${url}`, {
			method: body ? 'POST' : 'GET',
			body: body?.data ?? null,
			headers: {
				'Cookie': this.getCookieHeader(),
				...(body ? { 'Content-Type': body.contentType } : {}),
			},
			redirect: 'manual',
		});
		this.updateCookies(response.headers.getSetCookie());
		if (response.status != 200 && response.status != 302)
			throw new Error(`${url}: HTTP ${response.status} ${response.statusText}`);
		return response;
	}

	async requestHTML(url: string): Promise<string> {
		const response = await this.request(url);
		return iconv.decode(Buffer.from(await response.arrayBuffer()), 'win1251');
	}

	private getCookieHeader(): string {
		return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
	}

	private updateCookies(setCookies: string[]): void {
		for (const setCookie of setCookies) {
			const m = setCookie.match(/^\s*([^=;]+?)\s*=\s*([^;]*?)\s*(;|$)/);
			if (!m)
				continue;
			const [, name, value] = m as [string, string, string];
			if (/;\s*max-age\s*=\s*0\s*(;|$)/i.test(setCookie)) {
				delete this.cookies[name];
			} else {
				this.cookies[name] = value;
			}
		}
	}
}

function encodeCp1251(str: string): Buffer {
	const encoded = iconv.encode(str, 'win1251');
	if (iconv.decode(encoded, 'win1251') != str) {
		const bad = [...str].find((c) => iconv.decode(iconv.encode(c, 'win1251'), 'win1251') != c);
		throw new Error(`Character ${JSON.stringify(bad)} can't be encoded to cp1251.`);
	}
	return encoded;
}

function encodeFormData(fields: Record<string, string>): string {
	const escape = (str: string) => [...encodeCp1251(str)].map((c) => `%${c.toString(16).padStart(2, '0')}`).join('');
	return Object.entries(fields).map(([k, v]) => `${escape(k)}=${escape(v)}`).join('&');
}

function splitLines($: cheerio.CheerioAPI, html: string | null): string[] {
	return (html ?? '').split(/<br\s*\/?>/i).map((line) => $('<div>').html(line).text().trim()).filter((line) => line != '');
}

function parsePatchLinkId(url: string | undefined): number {
	const id = new URL(url ?? '', KIBAB_URL).searchParams.get('id');
	if (!id || !/^\d+$/.test(id))
		throw new Error(`Invalid patch link: ${url}`);
	return +id;
}

function parseDate(str: string): string {
	const m = str.trim().match(/^(\d\d)\.(\d\d)\.(\d{4})$/);
	if (!m)
		throw new Error(`Invalid date: ${str}`);
	return `${m[3]}-${m[2]}-${m[1]}`;
}

function encodeMultipart(fields: Record<string, string>, files: KibabPatchFiles): KibabRequestBody {
	const boundary = `----KibabTool${crypto.randomBytes(16).toString('hex')}`;
	const chunks: Buffer[] = [];
	for (const [name, value] of Object.entries(fields)) {
		chunks.push(encodeCp1251(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n`));
		chunks.push(encodeCp1251(value.replace(/\r?\n/g, '\r\n')));
		chunks.push(Buffer.from('\r\n'));
	}
	// Browsers always send empty file parts, the site emits PHP warnings and breaks the redirect without them
	const fileFields: (keyof KibabPatchFiles)[] = ['p_scr', 'p_file'];
	for (const name of fileFields) {
		const file = files[name] ?? { name: '', contentType: 'application/octet-stream', data: Buffer.alloc(0) };
		const fileName = file.name.replace(/["\r\n]/g, (c) => encodeURIComponent(c));
		chunks.push(encodeCp1251(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${fileName}"\r\n`));
		chunks.push(Buffer.from(`Content-Type: ${file.contentType}\r\n\r\n`));
		chunks.push(file.data);
		chunks.push(Buffer.from('\r\n'));
	}
	chunks.push(Buffer.from(`--${boundary}--\r\n`));
	return {
		contentType: `multipart/form-data; boundary=${boundary}`,
		data: Buffer.concat(chunks),
	};
}
