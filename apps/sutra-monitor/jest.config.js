/** @type {import('jest').Config} */
module.exports = {
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: './tsconfig.json',
        }],
    },
    moduleNameMapper: {
        '^@lwbeta/utils$': '<rootDir>/../../packages/utils/src/index.ts',
        '^@lwbeta/utils/(.*)$': '<rootDir>/../../packages/utils/src/$1',
        '^@lwbeta/types$': '<rootDir>/../../packages/types/src/index.ts',
        '^@lwbeta/types/(.*)$': '<rootDir>/../../packages/types/src/$1',
        '^@lwbeta/db$': '<rootDir>/../../packages/db/src/index.ts',
    },
    testEnvironment: 'node',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
};
