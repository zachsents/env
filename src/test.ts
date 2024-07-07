import { compileProfile, loadEnvironments } from "."
import { parseClassicEnv } from "./lib/classic"
import { parseJsonEnv } from "./lib/json"

// const result = await parseClassicEnvFile("test.env")

const result = await loadEnvironments()

console.log(compileProfile(["test"], result.environments))