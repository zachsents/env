import { compileEnv } from "./lib/compiler"
import type { EnvName, LoadEnvFileOptions } from "./lib/loader"


interface LoadEnvironmentOptions extends LoadEnvFileOptions {
    /**
     * The target object to assign the environment variables to.
     * @default process.env
     */
    target?: any
}

export async function loadEnvironment(envName: EnvName, {
    target = process.env,
    ...options
}: LoadEnvironmentOptions = {}) {
    const env = await compileEnv(envName, options)
    if (typeof target === "object" && target != null)
        Object.assign(target, env)
    return env
}
