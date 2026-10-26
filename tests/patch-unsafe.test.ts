import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { KibabPatchFields } from '#src/index.js';
import {
	E2E, PATCH_ID, cli, downloadPatch, encodePatchText, expectSuccess, getDetails, getFields, getRssPatchItems,
	makeTmpDir, restoreFields, writeTmpFile,
} from '#tests/utils.js';

// Each group has visible or irreversible effects on the site, so it is enabled separately
const MODEL = E2E && process.env.KIBAB_E2E_MODEL == '1';
const RSS = E2E && process.env.KIBAB_E2E_RSS == '1';
const ADD = E2E && process.env.KIBAB_E2E_ADD == '1';

describe.skipIf(!MODEL && !RSS && !ADD)('patch unsafe', () => {
	let snapshot: KibabPatchFields;
	let tmpDir: string;

	beforeAll(async () => {
		tmpDir = makeTmpDir();
		snapshot = await getFields();
	});

	afterAll(async () => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
		await restoreFields(snapshot);
	});

	test.skipIf(!MODEL)('--model / --sw', async () => {
		try {
			expectSuccess(await cli(['patch-edit', PATCH_ID, '--no-update-date', '--model', 'E71', '--sw', '45']));
			expect((await getDetails()).rows['Модель']).toBe('E71v45');
		} finally {
			await restoreFields(snapshot);
		}
	});

	test.skipIf(!RSS)('--rss', async () => {
		const feed = (await getDetails()).rows['Модель']!;
		const before = await getRssPatchItems(feed);
		expectSuccess(await cli(['patch-edit', PATCH_ID, '--no-update-date', '--force', '--rss']));
		expect(await getRssPatchItems(feed)).toHaveLength(before.length + 1);
	});

	test.skipIf(!ADD)('patch-add', async () => {
		const text = '; kibab-tool e2e test\r\n; тест\r\n';
		const result = expectSuccess(await cli([
			'patch-add',
			'--model', 'CL61',
			'--sw', '128',
			'--name', 'kibab-tool e2e test',
			'--author', 'kibab-tool',
			'--filename', 'kibab_tool_e2e',
			'--desc', 'Тестовый патч kibab-tool, удалить.',
			'--patch-file', writeTmpFile(tmpDir, 'add.vkp', encodePatchText(text)),
		]));
		const id = result.stdout.match(/Patch added: .*[?&]id=(\d+)/)?.[1];
		expect(id, result.stdout).toBeDefined();
		console.warn(`Added test patch ${id}, delete it manually!`);

		expect((await getDetails(id)).rows['Модель']).toBe('CL61v128');
		expect((await downloadPatch(id)).includes(encodePatchText(text.trim()))).toBe(true);
	});
});
