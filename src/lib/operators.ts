import type { Tuple } from "./utils"

type OperatorFn<N extends number> = (
    variableValue: string | null,
    ...args: Tuple<() => Promise<string | null>, N>
) => Promise<string | null>

type Operator<N extends number = number> = {
    symbols: string[]
    fn: OperatorFn<N>
}

function createOperator<N extends number>(symbols: string[], fn: OperatorFn<N>): Operator<N> {
    return { symbols, fn }
}

const prefixSuffixRemoveOperator = (
    symbols: string[],
    /** `false` for prefix, `true` for suffix */
    prefixOrSuffix: boolean,
    /** `false` for shortest, `true` for longest */
    shortestOrLongest: boolean,
) => createOperator<1>(symbols, async (x, a) => {
    if (!x) return ""
    const _a = await a()
    if (!_a) return x

    const matchLengths = x.match(new RegExp(prefixOrSuffix ? `${_a}$` : `^${_a}`, "g"))
        ?.map(m => m.length)
    if (!matchLengths) return x

    const length = (shortestOrLongest ? Math.max : Math.min)(...matchLengths)
    return prefixOrSuffix ? x.slice(0, -length) : x.slice(length)
})

const replaceOperator = (
    symbols: string[],
    all: boolean,
) => createOperator<2>(symbols, async (x, a, b) => {
    if (!x) return ""
    const _a = await a()
    if (!_a) return x
    return all
        ? x.replaceAll(new RegExp(_a, "g"), await b() ?? "")
        : x.replace(new RegExp(_a), await b() ?? "")
})

export const operators: Operator[] = [
    // regular interpolation
    createOperator<0>([""], async (x) => x),

    // conditionals
    createOperator<1>([":-", "||"], async (x, a) => x || await a()),
    createOperator<1>(["-", "??"], async (x, a) => x ?? await a()),
    createOperator<1>([":+", "&&"], async (x, a) => x ? await a() : ""),
    createOperator<1>(["+"], async (x, a) => x != null ? await a() : ""),
    createOperator<2>(["?,:"], async (x, a, b) => x ? await a() : await b()),

    // substring extraction
    createOperator<1>([":"], async (x, a) => {
        const _a = await a()
        return x?.slice(_a ? parseInt(_a) : 0) ?? ""
    }),
    createOperator<2>([":,:"], async (x, a, b) => {
        const [_a, _b] = await Promise.all([a(), b()])
        return x?.slice(_a ? parseInt(_a) : 0).slice(0, _b ? parseInt(_b) : undefined) ?? ""
    }),

    // prefix/suffix removal
    prefixSuffixRemoveOperator(["#"], false, false),
    prefixSuffixRemoveOperator(["##"], false, true),
    prefixSuffixRemoveOperator(["%"], true, false),
    prefixSuffixRemoveOperator(["%%"], true, true),

    // replacement
    replaceOperator(["/,/"], false),
    replaceOperator(["//,/"], true),
]