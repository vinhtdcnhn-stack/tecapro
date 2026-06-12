// Logger tối giản, không phụ thuộc thư viện ngoài.
// Mọi log có timestamp + mức độ. Ở production, log mức 'debug' bị bỏ qua.

const isProd = process.env.NODE_ENV === 'production'

function emit(level, args) {
  const prefix = `[${new Date().toISOString()}] [${level.toUpperCase()}]`
  if (level === 'error') console.error(prefix, ...args)
  else if (level === 'warn') console.warn(prefix, ...args)
  else console.log(prefix, ...args)
}

export const logger = {
  info: (...a) => emit('info', a),
  warn: (...a) => emit('warn', a),
  error: (...a) => emit('error', a),
  debug: (...a) => { if (!isProd) emit('debug', a) },
}
