import fs from "fs/promises"
import path from "path"
import { EnvironmentError } from "./lib/errors"
import type { EnvParser } from "./lib/parser"
import { EnvironmentConfigSchema, type EnvironmentConfig, type EnvironmentFileEntry, type EnvironmentProfile } from "./lib/types"
import { classicEnvParser } from "./lib/classic"
import { jsonEnvParser } from "./lib/json"
import { EventEmitter } from "node:events"
import { parseExpression } from "./lib/expressions"


export interface EnvOptions {
    /**
     * The directory where environment files and the env.config.json file
     * are located.
     * @default process.cwd()
     */
    envDir?: string
    configFileName?: string
    defaultEnvironmentName?: string
    parsers?: EnvParser[]
}

export class Env {
    protected options: Required<EnvOptions>

    private _config: EnvironmentConfig | null = null
    private _environmentFiles: EnvironmentFileEntry[] | null = null

    constructor(options: EnvOptions = {}) {
        this.options = {
            envDir: process.cwd(),
            configFileName: "env.config.json",
            defaultEnvironmentName: "default",
            parsers: [],
            ...options,
        }
    }

    async loadConfig(forceLoad = false): Promise<EnvironmentConfig> {
        if (this._config && !forceLoad)
            return this._config

        const configContentsStr = await fs.readFile(
            path.join(this.options.envDir, this.options.configFileName),
            "utf-8"
        ).catch(err => {
            throw new EnvironmentError("FAILED_LOADING_CONFIG_FILE", err)
        })

        try {
            var parsedConfigContents: unknown = JSON.parse(configContentsStr)
        } catch (err) {
            throw new EnvironmentError("FAILED_PARSING_CONFIG_FILE", "Invalid JSON")
        }

        this._config = EnvironmentConfigSchema.parse(parsedConfigContents)
        return this._config
    }

    async findEnvironmentFiles(forceLoad = false): Promise<EnvironmentFileEntry[]> {
        if (this._environmentFiles && !forceLoad)
            return this._environmentFiles

        const envDirFiles = await fs.readdir(this.options.envDir, {
            withFileTypes: true
        })

        this._environmentFiles = []

        for (const f of envDirFiles) {
            if (!f.isFile())
                continue
            if (f.name === this.options.configFileName)
                continue

            const parser = this.options.parsers.find(p => p.testFileName(f.name))
            if (!parser)
                continue


            this._environmentFiles.push({
                envName: parser.parseFileName(f.name, this.options.defaultEnvironmentName),
                type: parser.name,
                filePath: path.join(this.options.envDir, f.name),
            })
        }

        return this._environmentFiles
    }

    async compileProfile(profileName: string = this.options.defaultEnvironmentName) {

        const config = await this.loadConfig()
        const files = await this.findEnvironmentFiles()

        const profile = config.profiles[profileName]
        if (!profile)
            throw new Error(`Profile "${profileName}" not found`)

        const fileEntries = profile.environments?.flatMap(
            name => files.filter(f => f.envName === name)
        ) ?? files

        // Parse and merge all environment files
        const envEntries = await Promise.all(
            fileEntries.map(async entry => {
                const fileContent = await fs.readFile(entry.filePath, "utf-8")

                const parser = this.options.parsers.find(p => p.name === entry.type)
                if (!parser) return []

                return Promise.resolve(parser.parse(fileContent))
            })
        ).then(arr => arr.flat())

        // Do overwriting
        const varsToPreserve = new Set<string>()
        const env = envEntries.reduce((acc, entry) => {
            if (!varsToPreserve.has(entry.name))
                acc[entry.name] = entry.value

            if (entry.preserve)
                varsToPreserve.add(entry.name)

            return acc
        }, {} as Record<string, string | null>)

        // Handle computation
        const variableCache: Record<string, string | null> = {}
        const getComputedVariable = async (name: string) => {
            if (!(name in variableCache)) {
                variableCache[name] = env[name] == null
                    ? null
                    : await parseExpression(env[name]!).resolve(getComputedVariable)
            }
            return variableCache[name]
        }

        const computedEnv = await Promise.all(
            Object.keys(env).map(async k => [k, await getComputedVariable(k)])
        ).then(Object.fromEntries)

        return computedEnv
    }
}


const env = new Env({
    envDir: "src/tests/setups/config2",
    parsers: [classicEnvParser(), jsonEnvParser()],
})

await env.compileProfile("prod")
    .then(x => console.log("prod", x))
await env.compileProfile("dev")
    .then(x => console.log("dev", x))
