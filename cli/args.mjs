export function parseArgs(rawArgs) {
  const opts = {}
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i]
    if (!arg.startsWith('--')) continue

    const equalsIndex = arg.indexOf('=')
    const key = arg.slice(2, equalsIndex === -1 ? undefined : equalsIndex)
    let value
    if (equalsIndex !== -1) {
      value = arg.slice(equalsIndex + 1)
    } else if (rawArgs[i + 1] && !rawArgs[i + 1].startsWith('--')) {
      value = rawArgs[++i]
    } else {
      value = 'true'
    }

    if (key === 'format') {
      const formats = opts.format ?? []
      formats.push(value)
      opts.format = formats
    } else {
      opts[key] = value
    }
  }
  return opts
}
