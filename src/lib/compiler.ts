import { Token, tokenize } from "./lexer"
import { loadEnvFile, type EnvName, type LoadEnvFileOptions } from "./loader"
import { operators } from "./operators"


/**
 * Does all loading & compilation steps needed to take an environment name
 * and return an object of variable values. 
 */
export async function compileEnv(envName?: EnvName, loadOpts?: LoadEnvFileOptions) {
    return loadEnvFile(envName, loadOpts)
        .then(tokenize)
        .then(t => mergeIncludes(t, loadOpts))
        .then(flattenOverrides)
        .then(assembleEnvObject)
}


/**
 * Splices in the tokenized contents of each included file into the main token tree.
 * Works recursively. Sort of. Effectively, not actually.
 */
async function mergeIncludes(rootToken: Token<"MAIN">, loadOpts?: LoadEnvFileOptions) {
    const tokens = [...rootToken.children]

    let nextInclude: Token | undefined
    while (nextInclude = tokens.find(t => t.type === "INCLUDE_FLAG")) {
        const resolvedEnv = tokenize(await loadEnvFile(nextInclude.value, loadOpts))
        tokens.splice(tokens.indexOf(nextInclude), 1, ...resolvedEnv.children)
    }

    return new Token("MAIN", undefined, tokens)
}


/**
 * Determines the "winning" assignment for each defined variable. The winner
 * is the last assigned value, unless a previous value is preceeded by a 
 * "preserve" flag.
 */
async function flattenOverrides(rootToken: Token<"MAIN">) {

    let tokens = [...rootToken.children]

    const varNames = new Set(tokens.filter(t => t.type === "ASSIGNMENT").map(t => t.value))

    varNames.forEach(name => {
        const ourAssignments = tokens.filter(t => t.type === "ASSIGNMENT" && t.value === name)

        const winningToken = ourAssignments.find(t => {
            const preceedingToken = tokens[tokens.indexOf(t) - 1]
            return preceedingToken?.type === "PRESERVE_FLAG"
        }) ?? ourAssignments.at(-1)!

        tokens = tokens.filter(t => !ourAssignments.includes(t) || t === winningToken)
    })

    return new Token("MAIN", undefined, tokens)
}


/**
 * Resolves the value of a given token. For interpolations, the `resolveVariableValue`
 * function is used to get the value of a variable. That function recursively calls
 * this function to resolve inner expressions. This continues until all values are
 * resolved. 
 */
async function resolveTokenValue(token: Token, resolveVariableValue: (name: string) => Promise<string | null>): Promise<string | null> {
    switch (token.type) {
        case "STRING": return token.value

        case "ASSIGNMENT":
        case "INTERPOLATION_EXPRESSION":
        case "QUOTED_STRING":
            return Promise.all(
                token.children.map(ct => resolveTokenValue(ct, resolveVariableValue))
            ).then(parts => parts.join(""))

        case "INTERPOLATION": {
            const expressions = token.children.filter(t => t.type === "INTERPOLATION_EXPRESSION")

            const operator = operators.find(op => op.symbols.includes(expressions.map(t => t.value).join(",")))
            if (!operator)
                throw new Error(`Unrecognized operator sequence: ${expressions.map(t => t.value).join(", ")}`)

            const varVal = await resolveVariableValue(token.value)
            const argGetters = expressions.map(t => () => resolveTokenValue(t, resolveVariableValue))

            const result = await operator.fn(varVal, ...argGetters)

            if (token.modifiers.has("length"))
                return (result?.length ?? 0).toString()

            return result
        }
    }
    return null
}


/**
 * Converts the token tree into an object containing the final values of all
 * defined environment variables.
 * 
 * Caches values to avoid recalculation, although this isn't a big performance
 * increase because the expressions are fairly simple. In theory, though, you
 * could fetch values from a remote source, because everything is done
 * asynchronously.
 */
async function assembleEnvObject(rootToken: Token<"MAIN">) {
    const tokens = [...rootToken.children]
    const env: Record<string, string> = {}

    async function getVariableValue(name: string) {
        if (!(name in env)) {
            const assignment = tokens.find(t => t.type === "ASSIGNMENT" && t.value === name)
            if (!assignment)
                return null

            const val = await resolveTokenValue(assignment, getVariableValue)
            if (val != null)
                env[name] = val
        }
        return env[name]
    }

    await Promise.all(
        Array.from(new Set(
            tokens.filter(t => t.type === "ASSIGNMENT").map(t => t.value)
        )).map(name => getVariableValue(name))
    )

    return env
}

