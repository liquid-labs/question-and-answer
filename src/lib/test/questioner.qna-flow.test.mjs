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

  test.each([
    [{ type: 'int', min: 10 }, ['1', '12'], "greater than or equal to '10'", 12],
    [{}, ['', 'foo'], 'No default defined. Please provide a valid answer', 'foo'],
    [{ multiValue: true, options: ['a', 'b'] }, ['foo', '1'], 'Invalid selection. Please enter a number between 1 and 2', ['a']],
  ])('R-asks after failed validation; options %p, answers: %p, err msg: %s, value: %p', async (options, answers, errMsg, expected) => {
    const errorMatch = new RegExp(errMsg + '\\.(?:.|\n)*?Q', 'm')
    const interactions = [{ prompt: 'Q', parameter: 'V', ...options }]

    let readCount = 0
    readline.createInterface.mockImplementation(() => ({
      [Symbol.asyncIterator] : () => ({
        next : async () => {
          readCount += 1
          if (readCount === 1) {
            expect(stringOut.string.trim()).toMatch(/^Q/)
            stringOut.reset()

            return { value : answers[0] }
          }
          else if (readCount === 2) {
            expect(stringOut.string).toMatch(errorMatch)

            return { value : answers[1] }
            // expect(stringOut.string.trim()).toMatch(/not a valid.+\n.+favorite int/m)
          }
          else {
            throw new Error('Unexpected read')
          }
        }
      }),
      close : () => undefined,
    }))

    const questioner = new Questioner({ interactions, output })
    await questioner.question()

    expect(questioner.get('V')).toEqual(expected)
  })

  test('Reset required free-form answer after bad answer and then accept default', async () => {
    const interactions = [{ prompt: 'Q', parameter: 'V', default: 100, type: 'int', required : true }]

    let readCount = 0
    readline.createInterface.mockImplementation(() => ({
      [Symbol.asyncIterator] : () => ({
        next : async () => {

          readCount += 1
          if (readCount === 1) {
            expect(stringOut.string).toBe('\nQ\n[100|-]')
            stringOut.reset()

            return { value : 'foo' }
          }
          else if (readCount === 2) {
            expect(stringOut.string.trim()).toMatch(
              /'foo' does not appear to be an integer\.(?:.|\n)*?\[100\|-\]/m
            )
            stringOut.reset()

            return { value : '-' }
          }
          else if (readCount === 3) {
            expect(stringOut.string.trim()).toMatch(/'V' is 'undefined'/m)
            stringOut.reset()

            return { value : '' }
          }
          else {
            throw new Error('Unexpected read')
          }
        },
      }),
      close : () => undefined,
    }))

    const questioner = new Questioner({ interactions, output })
    await questioner.question()

    expect(questioner.get('V')).toBe(100)
  })

  test('Clear option question after rejecting review', async () => {
    const interactions = [{ prompt: 'Q', parameter: 'V', options: [100,200], default: 200, type: 'int' }, { review : 'questions'}]

    const expectedQuestion = (defaultValue) => 
      `\nQ\n[${defaultValue}]\n\n1) 100\n2) 200\n`

    let readCount = 0
    readline.createInterface.mockImplementation(() => ({
      [Symbol.asyncIterator] : () => ({
        next : async () => {

          readCount += 1
          if (readCount === 1) {
            expect(stringOut.string).toBe(expectedQuestion('200'))
            stringOut.reset()

            return { value : '1' }
          }
          else if (readCount === 2) {
            expect(stringOut.string.trim()).toMatch(
              /Review 1 answer:(?:.|\n)*?\[.*?V.*?\]:.*100/m // the 'extra' .*?'s are for color codes
            )
            stringOut.reset()

            return { value : 'n' }
          }
          else if (readCount === 3) {
            expect(stringOut.string).toBe(expectedQuestion('100'))
            stringOut.reset()

            return { value : '0' }
          }
          else if (readCount === 4) {
            expect(stringOut.string.trim()).toMatch(
              /Review 1 answer:(?:.|\n)*?\[.*?V.*?\]:.*undefined/m // the 'extra' .*?'s are for color codes
            )
            stringOut.reset()

            return { value : 'y' }
          }
          else {
            throw new Error('Unexpected read')
          }
        },
      }),
      close : () => undefined,
    }))

    const questioner = new Questioner({ interactions, output })
    await questioner.question()

    expect(questioner.get('V')).toBe(undefined)
  })
})
