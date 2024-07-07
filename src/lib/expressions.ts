

const CommonPatterns = {
    OpenInteroplation: /(?<!\\)\$\{(#)?\s*(\w+)/,
    CloseInterpolation: /(?<!\\)\}/,
}

class Expression {
    parts: (string | Interpolation)[] = []
    constructor(public parent: Interpolation | null) { }

    addPart(part: string | Interpolation) {
        if (typeof part === "string") {
            const toAdd = part.replaceAll(/(?<!\\)\\/g, "")
            if (typeof this.parts.at(-1) === "string")
                this.parts[this.parts.length - 1] += toAdd
            else this.parts.push(toAdd)
        }
        else
            this.parts.push(part)
    }

    async resolve(
        getVariable: (name: string) => Promise<string | null>
    ): Promise<string | null> {
        return Promise.all(this.parts.map(
            part => typeof part === "string"
                ? part
                : part.resolve(getVariable)
        )).then(parts => parts.join(""))
    }
}

class Interpolation {
    constructor(
        public parent: Expression,
        public varName: string | null = null,
        public lengthOp: boolean = false,
        public operations: { op: string, arg: Expression }[] = [],
    ) { }

    op(op: string, arg: Expression) {
        this.operations.push({ op, arg })
        return this
    }

    async resolve(
        getVariable: (name: string) => Promise<string | null>
    ): Promise<string | null> {
        const varVal = await getVariable(this.varName!)
        let result: string | null | undefined = null
        switch (this.operations.length) {
            case 0: result = varVal
                break
            case 1: {
                const arg = () => this.operations[0].arg.resolve(getVariable)
                switch (this.operations[0].op) {
                    case "|":
                    case ":-": result = varVal || await arg()
                        break
                    case "?":
                    case "-": result = varVal ?? await arg()
                        break
                    case ":": {
                        const index = await arg()
                        result = varVal?.slice(index ? parseInt(index) : 0)
                        break
                    }
                    case "#":
                    case "##":
                    case "%":
                    case "%%": {
                        const patternSrc = await arg()
                        if (!patternSrc) break

                        const op = this.operations[0].op
                        const beginning = op.startsWith("#")
                        const shortest = op.length === 1

                        const pattern = new RegExp(
                            beginning ? `^${patternSrc}` : `${patternSrc}$`,
                            "g"
                        )
                        const matchLengths = Array.from(varVal?.match(pattern) ?? [])
                            .map(m => m.length)
                        const matchLength = matchLengths.length
                            ? shortest
                                ? Math.min(...matchLengths)
                                : Math.max(...matchLengths)
                            : 0
                        result = beginning
                            ? varVal?.slice(matchLength)
                            : varVal?.slice(0, -matchLength)
                        break
                    }
                }
                break
            }
            case 2: {
                const arg1 = () => this.operations[0].arg.resolve(getVariable)
                const arg2 = () => this.operations[1].arg.resolve(getVariable)
                switch (this.operations[0].op + "," + this.operations[1].op) {
                    case ":,:": {
                        const [index, length] = await Promise.all([arg1(), arg2()])
                        result = varVal
                            ?.slice(index ? parseInt(index) : 0)
                            .slice(0, length ? parseInt(length) : undefined)
                        break
                    }
                    case "/,/": {
                        const [patternSrc, newVal] = await Promise.all([arg1(), arg2()])
                        if (!patternSrc) break
                        result = varVal?.replace(new RegExp(patternSrc), newVal ?? "")
                        break
                    }
                    case "//,/": {
                        const [patternSrc, newVal] = await Promise.all([arg1(), arg2()])
                        if (!patternSrc) break
                        result = varVal?.replaceAll(new RegExp(patternSrc, "g"), newVal ?? "")
                        break
                    }
                }
            }
        }

        return this.lengthOp ? (result ?? "").length.toString() : (result ?? null)
    }
}


export function parseExpression(expression: string) {
    let str = expression

    function goUntilFirst<T extends Record<string, RegExp>>(
        patterns: T,
        eatMatch: boolean = true
    ) {
        const firstMatch = Object.entries(patterns)
            .reduce<[string, RegExpMatchArray] | null>((acc, [name, pattern]) => {
                const match = str.match(
                    pattern.global
                        ? new RegExp(pattern.source, pattern.flags.replace("g", ""))
                        : pattern
                )
                return match && (!acc || match.index! < acc[1].index!)
                    ? [name, match] as const
                    : acc
            }, null)

        if (!firstMatch) {
            const chunk = str
            str = ""
            return { chunk, patternName: null, match: null }
        }

        const [patternName, match] = firstMatch
        const chunk = str.slice(0, match.index!)
        str = str.slice(match.index! + (eatMatch ? match[0].length : 0))
        return {
            chunk,
            patternName: patternName as keyof T,
            match,
        }
    }

    const root = new Expression(null)
    let current: Expression | Interpolation = root

    while (str.length > 0) {
        if (current instanceof Expression) {
            if (current.parent) {
                const { chunk, patternName, match } = goUntilFirst({
                    open: CommonPatterns.OpenInteroplation,
                    close: CommonPatterns.CloseInterpolation,
                    op: /(?<!\\)(?::|\/)/,
                })
                current.addPart(chunk)

                switch (patternName) {
                    case "open": {
                        const interp = new Interpolation(current, match![2], !!match![1])
                        current.addPart(interp)
                        current = interp as Interpolation
                        break
                    }
                    case "close": {
                        current = current.parent.parent
                        break
                    }
                    case "op": {
                        const expr = new Expression(current.parent)
                        current.parent.op(match![0], expr)
                        current = expr as Expression
                        break
                    }
                }
            }
            else {
                const { chunk, patternName, match } = goUntilFirst({
                    open: CommonPatterns.OpenInteroplation,
                })
                current.addPart(chunk)

                switch (patternName) {
                    case "open": {
                        const interp = new Interpolation(current, match![2], !!match![1])
                        current.addPart(interp)
                        current = interp as Interpolation
                        break
                    }
                }
            }
        }
        else if (current instanceof Interpolation) {
            const { patternName, match } = goUntilFirst({
                close: CommonPatterns.CloseInterpolation,
                op: /(?<!\\)(?::-|##|%%|\/\/|-|:|#|%|\/|\||\?)/,
            })

            switch (patternName) {
                case "close": {
                    current = current.parent
                    break
                }
                case "op": {
                    const expr = new Expression(current)
                    current.op(match![0], expr)
                    current = expr as Expression
                    break
                }
            }
        }
    }

    return root
}