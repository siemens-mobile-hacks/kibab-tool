import { beforeAll, describe, expect, test } from 'vitest';
import type { KibabModel, KibabPatchFields, KibabPatchListItem, KibabSearchResult } from '#src/index.js';
import { E2E, PATCH_ID, cli, expectSuccess, getDetails, getFields, type PatchDetails } from '#tests/utils.js';

async function cliJson<T>(...args: string[]): Promise<T> {
	return JSON.parse(expectSuccess(await cli([...args, '-J'])).stdout) as T;
}

describe.skipIf(!E2E)('lists', () => {
	let fields: KibabPatchFields;
	let details: PatchDetails;

	beforeAll(async () => {
		fields = await getFields();
		details = await getDetails();
	});

	test('models', async () => {
		const models = await cliJson<KibabModel[]>('models');
		expect(models).toContainEqual(expect.objectContaining({
			name:		details.rows['Модель'],
			sw:			fields.ph_sw,
			modelId:	+fields.ph_model!,
		}));
	});

	test('patches', async () => {
		const patches = await cliJson<KibabPatchListItem[]>('patches', details.rows['Модель']!);
		expect(patches).toContainEqual({
			id:			+PATCH_ID,
			nameRu:		`${fields.p_name_RU} v${fields.p_ver}`,
			nameEn:		`${fields.p_name_EN} v${fields.p_ver}`,
			author:		fields.p_c,
			porter:		fields.p_p,
			respect:	fields.p_r,
			added:		expect.stringMatching(/^\d{4}-\d\d-\d\d$/),
			updated:	details.updated!.split(' ')[0]!.split('.').reverse().join('-'),
		});
	});

	test('search', async () => {
		const results = await cliJson<KibabSearchResult[]>('search', fields.p_name_EN!);
		expect(results).toContainEqual(expect.objectContaining({ id: +PATCH_ID, model: details.rows['Модель'] }));
	});

	test('search with cyrillic query', async () => {
		const results = await cliJson<KibabSearchResult[]>('search', 'Библиотека функций');
		expect(results.length).toBeGreaterThan(0);
		for (const result of results)
			expect(`${result.nameRu}\n${result.nameEn}`.toLowerCase()).toContain('библиотека функций');
	});
});
