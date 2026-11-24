import fs from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import type { KibabPatchFields } from '#src/index.js';
import {
	E2E, PATCH_ID, cli, downloadFile, downloadPatch, encodePatchText, expectFailure, expectSuccess, getDetails,
	getFields, makePng, makeTmpDir, makeZip, normalizeFields, restoreFields, writeTmpFile, type PatchDetails,
} from '#tests/utils.js';

const TRICKY = `Тест «kibab-tool» №1 & = + % ; " ' <b>x</b>`;

function edit(...args: string[]) {
	return cli(['patch-edit', PATCH_ID, '--no-update-date', ...args]);
}

describe.skipIf(!E2E)('patch-edit', () => {
	let snapshot: KibabPatchFields;
	let initial: PatchDetails;
	let tmpDir: string;

	beforeAll(async () => {
		tmpDir = makeTmpDir();
		snapshot = await getFields();
		initial = await getDetails();
		expect(initial.screenshot, 'test patch must not have a screenshot').toBeUndefined();
		expect(initial.attachment, 'test patch must not have an attachment').toBeUndefined();
	});

	afterEach(async () => {
		await restoreFields(snapshot);
		expect((await getDetails()).updated, 'update date must not change').toBe(initial.updated);
	});

	afterAll(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	test('patch-get returns the same data as the public page', async () => {
		expect(initial.rows['Название']).toBe(`${snapshot.p_name_RU}\n${snapshot.p_name_EN}`);
		expect(initial.rows['Версия']).toBe(snapshot.p_ver);
		expect(initial.rows['Автор']).toBe(snapshot.p_c);
		expect((await downloadPatch()).includes(encodePatchText(snapshot.p_text!))).toBe(true);
	});

	test('--dry-run saves nothing', async () => {
		const result = JSON.parse(expectSuccess(await edit('--ver', '9.9', '--dry-run', '-J')).stdout);
		expect(result).toEqual({
			id: +PATCH_ID, status: 'dry-run', changes: [{ field: 'p_ver', old: snapshot.p_ver, new: '9.9' }], uploads: [], deletes: [],
		});
		expect(await getFields()).toEqual(snapshot);
	});

	test('unchanged patch is not saved', async () => {
		expect(expectSuccess(await edit('--ver', snapshot.p_ver!)).stdout).toBe(`Patch ${PATCH_ID} is up to date.\n`);
	});

	test.each([
		{ args: ['--ver', '12345678'], error: /Value of p_ver is too long/ },
		{ args: ['--filename', 'bad name'], error: /File name may contain only latin letters/ },
	])('values changed by the site are rejected before saving: $args', async ({ args, error }) => {
		expectFailure(await edit(...args), error);
		expect(await getFields()).toEqual(snapshot);
	});

	test('--force keeps all fields', async () => {
		expectSuccess(await edit('--force'));
		expect(normalizeFields(await getFields())).toEqual(normalizeFields(snapshot));
	});

	test('special characters', async () => {
		expectSuccess(await edit('--respect', TRICKY));
		expect(await getFields()).toEqual({ ...snapshot, p_r: TRICKY });
	});

	test('--beta / --no-beta', async () => {
		expectSuccess(await edit('--beta'));
		expect((await getFields()).is_beta).toBe('2');
		expectSuccess(await edit('--no-beta'));
		expect((await getFields()).is_beta).toBe('1');
	});

	// Graphic patches require a screenshot
	test('server error is reported', async () => {
		expectFailure(await edit('--type', 'Графический'), /^ERROR: Patch is not saved: Для графического патча скриншот обязателен \(EXC \d+\)$/m);
	});

	// The site ignores the patch body for patches without MP+FL concept, like ELKA ones
	test('field ignored by the site is reported', async () => {
		expectFailure(await edit('--insertion-for', '10395'), /field "p_body" is not: sent "10395", saved "0"/);
	});

	test.each([
		{ name: 'cp1251.vkp', encode: encodePatchText },
		{ name: 'utf8.vkp', encode: (text: string) => Buffer.from(text) },
	])('--patch-file from $name', async ({ name, encode }) => {
		const text = `${snapshot.p_text!.trimEnd()}\n; kibab-tool e2e: тест «№1»`;
		expectSuccess(await edit('--patch-file', writeTmpFile(tmpDir, name, encode(text))));
		expect((await downloadPatch()).includes(encodePatchText(text))).toBe(true);
	});

	test('editing other fields keeps screenshot and attachment', async () => {
		const png = makePng();
		const zip = makeZip('readme.txt', Buffer.from('kibab-tool e2e'));
		try {
			expectSuccess(await edit('--screenshot', writeTmpFile(tmpDir, 'keep.png', png), '--attachment', writeTmpFile(tmpDir, 'keep.zip', zip)));
			expectSuccess(await edit('--respect', 'keep'));
			const details = await getDetails();
			expect(await downloadFile(details.screenshot!)).toEqual(png);
			expect(await downloadFile(details.attachment!)).toEqual(zip);
		} finally {
			expectSuccess(await edit('--delete-screenshot', '--delete-attachment'));
		}
		const details = await getDetails();
		expect(details.screenshot).toBeUndefined();
		expect(details.attachment).toBeUndefined();
	});
});
