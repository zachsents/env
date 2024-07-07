import type { EnvironmentVariableEntry } from "./types"


export interface EnvParser {
    name: string

    /**
     * Tests a file name to see if this parser should be used
     */
    testFileName: (fileName: string) => boolean

    /** 
     * Parses the environment name from a file name.
     * e.g. .env.development -> development, test.env.json -> test
     */
    parseFileName: (fileName: string, defaultName: string) => string

    /**
     * Parses content from an env file into environment variable
     * entries. Entries are returned in the order they're found
     * in the content.
     */
    parse: (content: string) => EnvironmentVariableEntry[] | Promise<EnvironmentVariableEntry[]>
}