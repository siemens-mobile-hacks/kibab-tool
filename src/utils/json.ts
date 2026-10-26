export interface JsonOptions {
	json?: boolean;
}

export function printJson(data: unknown): void {
	console.log(JSON.stringify(data, undefined, '\t'));
}
