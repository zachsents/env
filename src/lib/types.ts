import { z } from "zod"


/** 
 * Parses the environment name from a file name.
 * e.g. .env.development -> development, test.env.json -> test
 */
export type EnvFileNameParser = (fileName: string, defaultName: string) => string | null


export const EnvironmentProfileSchema = z.object({
    environments: z.string().array().min(1)
        .nullable().optional().default(null)
        .describe("Names of environments to include. Default behavior is overriding. Environments are merged in order from first to last."),
    include: z.union([
        z.string().array(),
        z.record(z.union([z.string(), z.boolean()])),
    ])
        .nullable().optional().default(null)
        .describe("If an array is given, these are the names of the variables to include. If an object is given, the keys are the names of the variables to include and the values are either a new name for the variable or a boolean indicating whether to include the variable."),
    exclude: z.string().array()
        .nullable().optional().default(null)
        .describe("Names of the variables to exclude. Ignored if `include` is given."),
})

export type EnvironmentProfile = z.infer<typeof EnvironmentProfileSchema>

export const EnvironmentConfigSchema = z.object({
    profiles: z.record(z.union([
        z.string().array().transform(value => ({
            environments: value,
            include: null,
            exclude: null,
        })),
        EnvironmentProfileSchema,
    ])),
})

export type EnvironmentConfig = z.infer<typeof EnvironmentConfigSchema>

export type EnvironmentEntry = {
    name: string
    variables: EnvironmentVariableEntry[]
}

export type EnvironmentFileEntry = {
    filePath: string
    envName: string
    type: string
}

export type EnvironmentVariableEntry = {
    name: string
    value: string | null
    preserve: boolean
}

export type VariableFlag = "preserve"
