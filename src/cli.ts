#!/usr/bin/env node
import { parseArgs } from "util"
import { spawn } from "child_process"
import { compileEnv } from "./lib/compiler"

const { values: options, tokens } = parseArgs({
    args: process.argv,
    options: {
        env: {
            type: "string",
            short: "e",
            default: "default",
        },
        dir: {
            type: "string",
            short: "d",
            default: ".",
        },
        recursive: {
            type: "boolean",
            default: false,
            short: "r",
        },
    },
    strict: true,
    allowPositionals: true,
    tokens: true,
})

const terminatorIndex = tokens.findIndex(t => t.kind === "option-terminator")
if (terminatorIndex === -1)
    sendHelpMessage()

const command = tokens.slice(terminatorIndex + 1).map(t => (t as any).value).join(" ")
const env = await compileEnv(options.env, {
    dir: options.dir,
    recursive: options.recursive,
})

await new Promise<void>((resolve) => {
    const cp = spawn(command, {
        env: { ...process.env, ...env },
        shell: true,
        stdio: "inherit",
    })

    cp.on("exit", () => void resolve())
})


function sendHelpMessage(exit = true, code = 1) {
    console.log("Usage: zenv [options] -- [command]")
    console.log("Options:")
    console.log("  -e, --env <env>      The environment to use")
    console.log("  -d, --dir <dir>      The directory to use")
    console.log("  -r, --recursive      Recursively search for .env files")
    if (exit)
        process.exit(code)
}