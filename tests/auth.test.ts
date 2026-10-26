import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { E2E, PATCH_ID, cli, expectFailure, expectSuccess, isolatedCacheEnv, makeTmpDir } from '#tests/utils.js';

const LOGIN = process.env.KIBAB_LOGIN;
const PASSWORD = process.env.KIBAB_PASSWORD;

describe.skipIf(!E2E)('auth', () => {
	let dir: string;
	let env: NodeJS.ProcessEnv;

	beforeEach(() => {
		dir = makeTmpDir();
		env = isolatedCacheEnv(dir);
	});

	afterEach(() => {
		fs.rmSync(dir, { recursive: true, force: true });
	});

	test('wrong password is rejected', async () => {
		expectFailure(await cli(['login', '-l', 'kibab_tool_no_such_user', '-p', 'wrong'], { env }), /Invalid login or password/);
		expectFailure(await cli(['patch-get', PATCH_ID], { env }), /Not logged in/);
	});

	test.skipIf(!LOGIN || !PASSWORD)('login and logout', async () => {
		const { sessionFile } = JSON.parse(expectSuccess(await cli(['login', '-l', LOGIN!, '-p', PASSWORD!, '-J'], { env })).stdout) as { sessionFile: string };
		expect(fs.statSync(sessionFile).mode & 0o777).toBe(0o600);
		expectSuccess(await cli(['patch-get', PATCH_ID], { env }));

		expectSuccess(await cli(['logout'], { env }));
		expectFailure(await cli(['patch-get', PATCH_ID], { env }), /Not logged in/);
	});
});
