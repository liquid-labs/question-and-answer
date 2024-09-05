import { translateType } from '../translate-type'

describe('translateType', () => {
  test('throws error for invalid type type', () =>
    expect(() => translateType({})).toThrow(/^Invalid type designation type 'object'\./))

  test('throws error for unrecognized string type', () =>
    expect(() => translateType('foobar')).toThrow(/^Invalid parameter type 'foobar'\./))
})