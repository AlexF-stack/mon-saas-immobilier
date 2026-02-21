declare global {
    var __IMMOSAAS_CONSOLE_GUARD_APPLIED__: boolean | undefined
}

if (
    process.env.NODE_ENV === 'production' &&
    !globalThis.__IMMOSAAS_CONSOLE_GUARD_APPLIED__
) {
    const noop = () => undefined
    console.log = noop
    console.info = noop
    console.warn = noop
    console.error = noop
    globalThis.__IMMOSAAS_CONSOLE_GUARD_APPLIED__ = true
}

export {}
