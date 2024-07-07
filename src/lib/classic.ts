import { type EnvParser } from "./parser"
import { type VariableFlag } from "./types"

const Patterns = {
    FileNameStyle1: /^\.env(?:\.(?<name>.+))?$/,
    FileNameStyle2: /^(?<name>.+)\.env$/,
    FindVariables: /(?:^# ?\/(.*)\s+)?^(\w+)=(?:([^\n"].*)|(?:"([\s\S]*?)(?<!\\)"))?/gm,
}

export const classicEnvParser = (name = "classic"): EnvParser => ({
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
        const matches = content
            .replaceAll("\r", "")
            .matchAll(Patterns.FindVariables)

        return Array.from(matches).map(match => {
            const [, flagStr, name, unquotedContent, quotedContent] = match

            // trim unquoted, leave quoted as is
            const value = unquotedContent
                ? unquotedContent.trim()
                : quotedContent

            // parse out flags
            const flags = Array.from(new Set(
                flagStr?.toLowerCase().match(/\S+/g)
            ))

            return {
                name: name.toUpperCase().trim(),
                value: value || null,
                preserve: flags.includes("preserve" satisfies VariableFlag),
            }
        })
    },
})