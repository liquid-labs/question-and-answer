import { ArgumentInvalidError, ArgumentTypeError } from 'standard-error-set'
import { BooleanString, Integer, Numeric, ValidatedString } from 'string-input'

const translateType = (type) => {
  const errorHint =
    "Must be either a type function or 'string', 'int', 'numeric', or 'bool'."

  const typeType = typeof type
  if (typeType === 'function') {
    return type
  }
  else if (type !== undefined && typeType !== 'string') {
    throw new ArgumentTypeError({
      message : `Invalid type designation type '${typeType}'.`,
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
        message : `Invalid parameter type '${type}'.`,
        hint    : errorHint,
        status  : 500,
      })
  }
}

export { translateType }
