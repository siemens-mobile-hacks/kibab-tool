import { inspect, styleText } from 'node:util';

type Style = Parameters<typeof styleText>[0];

interface Tag {
	name: string;
	style: Style | undefined;
}

const TAG_RE = /\[(\/?)(b|i|u|url|color|PatchID)(?:[:=]([^\]]*))?\]/gi;

export function renderBBCode(text: string): string {
	text = text.replace(/\[EN\]:?/g, '[b]English:[/b]');
	const stack: Tag[] = [];
	let result = '';
	let last = 0;
	for (const m of text.matchAll(TAG_RE)) {
		result += styleSegment(text.slice(last, m.index), stack);
		last = m.index + m[0].length;
		const name = m[2]!.toLowerCase();
		if (m[1]) {
			if (stack.at(-1)?.name == name)
				stack.pop();
		} else {
			stack.push({ name, style: getTagStyle(name, m[3]) });
		}
	}
	return result + styleSegment(text.slice(last), stack);
}

function getTagStyle(name: string, param: string | undefined): Style | undefined {
	switch (name) {
		case 'b':
			return 'bold';
		case 'i':
			return 'italic';
		case 'u':
			return 'underline';
		case 'url':
			return ['blue', 'underline'];
		case 'patchid':
			return 'cyan';
		case 'color':
			if (param && /^#[0-9a-f]{6}$/i.test(param))
				return `#${param.slice(1)}`;
			if (param && param in inspect.colors)
				return param as Style;
			return undefined;
	}
	return undefined;
}

function styleSegment(text: string, stack: Tag[]): string {
	const styles = stack.flatMap((tag) => tag.style ?? []);
	return text && styles.length ? styleText(styles, text) : text;
}
