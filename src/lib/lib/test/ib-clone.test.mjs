import { BooleanString } from 'string-input'

import { ibClone } from '../ib-clone'
import * as testData from '../../test/test-data'

describe('ibClone', () => {
  test.each(Object.keys(testData))('clones %s test data', (dataKey) => {
    const data = testData[dataKey]
    const clone = ibClone(data)
    if (Array.isArray(data) || typeof data === 'object') {
      expect(clone).not.toBe(data)
    }
    expect(data).toEqual(clone)
  })

  test('deals with function types', () => {
    const simpleIB = structuredClone(testData.simpleIB)
    simpleIB.actions[0].type = BooleanString

    const clone = ibClone(simpleIB)
    expect(clone).not.toBe(simpleIB)
    expect(clone).toEqual(simpleIB)
  })

  test('deals with object requirement values', () => {
    const simpleIB = structuredClone(testData.simpleIB)
    simpleIB.actions[0].matchRe = /foo/

    const clone = ibClone(simpleIB)
    expect(clone).not.toBe(simpleIB)
    expect(clone).toEqual(simpleIB)
  })
})
