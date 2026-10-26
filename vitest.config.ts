import { defineConfig } from 'vitest/config';

export default defineConfig({
	ssr: {
		resolve: {
			conditions: ['source'],
		},
	},
	test: {
		include: ['tests/**/*.test.ts'],
		fileParallelism: false,
		testTimeout: 120000,
		hookTimeout: 120000,
	},
});
