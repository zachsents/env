#!/usr/bin/env node
import { spawn } from "child_process"
import { parseArgs } from "util"
import { compileEnv } from "./lib/compiler"

const { values: options, positionals, tokens } = parseArgs({
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
        help: {
            type: "boolean",
            default: false,
        },
    },
    strict: true,
    allowPositionals: true,
    tokens: true,
})

if (options.help)
    sendHelpMessage()

const terminatorIndex = tokens.findIndex(t => t.kind === "option-terminator")
const hasTerminator = terminatorIndex !== -1

const subcommand = hasTerminator
    ? tokens.slice(0, terminatorIndex).filter(t => t.kind === "positional")[2]?.value
    : positionals[2]

switch (subcommand) {
    case "get": await getEnvVars()
        break
    case "run":
    case undefined:
        await runCommandWithEnv()
        break
    case "help":
    default:
        sendHelpMessage()
        break
}


async function runCommandWithEnv() {
    const terminatorIndex = tokens.findIndex(t => t.kind === "option-terminator")
    if (terminatorIndex === -1)
        return void sendHelpMessage()

    const command = tokens
        .slice(terminatorIndex + 1)
        .reduce((cmd, t) => t.kind === "positional" ? `${cmd} ${t.value}` : cmd, "")

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
}


async function getEnvVars() {
    const varNames = positionals.slice(3)

    const env = await compileEnv(options.env, {
        dir: options.dir,
        recursive: options.recursive,
    })
    const entireEnv = { ...process.env, ...env }

    const varValues = varNames.map(name => entireEnv[name] ?? "").join("\n")
    console.log(varValues)
}


function sendHelpMessage(exit = true, code = 1) {
    console.log(`
Usage:
  zenv [options] run -- [command]
  zenv [options] get [var1 var2 ...]
  zenv help

Options:
  -e, --env <env>         The environment to use (default: "default")
  -d, --dir <dir>         The directory to use (default: ".")
  -r, --recursive         Recursively search for .env files
  --help                  Show this help message and exit

Commands:
  run                     Execute a command with the specified environment variables
  get                     Retrieve specified environment variables
  help                    Show this help message and exit

Examples:
  zenv --env prod run -- echo "Hello World"     # Run a command with environment variables from the 'prod' environment
  zenv --dir ./config get VAR1 VAR2             # Get the values of VAR1 and VAR2 from the environment
  zenv help                                     # Show help message

Description:
  zenv is a CLI tool for managing and executing commands with environment variables.
  Use "run" to execute a command with the specified environment variables.
  Use "get" to retrieve the values of specified environment variables.
  Use "help" to display this message.
`)
    if (exit)
        process.exit(code)
}
