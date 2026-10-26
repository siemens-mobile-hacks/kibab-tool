#!/usr/bin/env node
import { program } from 'commander';
import { createAppCommand } from '#src/utils/command.js';
import { getVersion } from '#src/utils/version.js';
import { cliLogin, cliLogout } from '#src/cli/auth.js';
import { cliModels, cliPatches, cliSearch } from '#src/cli/list.js';
import { addPatchEditOptions, addPatchOptions, cliPatchAdd, cliPatchEdit, cliPatchGet } from '#src/cli/patch.js';

process.stdout.on('error', (e: NodeJS.ErrnoException) => {
	if (e.code != 'EPIPE')
		throw e;
	process.exit();
});

program
	.name('kibab-tool')
	.version(getVersion(), '-v, --version')
	.description('CLI tool for patches.kibab.com.');

program
	.command('login')
	.description('Log in with password and save session')
	.option('-l, --login <login>', 'Login (or KIBAB_LOGIN env)')
	.option('-p, --password <password>', 'Password (or KIBAB_PASSWORD env)')
	.option('-J, --json', 'Output result as JSON')
	.action(createAppCommand(cliLogin));

program
	.command('logout')
	.description('Delete saved session')
	.option('-J, --json', 'Output result as JSON')
	.action(createAppCommand(cliLogout));

program
	.command('models')
	.description('List phone models')
	.option('-J, --json', 'Output result as JSON')
	.action(createAppCommand(cliModels));

program
	.command('patches <model>')
	.description('List patches for the phone model, e.g. S75v52')
	.option('-J, --json', 'Output result as JSON')
	.action(createAppCommand(cliPatches));

program
	.command('search <query>')
	.description('Search patches by name')
	.option('-J, --json', 'Output result as JSON')
	.action(createAppCommand(cliSearch));

program
	.command('patch-get <id>')
	.description('Print patch fields')
	.option('-J, --json', 'Output result as JSON')
	.action(createAppCommand(cliPatchGet));

addPatchEditOptions(program
	.command('patch-edit <id>')
	.description('Edit patch, fields not specified in options are kept as is'))
	.action(createAppCommand(cliPatchEdit));

addPatchOptions(program
	.command('patch-add')
	.description('Add new patch'))
	.action(createAppCommand(cliPatchAdd));

program.parse();
