/* global beforeEach describe expect jest test */
import * as readline from 'node:readline'

import {
  badParameterIB,
  noQuestionParameterIB,
  simpleIB,
  simpleMapIB,
  WHATS_YOUR_FAVORITE_INT,
  doubleQuestionIB,
  simpleIntQuestionIB
} from './test-data'
import { Questioner, CONDITION_SKIPPED, DEFINED_SKIPPED } from '../questioner'

import { getPrinter, StringOut } from 'magic-print'

jest.mock('node:readline')

describe('Questioner - QnA flow', () => {
  const stringOut = new StringOut()
  const print = getPrinter({ out : stringOut })
  const output = { write : print }

  beforeEach(() => {
    stringOut.reset()
  })

  test('skips questions with a pre-existing parameter value (from previous question)', async () => {
    let readCount = 0
    readline.createInterface.mockImplementation(() => ({
      [Symbol.asyncIterator] : () => ({
        next : async () => {
          readCount += 1
          if (readCount === 1) {
            expect(stringOut.string.trim()).toBe(
              'Is the Company the client?\n[y=client/n=contractor]'
            )
            stringOut.reset()

            return { value : 'yes' }
          }
          else if (readCount === 2) {
            expect(stringOut.string.trim()).toBe('Done?\n[y/n]')

            return { value : 'yes' }
          }
          else {
            throw new Error('Unexpected read')
          }
        },
      }),
      close : () => undefined,
    }))

    const questioner = new Questioner({
      interactions : doubleQuestionIB,
      output,
    })

    await questioner.question()
  })

  test('question is skipped if parameter defined in initial values', (done) => {
    const ib = structuredClone(simpleIB)
    const initialParameters = { IS_CLIENT : false }

    const questioner = new Questioner({
      initialParameters,
      interactions : ib,
    })

    questioner
      .question()
      .then(() => {
        try {
          expect(questioner.get('IS_CLIENT')).toBe(false)
          expect(questioner.getResult('IS_CLIENT').disposition).toBe(
            DEFINED_SKIPPED
          )
        }
        finally {
          done()
        }
      })
      .catch((e) => {
        throw e
      })
  })

  test.each([
    ['bool', 'false', false],
    ['int', '100', 100],
    ['int', '-1', -1],
  ])(
    'initially defined string values are transformed according to the parameter type (%s: %s)',
    (type, input, expected, done) => {
      const ib = structuredClone(simpleIB)
      ib[0].type = type
      const initialParameters = { IS_CLIENT : input }

      const questioner = new Questioner({
        initialParameters,
        interactions : ib,
      })

      questioner
        .question()
        .then(() => {
          try {
            expect(questioner.get('IS_CLIENT')).toBe(expected)
            expect(questioner.getResult('IS_CLIENT').disposition).toBe(
              DEFINED_SKIPPED
            )
          }
          finally {
            done()
          }
        })
        .catch((e) => {
          throw e
        })
    }
  )

  test.each([
    ['bool', false, false],
    ['int', 100, 100],
    ['int', -1, -1],
  ])(
    'initially defined literal values are accepted (%s: %s)',
    (type, input, expected, done) => {
      const ib = structuredClone(simpleIB)
      ib[0].type = type
      const initialParameters = { IS_CLIENT : input }

      const questioner = new Questioner({
        initialParameters,
        interactions : ib,
      })

      questioner
        .question()
        .then(() => {
          try {
            expect(questioner.get('IS_CLIENT')).toBe(expected)
            expect(questioner.getResult('IS_CLIENT').disposition).toBe(
              DEFINED_SKIPPED
            )
          }
          finally {
            done()
          }
        })
        .catch((e) => {
          throw e
        })
    }
  )

  test("when question is condition-skipped, uses 'elseValue' if present", (done) => {
    const ib = structuredClone(simpleMapIB)
    ib[0].condition = 'FOO'
    ib[0].elseValue = false
    const initialParameters = { FOO : false }

    const questioner = new Questioner({
      initialParameters,
      interactions : ib,
    })

    questioner
      .question()
      .then(() => {
        try {
          expect(questioner.get('IS_CLIENT')).toBe(false)
          expect(questioner.getResult('IS_CLIENT').disposition).toBe(
            CONDITION_SKIPPED
          )
          expect(questioner.get('ORG_COMMON_NAME')).toBe('them') // this is the mapped value
        }
        finally {
          done()
        }
      })
      .catch((e) => {
        throw e
      })
  })

  test('Will re-ask questions when answer form invalid', async () => {
    let readCount = 0
    readline.createInterface.mockImplementation(() => ({
      [Symbol.asyncIterator] : () => ({
        next : async () => {
          readCount += 1
          if (readCount === 1) {
            expect(stringOut.string.trim()).toBe(WHATS_YOUR_FAVORITE_INT)
            stringOut.reset()

            return { value : 'not a number' }
          }
          else if (readCount === 2) {
            expect(stringOut.string.trim()).toMatch(
              /does\snot\sappear\sto\sbe\san\sinteger.+?\n+What's your/m
            )

            return { value : '12' }
            // expect(stringOut.string.trim()).toMatch(/not a valid.+\n.+favorite int/m)
          }
          else {
            throw new Error('Unexpected read')
          }
        },
      }),
      close : () => undefined,
    }))

    const questioner = new Questioner({
      interactions : simpleIntQuestionIB,
      output,
    })
    await questioner.question()
  })

  test('Will re-ask questions when answer fails validation', async () => {
    const validationIB = structuredClone(simpleIntQuestionIB)
    validationIB[0].validations = { 'min-length' : 2 }

    let readCount = 0
    readline.createInterface.mockImplementation(() => ({
      [Symbol.asyncIterator] : () => ({
        next : async () => {
          readCount += 1
          if (readCount === 1) {
            expect(stringOut.string.trim()).toBe(WHATS_YOUR_FAVORITE_INT)
            stringOut.reset()

            return { value : '1' }
          }
          else if (readCount === 2) {
            expect(stringOut.string.trim()).toMatch(
              /must be at least 2.+?\n+What's your/m
            )

            return { value : '12' }
            // expect(stringOut.string.trim()).toMatch(/not a valid.+\n.+favorite int/m)
          }
          else {
            throw new Error('Unexpected read')
          }
        },
      }),
      close : () => undefined,
    }))

    const questioner = new Questioner({
      interactions : validationIB,
      output,
    })
    await questioner.question()
  })

  test.each([
    ['an invalid parameter type', badParameterIB, /invalid parameter type/i],
    [
      "no 'parameter' for question",
      noQuestionParameterIB,
      /does not define a 'parameter'/,
    ],
  ])('Will raise an exception on %s.', (desc, ib, exceptionRe) => {
    expect(() => new Questioner({ interactions : ib })).toThrow(exceptionRe)
  })
})
