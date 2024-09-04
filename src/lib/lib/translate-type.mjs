import { ArgumentInvalidError } from 'standard-error-set'
import { BooleanString, Integer, Numeric, ValidatedString } from 'string-input'

const translateType = (type) => {
  const errorHint =
    "Must be either a type function or 'string', 'int', 'numeric', or 'bool'."

  const typeType = typeof type
  if (typeType === 'function') {
    return type
  }
  else if (type !== undefined && typeType !== 'string') {
    throw new ArgumentInvalidError({
      message : `Cannot translate invalid type '${type}'; ${errorHint}.`,
      hint    : errorHint,
      status  : 500,
    })
  }

  type = type?.toLowerCase()
  switch (type) {
    case undefined:
    case 'string':
      return ValidatedString
    case 'int':
    case 'integer':
      return Integer
    case 'float':
    case 'numeric':
      return Numeric
    case 'bool':
    case 'boolean':
      return BooleanString
    default:
      throw new ArgumentInvalidError({
        message : `Unknown parameter type: '${type}'; ${errorHint}.`,
        hint    : errorHint,
        status  : 500,
      })
  }
}

export { translateType }
