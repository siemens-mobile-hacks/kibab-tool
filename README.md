[![NPM Version](https://img.shields.io/npm/v/%40sie-js%2Fkibab-tool)](https://www.npmjs.com/package/@sie-js/kibab-tool)

# SUMMARY

A console utility for [patches.kibab.com](https://patches.kibab.com): search, list and edit patches.

# INSTALL

```bash
npm install -g @sie-js/kibab-tool@latest
```

# USAGE

```
Usage: kibab-tool [options] [command]

CLI tool for patches.kibab.com.

Options:
  -v, --version              output the version number
  -h, --help                 display help for command

Commands:
  login [options]            Log in with password and save session
  logout [options]           Delete saved session
  models [options]           List phone models
  patches [options] <model>  List patches for the phone model, e.g. S75v52
  search [options] <query>   Search patches by name
  patch-get [options] <id>   Print patch fields
  patch-edit [options] <id>  Edit patch, fields not specified in options are
                             kept as is
  patch-add [options]        Add new patch
  help [command]             display help for command
```

### Login

The session is saved to the OS cache directory (`~/.cache/kibab-tool` on Linux).

```bash
kibab-tool login                                  # interactive
kibab-tool login -l LOGIN -p PASSWORD
KIBAB_LOGIN=LOGIN KIBAB_PASSWORD=PASSWORD kibab-tool login
```

### Search

```bash
kibab-tool models
kibab-tool patches S75v52
kibab-tool search ElfPack
kibab-tool patch-get 10738
```

### Edit

`patch-edit` loads the current patch and changes only the specified fields. Changes are verified after saving.

```bash
kibab-tool patch-edit 10738 --ver 3.3 --patch-file ElfPack_CL61v128.vkp --desc-file changelog.txt
kibab-tool patch-edit 10738 --respect "Azq2" --no-update-date     # typo fix, keep the update date
kibab-tool patch-edit 10738 --screenshot screen.png --dry-run     # show changes only
kibab-tool patch-edit 10738 --delete-attachment
```

```
Usage: kibab-tool patch-edit [options] <id>

Edit patch, fields not specified in options are kept as is

Options:
  -m, --model <model>    Phone model (name or ID), e.g. S75
  -s, --sw <sw>          Phone firmware version, e.g. 52
  -n, --name <name>      Patch name (both RU and EN)
  --name-ru <name>       Patch name (RU)
  --name-en <name>       Patch name (EN)
  -a, --author <author>  (c) Author
  --porter <porter>      (p) Porter
  --respect <respect>    (r) Respect
  -f, --filename <name>  File name for storing (without .vkp)
  --ver <version>        Patch version
  --beta                 Mark as beta version
  --no-beta              Mark as stable version
  --type <type>          Patch type (name or ID)
  --desc <text>          Short description
  --desc-file <file>     Short description from file ("-" for stdin)
  --patch <code>         Patch code
  --patch-file <file>    Patch code from .vkp file ("-" for stdin)
  --deps <ids>           Dependencies (comma separated patch IDs)
  --conflicts <ids>      Conflicts (comma separated patch IDs)
  --update-of <id>       This patch is an update of another patch: ID of the
                         previous version (0 - none)
  --insertion-for <id>   This patch is an insertion for another patch: ID of the
                         patch body (0 - none)
  --screenshot <file>    Upload new screenshot (PNG, GIF, JPG, max 1 MB)
  --attachment <file>    Upload new attachment (RAR, ZIP, max 5 MB)
  --rss                  Announce the update in RSS (better to skip for typo
                         fixes)
  --no-update-date       Keep the previous patch update date (for typo fixes,
                         translations, etc)
  --dry-run              Show changes without saving
  --force                Save even if nothing changed
  -J, --json             Output result as JSON
  --delete-screenshot    Delete current screenshot
  --delete-attachment    Delete current attachment
  -h, --help             display help for command
```

### Add

```bash
kibab-tool patch-add --model CL61 --sw 128 --name "ElfPack" --author "Z.Vova" \
	--filename ElfPack_3_3 --ver 3.3 --patch-file ElfPack_CL61v128.vkp --desc "..."
```

### JSON

Every command supports `-J, --json`. Errors are printed as `{"error": "..."}` with exit code 1.

# AI-assisted contributions

We are not against AI. We are against vibe coding, AI slop, and attempts to offload engineering work to a model. This project prioritizes quality, not development speed or results at any cost.

1. **Do not use AI-generated text in human-to-human communication.**

   Write comments, discussions, PR descriptions, and responses to reviewers yourself.

2. **Do not let AI submit PRs or commits.**

   The author must always be a human who has personally reviewed the changes and takes responsibility for them.

4. **Do not submit code primarily designed or written by AI.**

   Architecture, algorithms, code organization, and the final implementation must be decided by a human. AI may only be used as an auxiliary tool.

6. **You must understand all the code you submit.**

   You must be able to explain every change, justify your decisions, and fix any problems yourself. If you do not understand the code, open a feature request instead of a PR.

8. **Code must be simple, clear, and tested.**

   Follow KISS, the project's coding style, and its existing architecture. Do not introduce unnecessary abstractions, dependencies, or untested changes.

AI slop PRs will be closed without review.
