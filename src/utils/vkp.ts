import { styleText } from 'node:util';

export function renderPatchCode(text: string): string {
	return text.split('\n').map((line) => `${styleText('dim', '│')} ${renderPatchLine(line)}`).join('\n');
}

function renderPatchLine(line: string): string {
	const commentStart = line.indexOf(';');
	const code = commentStart < 0 ? line : line.slice(0, commentStart);
	const comment = commentStart < 0 ? '' : styleText('dim', line.slice(commentStart));
	const address = code.match(/^(\s*[0-9a-fx]+:)(.*)$/i);
	if (address)
		return `${styleText('yellow', address[1]!)}${address[2]}${comment}`;
	if (/^\s*[#+-]/.test(code))
		return `${styleText('magenta', code)}${comment}`;
	return `${code}${comment}`;
}
