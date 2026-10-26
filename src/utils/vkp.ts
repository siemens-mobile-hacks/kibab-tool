import { styleText } from 'node:util';
import { vkpParse, vkpRawParser } from '@sie-js/vkp';
import { VkpLexer, type VkpTokenType } from '@sie-js/vkp/dist/src/lexer.js';

type Style = Parameters<typeof styleText>[0];

const TOKEN_STYLES: Partial<Record<VkpTokenType, Style>> = {
	COMMENT:			'gray',
	MULTILINE_COMMENT:	'gray',
	UNFINISHED_COMMENT:	'gray',
	PRAGMA:				'magenta',
	OFFSET:				'magenta',
	ADDRESS:			'yellow',
	ERROR:				'red',
};

const DATA_TOKENS: VkpTokenType[] = ['DATA', 'NUMBER', 'PLACEHOLDER', 'STRING'];

export function renderPatchCode(text: string): string {
	const [error] = vkpParse(text).errors;
	if (error)
		return `${styleText('red', 'Patch error:')} ${error.message}\n${error.codeFrame(text)}\n${text}`;

	const newDataColumns = new Map<number, number>();
	vkpRawParser(text, {
		onPatchData(data) {
			newDataColumns.set(data.new.loc.line, data.new.loc.column);
		},
	});

	let result = '';
	for (const token of VkpLexer.reset(text)) {
		let style = TOKEN_STYLES[token.type as VkpTokenType];
		if (DATA_TOKENS.includes(token.type as VkpTokenType))
			style = token.col < (newDataColumns.get(token.line) ?? 0) ? 'red' : 'green';
		result += token.text.split('\n').map((part) => part && style ? styleText(style, part) : part).join('\n');
	}
	return result;
}
