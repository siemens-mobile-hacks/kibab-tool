import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';
import { expect } from 'vitest';
import { KIBAB_URL, KibabAPI, loadSession, type KibabPatchFields } from '#src/index.js';

interface CliResult {
	code: number;
	stdout: string;
	stderr: string;
}

interface CliOptions {
	input?: string | Buffer;
	env?: NodeJS.ProcessEnv;
}

export interface PatchDetails {
	rows: Record<string, string>;
	updated: string | undefined;
	screenshot: string | undefined;
	attachment: string | undefined;
}

export const PATCH_ID = process.env.KIBAB_TEST_PATCH ?? '';
export const E2E = process.env.KIBAB_E2E == '1' && PATCH_ID != '';

const CLI = path.join(import.meta.dirname, '..', 'dist', 'src', 'cli.js');

export function cli(args: string[], options: CliOptions = {}): Promise<CliResult> {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [CLI, ...args], {
			env: { ...process.env, ...options.env },
			stdio: ['pipe', 'pipe', 'pipe'],
		});
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout.on('data', (data: Buffer) => stdout.push(data));
		child.stderr.on('data', (data: Buffer) => stderr.push(data));
		child.on('error', reject);
		child.on('close', (code) => resolve({
			code: code ?? -1,
			stdout: Buffer.concat(stdout).toString(),
			stderr: Buffer.concat(stderr).toString(),
		}));
		child.stdin.end(options.input);
	});
}

export function expectSuccess(result: CliResult): CliResult {
	expect(result.stderr, result.stdout).toBe('');
	expect(result.code).toBe(0);
	return result;
}

export function expectFailure(result: CliResult, message: RegExp): CliResult {
	expect(result.code).toBe(1);
	expect(result.stderr).toMatch(message);
	return result;
}

export function isolatedCacheEnv(dir: string): NodeJS.ProcessEnv {
	return { HOME: dir, XDG_CACHE_HOME: path.join(dir, '.cache'), LOCALAPPDATA: dir };
}

export function makeTmpDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), 'kibab-tool-'));
}

export function writeTmpFile(dir: string, name: string, data: string | Buffer): string {
	const file = path.join(dir, name);
	fs.writeFileSync(file, data);
	return file;
}

export async function getFields(id: string = PATCH_ID): Promise<KibabPatchFields> {
	const result = expectSuccess(await cli(['patch-get', id, '--json']));
	return JSON.parse(result.stdout) as KibabPatchFields;
}

export function normalizeFields(fields: KibabPatchFields): KibabPatchFields {
	return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.replace(/\r\n/g, '\n').trim()]));
}

// Restore through the API, so a broken CLI can't leave the patch modified
export async function restoreFields(snapshot: KibabPatchFields): Promise<void> {
	if (JSON.stringify(normalizeFields(await getFields(snapshot.id))) == JSON.stringify(normalizeFields(snapshot)))
		return;
	const api = new KibabAPI(loadSession());
	await api.savePatch({ ...snapshot, no_upd_date: 'on' });
	expect(normalizeFields(await getFields(snapshot.id))).toEqual(normalizeFields(snapshot));
}

async function fetchPublic(url: string): Promise<Buffer> {
	const response = await fetch(new URL(url, KIBAB_URL));
	expect(response.status, url).toBe(200);
	return Buffer.from(await response.arrayBuffer());
}

export async function getDetails(id: string = PATCH_ID): Promise<PatchDetails> {
	const html = iconv.decode(await fetchPublic(`/patches/details.php5?id=${id}`), 'win1251');
	const $ = cheerio.load(html.replace(/<br\s*\/?>/gi, '\n'));
	const content = $('div.maintext').first();
	const table = content.find('table.maintext').first();

	const rows: Record<string, string> = {};
	for (const tr of table.find('> tbody > tr, > tr')) {
		const cells = $(tr).children('td');
		rows[cells.eq(0).text().replace(/:$/, '').trim()] = cells.eq(1).text().trim();
	}

	return {
		rows,
		updated: content.text().match(/Обновлён (\d\d\.\d\d\.\d{4} \d\d:\d\d)/)?.[1],
		screenshot: table.find('img[src*="/img/screenshots/"]').attr('src'),
		attachment: table.find('a[href*="cnt.php5"]').attr('href'),
	};
}

export function downloadFile(url: string): Promise<Buffer> {
	return fetchPublic(url);
}

export function downloadPatch(id: string = PATCH_ID): Promise<Buffer> {
	return fetchPublic(`/patches/dn.php5?id=${id}`);
}

export function encodePatchText(text: string): Buffer {
	return iconv.encode(text.replace(/\r?\n/g, '\r\n'), 'win1251');
}

export async function getRssPatchItems(feed: string, id: string = PATCH_ID): Promise<string[]> {
	const xml = iconv.decode(await fetchPublic(`/rss/${feed}.xml`), 'win1251');
	const $ = cheerio.load(xml, { xml: true });
	return $('item guid').toArray()
		.map((guid) => $(guid).text())
		.filter((guid) => new URL(guid).searchParams.get('id') == id);
}

export function makePng(): Buffer {
	const chunk = (type: string, data: Buffer) => {
		const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
		const header = Buffer.alloc(4);
		header.writeUInt32BE(data.length);
		const crc = Buffer.alloc(4);
		crc.writeUInt32BE(zlib.crc32(body));
		return Buffer.concat([header, body, crc]);
	};
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(1, 0);
	ihdr.writeUInt32BE(1, 4);
	ihdr.writeUInt8(8, 8);
	ihdr.writeUInt8(2, 9);
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
		chunk('IHDR', ihdr),
		chunk('IDAT', zlib.deflateSync(Buffer.from([0, 0xFF, 0x00, 0x00]))),
		chunk('IEND', Buffer.alloc(0)),
	]);
}

export function makeZip(name: string, data: Buffer): Buffer {
	const fileName = Buffer.from(name, 'ascii');
	const crc = zlib.crc32(data);

	const local = Buffer.alloc(30);
	local.writeUInt32LE(0x04034B50, 0);
	local.writeUInt16LE(10, 4);
	local.writeUInt32LE(crc, 14);
	local.writeUInt32LE(data.length, 18);
	local.writeUInt32LE(data.length, 22);
	local.writeUInt16LE(fileName.length, 26);

	const central = Buffer.alloc(46);
	central.writeUInt32LE(0x02014B50, 0);
	central.writeUInt16LE(10, 4);
	central.writeUInt16LE(10, 6);
	central.writeUInt32LE(crc, 16);
	central.writeUInt32LE(data.length, 20);
	central.writeUInt32LE(data.length, 24);
	central.writeUInt16LE(fileName.length, 28);

	const centralOffset = local.length + fileName.length + data.length;
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054B50, 0);
	end.writeUInt16LE(1, 8);
	end.writeUInt16LE(1, 10);
	end.writeUInt32LE(central.length + fileName.length, 12);
	end.writeUInt32LE(centralOffset, 16);

	return Buffer.concat([local, fileName, data, central, fileName, end]);
}
