import { z } from "zod"
import { EnvironmentError } from "./errors"
import type { EnvParser } from "./parser"


const Patterns = {
    FileNameStyle1: /^(?:(?<name>.+)\.)?env\.json$/,
    FileNameStyle2: /^env(?:\.(?<name>.+))?\.json$/,
}

export const jsonEnvParser = (name = "json"): EnvParser => ({
    name,

    testFileName(fileName) {
        return Patterns.FileNameStyle1.test(fileName)
            || Patterns.FileNameStyle2.test(fileName)
    },

    parseFileName(fileName, defaultName) {
        const match = fileName.match(Patterns.FileNameStyle1)
            ?? fileName.match(Patterns.FileNameStyle2)
        return match?.groups?.name ?? defaultName
    },

    parse(content) {
        try {
            var parsedContent = JSON.parse(content)
        } catch (err) {
            throw new EnvironmentError("FAILED_PARSING_ENV_FILE", err as any)
        }

        return z.record(z.union([
            z.object({
                value: z.string().nullable(),
                preserve: z.boolean().optional().default(false),
            }),
            z.string().transform(value => ({
                value,
                preserve: false,
            })),
        ])).transform(record =>
            Object.entries(record).map(([k, v]) => ({
                name: k.toUpperCase(),
                ...v,
            }))
        ).parse(parsedContent)
    },
})
