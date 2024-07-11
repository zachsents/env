
const TOKEN_TYPES = [
    "MAIN",
    "ASSIGNMENT",
    "INTERPOLATION",
    "INTERPOLATION_EXPRESSION",
    "QUOTED_STRING",
    "STRING",
    "COMMENT",
    "INCLUDE_FLAG",
    "PRESERVE_FLAG",
] as const
export type TokenType = typeof TOKEN_TYPES[number]


export class Token<T extends TokenType = TokenType> {
    modifiers = new Set<string>()

    constructor(
        public type: T,
        public value: string = "",
        public children: Token[] = [],
    ) { }

    push(token: Token) {
        this.children.push(token)
    }

    toString(indent = 0) {
        let str = `${this.type} (${this.value})`
        if (this.children.length > 0)
            str += "\n" + this.children.map(c => c.toString(indent + 1)).join("\n")
        return "  ".repeat(indent) + str
    }

    toJSON() {
        return this.toString()
    }
}

type LexerPattern = {
    regex: RegExp
    handler: LexerPatternHandler
    matchInside: TokenType[]
}

type LexerPatternHandler = (lexer: Lexer, match: RegExpMatchArray) => boolean | void

function createPattern(
    regex: RegExp,
    handler: LexerPatternHandler,
    matchInside: TokenType[] = [...TOKEN_TYPES],
): LexerPattern {
    return { regex, handler, matchInside }
}

function exceptTokens(...blacklist: TokenType[]) {
    return TOKEN_TYPES.filter(t => !blacklist.includes(t))
}

const simpleHandler = (tokenType: TokenType, empty = false): LexerPatternHandler => (lexer, match) => {
    lexer.push(new Token(tokenType, empty ? "" : (match[1] ?? match[0])))
    return true
}

const blockHandler = (tokenType: TokenType): LexerPatternHandler => (lexer, match) => {
    lexer.pushAndOpen(new Token(tokenType, match[1]))
    return true
}

const closeHandler = (tokenType: TokenType): LexerPatternHandler => (lexer) => {
    lexer.closeNearest(tokenType)
    return true
}

