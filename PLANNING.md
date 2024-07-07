# Better Environment Variables

## v2

**Ideas:**
- Strict variable case option (coerce or raise)
- Pre-compute flag
- Types
- Option for default-override or default-preserve

## v1

**Criteria:**
- ~~Supports granular overriding~~
- Supports granular preservation (non-overriding)
- Supports computed values
    - Complex computations via JS-like syntax (defaults, ternary, etc.)
- Back-compat with regular env
- Allows for both .env.{env-name} and {env-name}.env file name formats
- (?) Supports JSON
- Supports profiles
    - Can include multiple merged environments
    - Can selectively pass variables
    - Can remap variables
- CLI
    - Setting environment in current shell
    - Getting individual keys

**Psuedo-Code:**
```

```
