/* global beforeEach describe expect jest test */
import * as readline from 'node:readline'

import {
  simpleIB,
  WHATS_YOUR_FAVORITE_INT,
  doubleQuestionIB,
  simpleIntQuestionIB
} from './test-data'
import { Questioner, DEFINED_SKIPPED } from '../questioner'

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
    [
      { type : 'int', min : 10 },
      ['1', '12'],
      "greater than or equal to '10'",
      12,
    ],
    [
      {},
      ['', 'foo'],
      'No default defined. Please provide a valid answer',
      'foo',
    ],
    [
      { multiValue : true, options : ['a', 'b'] },
      ['foo', '1'],
      'Invalid selection. Please enter a number between 1 and 2',
      ['a'],
    ],
  ])(
    'R-asks after failed validation; options %p, answers: %p, err msg: %s, value: %p',
    async (options, answers, errMsg, expected) => {
      const errorMatch = new RegExp(errMsg + '\\.(?:.|\n)*?Q', 'm')
      const interactions = [{ prompt : 'Q', parameter : 'V', ...options }]

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
          },
        }),
        close : () => undefined,
      }))

      const questioner = new Questioner({ interactions, output })
      await questioner.question()

      expect(questioner.get('V')).toEqual(expected)
    }
  )

  test('Reset required free-form answer after bad answer and then accept default', async () => {
    const interactions = [
      {
        prompt    : 'Q',
        parameter : 'V',
        default   : 100,
        type      : 'int',
        required  : true,
      },
    ]

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
    const interactions = [
      {
        prompt    : 'Q',
        parameter : 'V',
        options   : [100, 200],
        default   : 200,
        type      : 'int',
      },
      { review : 'questions' },
    ]

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

  // [38;5;184m
  const termCtrl = '(?:[^ -~]{1,2}\\[\\d{1,3}(?:;\\d{1,3};\\d{1,3})?m)+'

  test('Reviews only items since the last review (multiple reviews)', async () => {
    const interactions = [
      { prompt : 'Q1', parameter : 'V1' },
      { review : 'questions' },
      { prompt : 'Q2', parameter : 'V2' },
      { review : 'questions' },
    ]

    let readCount = 0
    readline.createInterface.mockImplementation(() => ({
      [Symbol.asyncIterator] : () => ({
        next : async () => {
          readCount += 1

          const review2PromptRe = new RegExp(
            `^${termCtrl}Review[^:]+:${termCtrl}\nQ2\n\\[${termCtrl}V2${termCtrl}\\]: ${termCtrl}bar${termCtrl}\n${termCtrl}Verified\\?${termCtrl} \\[y\\/n\\]$`,
            'm'
          )

          switch (readCount) {
            case 1: // Q1
              return { value : 'foo' }
            case 2: // review 1
              return { value : 'y' }
            case 3: // Q2
              stringOut.reset()

              return { value : 'bar' }
            case 4:
              expect(stringOut.string).toMatch(review2PromptRe)

              return { value : 'y' }
            default:
              throw new Error('Unexpected read')
          }
        },
      }),
      close : () => undefined,
    }))

    const questioner = new Questioner({ interactions, output })
    await questioner.question()

    expect(questioner.get('V1')).toBe('foo')
    expect(questioner.get('V2')).toBe('bar')
  })

  test("'review : questions' skips review of mapped items", async () => {
    const interactions = [
      { prompt : 'Q1', parameter : 'V1', type : 'int' },
      { maps : [{ parameter : 'V2', source : 'V1 + 2', type : 'int' }] },
      { review : 'questions' },
    ]

    let readCount = 0
    readline.createInterface.mockImplementation(() => ({
      [Symbol.asyncIterator] : () => ({
        next : async () => {
          readCount += 1
          switch (readCount) {
            case 1: // Q1
              stringOut.reset()

              return { value : '1' }
            case 2: // review 1
              expect(stringOut.string).toMatch(
                new RegExp(`^\n${termCtrl}Review 1[^:]+:${termCtrl}\nQ1`, 'm')
              )

              return { value : 'y' }
            default:
              throw new Error('Unexpected read')
          }
        },
      }),
      close : () => undefined,
    }))

    const questioner = new Questioner({ interactions, output })
    await questioner.question()

    expect(questioner.get('V1')).toBe(1)
    expect(questioner.get('V2')).toBe(3)
  })

  test("'review : all' includes review of mapped items", async () => {
    const interactions = [
      { prompt : 'Q1', parameter : 'V1', type : 'int' },
      { maps : [{ parameter : 'V2', source : 'V1 + 2', type : 'int' }] },
      { review : 'all' },
    ]

    let readCount = 0
    readline.createInterface.mockImplementation(() => ({
      [Symbol.asyncIterator] : () => ({
        next : async () => {
          readCount += 1
          switch (readCount) {
            case 1: // Q1
              stringOut.reset()

              return { value : '1' }
            case 2: // review 1
              expect(stringOut.string).toMatch(
                new RegExp(
                  `^\n${termCtrl}Review 2[^:]+:${termCtrl}\nQ1(?:.|\n)+V2`,
                  'm'
                )
              )

              return { value : 'y' }
            default:
              throw new Error('Unexpected read')
          }
        },
      }),
      close : () => undefined,
    }))

    const questioner = new Questioner({ interactions, output })
    await questioner.question()

    expect(questioner.get('V1')).toBe(1)
    expect(questioner.get('V2')).toBe(3)
  })

  test("'is resiliant to non-answers for review", async () => {
    const interactions = [
      { prompt : 'Q1', parameter : 'V1', type : 'int' },
      { review : 'questions' },
    ]

    let readCount = 0
    readline.createInterface.mockImplementation(() => ({
      [Symbol.asyncIterator] : () => ({
        next : async () => {
          readCount += 1
          switch (readCount) {
            case 1: // Q1
              return { value : '1' }
            case 2: // review 1
              stringOut.reset()

              return { value : 'blah' }
            case 3: // re-ask the review
              expect(stringOut.string).toMatch(
                new RegExp(
                  `^${termCtrl}Please answer yes or no \\(y/n\\)\\.${termCtrl}\n${termCtrl}Verified\\?`,
                  'm'
                )
              )

              return { value : 'y' }
            default:
              throw new Error('Unexpected read')
          }
        },
      }),
      close : () => undefined,
    }))

    const questioner = new Questioner({ interactions, output })
    await questioner.question()

    expect(questioner.get('V1')).toBe(1)
  })
})
