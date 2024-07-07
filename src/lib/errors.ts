

type EnvironmentErrorCode = "FAILED_LOADING_CONFIG_FILE" | "FAILED_PARSING_CONFIG_FILE"
    | "FAILED_PARSING_ENV_FILE" | "INVALID_COMPUTATION_EXPRESSION"


export class EnvironmentError extends Error {
    name: string = "EnvironmentError"

    constructor(
        public code: EnvironmentErrorCode,
        cause?: string | Error
    ) {
        super(code)

        if (!cause)
            return
        else if (typeof cause === "string")
            this.cause = cause
        else if (cause instanceof Error)
            this.cause = cause.message
    }
}