const lexerPatterns: LexerPattern[] = [
    // flags
    createPattern(/# ?\/ *include +"?([-\w\.$%]+)"?/, simpleHandler("INCLUDE_FLAG"), ["MAIN"]),
    createPattern(/# ?\/ *preserve */, simpleHandler("PRESERVE_FLAG", true), ["MAIN"]),

    // escaped characters
    createPattern(/\\(.)/, simpleHandler("STRING")),

    // assignments
    createPattern(/([A-Z_0-9]+)=/, blockHandler("ASSIGNMENT"), ["MAIN"]),
    createPattern(/$/m, closeHandler("ASSIGNMENT"), ["ASSIGNMENT"]),

    // --- Interpolations ---

    // interoplation w/ length modifier
    createPattern(/\$\{ *# *([A-Z_0-9]+) */, (lexer, match) => {
        const newToken = new Token("INTERPOLATION", match[1])
        newToken.modifiers.add("length")
        lexer.pushAndOpen(newToken)
        return true
    }, ["ASSIGNMENT", "INTERPOLATION_EXPRESSION", "QUOTED_STRING"]),

    // open regular interpolation
    createPattern(/\$\{ *([A-Z_0-9]+) */, blockHandler("INTERPOLATION"), ["ASSIGNMENT", "INTERPOLATION_EXPRESSION", "QUOTED_STRING"]),

    // closing interpolation
    createPattern(/}/, closeHandler("INTERPOLATION"), ["INTERPOLATION", "INTERPOLATION_EXPRESSION"]),

    // operators
    createPattern(/([-:/#%|?&+]{1,2})/, (lexer, match) => {
        lexer.closeUpToNearest("INTERPOLATION")
        return blockHandler("INTERPOLATION_EXPRESSION")(lexer, match)
    }, ["INTERPOLATION", "INTERPOLATION_EXPRESSION"]),

    // $VAR_NAME shorthand
    createPattern(/\$([A-Z_0-9]+)/, (lexer, match) => {
        lexer.push(new Token("INTERPOLATION", match[1]))
        return true
    }, ["ASSIGNMENT", "INTERPOLATION_EXPRESSION", "QUOTED_STRING"]),

    // --- Other ---

    // quoted strings
    createPattern(/ *"/, blockHandler("QUOTED_STRING"), ["ASSIGNMENT", "INTERPOLATION_EXPRESSION"]),
    createPattern(/" */, closeHandler("QUOTED_STRING"), ["QUOTED_STRING"]),

    // comments
    createPattern(/# ?(.*)/, simpleHandler("COMMENT")),

    // ignored whitespace -- except inside strings, assignments, and interpolations
    createPattern(/\s+/, () => true, exceptTokens("ASSIGNMENT", "INTERPOLATION_EXPRESSION", "QUOTED_STRING")),

    // implicit strings -- only match words and spaces greedily
    createPattern(/[^\n\r$"\\]+|./, simpleHandler("STRING"), ["ASSIGNMENT", "QUOTED_STRING"]),
    createPattern(/[\w ]+|./, simpleHandler("STRING"), ["INTERPOLATION_EXPRESSION"]),
]

class Lexer {
    cursor = 0
    rootToken = new Token("MAIN")
    blockStack: Token[] = [this.rootToken]

    static NO_OP_LIMIT = 20
    private consecutiveNoOps = 0

    constructor(public source: string) { }

    advance(n: number) {
        this.cursor += n

        if (n === 0) this.consecutiveNoOps++
        else this.consecutiveNoOps = 0

        if (this.consecutiveNoOps >= Lexer.NO_OP_LIMIT)
            throw new Error(`Lexer stuck in no-op loop at cursor ${this.cursor}`)
    }

    push(token: Token) {
        this.currentBlock.push(token)
    }

    pushAndOpen(token: Token) {
        this.push(token)
        this.blockStack.push(token)
    }

    get current() {
        return this.source[this.cursor]
    }

    get rest() {
        return this.source.slice(this.cursor)
    }

    get isDone() {
        return this.cursor >= this.source.length
    }

    get currentBlock() {
        return this.blockStack.at(-1)!
    }

    closeNearest(block: TokenType) {
        while (this.blockStack.pop()?.type !== block) { }
    }

    closeUpToNearest(block: TokenType) {
        while (this.blockStack.at(-1)?.type !== block) {
            this.blockStack.pop()
        }
    }

    tryPattern(pattern: LexerPattern) {
        if (!pattern.matchInside.includes(this.currentBlock.type))
            return false

        const match = this.rest.match(pattern.regex)
        if (!match || match.index !== 0)
            return false

        const shouldAdvance = pattern.handler(this, match)
        if (shouldAdvance)
            this.advance(match[0].length)
        return true
    }

    execute() {
        while (!this.isDone) {
            if (!lexerPatterns.some(p => this.tryPattern(p)))
                this.throwUnrecognizedTokenError()

            // prevent infinite loops -- lexer checks for consecutive no-ops
            this.advance(0)
        }

        return this.rootToken
    }

    reset() {
        this.cursor = 0
        this.rootToken = new Token("MAIN")
        this.blockStack = [this.rootToken]
        this.consecutiveNoOps = 0
    }

    throwUnrecognizedTokenError(): never {
        const red = "\x1b[1;31m", reset = "\x1b[0m"
        const char = JSON.stringify(this.current).slice(1, -1)
        const before = JSON.stringify(this.source.slice(this.cursor - 10, this.cursor)).slice(1, -1)
        const after = JSON.stringify(this.source.slice(this.cursor + char.length, this.cursor + 15)).slice(1, -1)

        const message = `Unrecognized token: "${red}${char}${reset}"\n
${before}${red}${char}${reset}${after}
${" ".repeat(before.length)}${red}${"^".repeat(char.length)}${reset}`

        throw new Error(message)
    }
}

export function tokenize(source: string) {
    const lexer = new Lexer(source)
    return lexer.execute()
}