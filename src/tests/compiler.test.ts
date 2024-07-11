import { describe, expect, it } from "bun:test"
import { compileEnv } from "../lib/compiler"

describe("Operator tests", () => {
    it("should handle regular interpolation", async () => {
        const env = await compileEnv("regular_interpolation", { dir: "src/tests/env" })
        expect(env.REGULAR).toBe("Hello, world!")
    })

    it("should handle :- and || operators", async () => {
        const env = await compileEnv("or_operator", { dir: "src/tests/env" })
        expect(env.OR1).toBe("default")
        expect(env.OR2).toBe("value")
    })

    it("should handle - and ?? operators", async () => {
        const env = await compileEnv("nullish_coalescing", { dir: "src/tests/env" })
        expect(env.NULLISH1).toBe("default")
        expect(env.NULLISH2).toBe("value")
    })

    it("should handle :+ and && operators", async () => {
        const env = await compileEnv("and_operator", { dir: "src/tests/env" })
        expect(env.AND1).toBe("")
        expect(env.AND2).toBe("value")
    })

    it("should handle + operator", async () => {
        const env = await compileEnv("plus_operator", { dir: "src/tests/env" })
        expect(env.PLUS1).toBe("")
        expect(env.PLUS2).toBe("value")
    })

    it("should handle ?,: operator", async () => {
        const env = await compileEnv("ternary_operator", { dir: "src/tests/env" })
        expect(env.TERNARY1).toBe("false")
        expect(env.TERNARY2).toBe("true")
    })

    it("should handle : operator", async () => {
        const env = await compileEnv("slice_operator", { dir: "src/tests/env" })
        expect(env.SLICE1).toBe("world!")
        expect(env.SLICE2).toBe("Hello, world!")
    })

    it("should handle :,: operator", async () => {
        const env = await compileEnv("slice_range_operator", { dir: "src/tests/env" })
        expect(env.SLICE_RANGE1).toBe("ello")
        expect(env.SLICE_RANGE2).toBe("Hell")
    })

    it("should handle # and % operators", async () => {
        const env = await compileEnv("prefix_suffix_removal", { dir: "src/tests/env" })
        expect(env.PREFIX).toBe("/to/something")
        expect(env.SUFFIX).toBe("/path/to")
    })

    it("should handle ## and %% operators", async () => {
        const env = await compileEnv("prefix_suffix_removal_longest", { dir: "src/tests/env" })
        expect(env.PREFIX_LONGEST).toBe("/something")
        expect(env.SUFFIX_LONGEST).toBe("/path")
    })

    it("should handle /,/ operator", async () => {
        const env = await compileEnv("replace_operator", { dir: "src/tests/env" })
        expect(env.REPLACE).toBe("Helle, world!")
    })

    it("should handle //,/ operator", async () => {
        const env = await compileEnv("replace_all_operator", { dir: "src/tests/env" })
        expect(env.REPLACE_ALL).toBe("Helle, werld!")
    })
})