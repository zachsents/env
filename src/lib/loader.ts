import fs from "fs/promises"
import path from "path"


export type EnvName = (string & {}) | "default"

export interface LoadEnvFileOptions {
    /**
     * The directory where the env file is located.
     * @default process.cwd()
     */
    dir?: string

    /**
     * Whether to load env files recursively.
     * @default false
     */
    recursive?: boolean
}


export async function loadEnvFile(envName: EnvName = "default", {
    dir = process.cwd(),
    recursive = false,
}: LoadEnvFileOptions = {}): Promise<string> {
    const filesToLookFor = envName === "default"
        ? [".env"]
        : [`.env.${envName.trim()}`, `${envName.trim()}.env`]

    let fileContent: string | null = null
    for (const file of filesToLookFor) {
        try {
            fileContent = await fs.readFile(path.join(dir, file), "utf-8")
            break
        } catch { }
    }

    if (fileContent == null && recursive) {
        const subdirs = await fs.readdir(dir, { withFileTypes: true })
            .then(files => files.filter(f => f.isDirectory()))

        for (const subdir of subdirs) {
            try {
                fileContent = await loadEnvFile(envName, {
                    dir: path.join(dir, subdir.name),
                    recursive,
                })
                break
            } catch { }
        }
    }

    if (fileContent == null)
        throw new Error(`Environment file for "${envName}" not found`)

    return fileContent
}