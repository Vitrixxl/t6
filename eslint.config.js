import babelParser from '@babel/eslint-parser';
import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
    {
        ignores: [
            'dist',
            'node_modules',
            // Worktrees git des sessions d'agents : ce sont d'autres branches, pas ce depot.
            '.claude',
            '.venv',
            'output',
            'tmp',
            'public/sw.js',
            'public/icons',
            'scripts/make-screens.mjs',
            'scripts/e2e-planning.mjs',
            'scripts/audit-a11y.mjs',
            'scripts/perf-bench.mjs',
            'scripts/build-metrics.mjs',
        ],
    },
    js.configs.recommended,
    {
        // Scripts d'outillage executes par Node : leurs globales ne sont pas celles
        // du navigateur.
        files: ['scripts/**/*.mjs'],
        languageOptions: {
            globals: { process: 'readonly', console: 'readonly' },
        },
    },
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: babelParser,
            ecmaVersion: 2022,
            sourceType: 'module',
            parserOptions: {
                requireConfigFile: false,
                babelOptions: {
                    babelrc: false,
                    configFile: false,
                    presets: [
                        ['@babel/preset-typescript', { allExtensions: true, isTSX: true }],
                    ],
                    plugins: ['@babel/plugin-syntax-jsx'],
                },
            },
        },
        plugins: {
            'jsx-a11y': jsxA11y,
            'react-hooks': reactHooks,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            ...jsxA11y.configs.recommended.rules,
            'no-undef': 'off',
            // Babel retire les annotations avant l'analyse des portees. TypeScript
            // reste l'autorite pour les symboles inutilises et les types implicites.
            'no-unused-vars': 'off',
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'TSAnyKeyword',
                    message: 'Le type any est interdit : decrire le contrat attendu.',
                },
            ],
        },
    },
];
