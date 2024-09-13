/* global beforeAll beforeEach describe expect jest test */
import * as readline from 'node:readline'

import { Day, ValidatedString } from 'string-input'
import { getPrinter, StringOut } from 'magic-print'
import * as types from 'string-input'

import {
  DO_YOU_LIKE_MILK,
  IS_THIS_THE_END,
  badParameterIB,
  conditionalQuestionIB,
  conditionStatementIB,
  cookieParameterIB,
  noQuestionParameterIB,
  simpleIB,
  simpleMapIB,
  sourceMappingIB,
  statementIB
} from './test-data'
import { Questioner, ANSWERED, CONDITION_SKIPPED } from '../questioner'

jest.mock('node:readline')

describe('Questioner', () => {
  const stringOut = new StringOut()
  const print = getPrinter({ out : stringOut })
  const output = { write : print }

  beforeEach(() => {
    stringOut.reset()
  })

  describe('accessors', () => {
    const interactions = [ { prompt: 'Q', parameter: 'V' }]
    let questioner

    beforeAll(async () => {
      const initialParameters = { V: 'foo' }
      questioner = new Questioner({ interactions, initialParameters })
      await questioner.question()
    })

    test('.interactions returns independent (cloned) interactions', () => {
      const interactionsCopy = questioner.interactions
      delete interactionsCopy[0].disposition
      expect(interactionsCopy).toEqual(interactions)
      interactionsCopy[0].prompt = 'W'
      expect(interactionsCopy).not.toEqual(interactions)
    })

    test('.results returns cloned results', () => {
      const results1 = questioner.results
      const results2 = questioner.results
      expect(results1).toEqual(results2)
      expect(results1).not.toBe(results2)
      results1[0].value = 'bar'
      expect(results1[0].value).toBe('bar')
      expect(results2[0].value).toBe('foo')
    })
  })

  describe('interactions validation', () => {
    test.each([
      [undefined, ValidatedString],
      ['string', ValidatedString],
      [Day, Day]
    ])("throws on invalid 'map' action source type %s", (type, expectedType) => {
      const interactions = [{ maps: [{ parameter: 'V', source: 'BAR', type }]}]
      expect(() => new Questioner({interactions})).toThrow(new RegExp(`is wrong type. Received type '${expectedType}'`))
    })

    test.each([undefined, null, []])('raises error when attempting to question with no %s interactions', async (interactions) => {
      try {
        const questioner = new Questioner({ interactions })
        throw new Error('Failed to throw')
      }
      catch (e) {
        expect(e.message).toMatch(/'interactions' is (?:'undefined'|'null'|an empty array)/)
      }
    })
  })

  describe('boolean questions', () => {
    test.each([
      ['1', 1],
      ['0', 0],
      ['-1', -1],
    ])(
      "simple boolean question answer '%s' -> %s",
      async (answer, expected) => {
        const ib = structuredClone(simpleIB)
        ib[0].type = 'int'

        let readCount = 0
        readline.createInterface.mockImplementation(() => ({
          [Symbol.asyncIterator] : () => ({
            next : async () => {
              readCount += 1
              if (readCount === 1) {
                return { value : answer }
              }
              else {
                throw new Error('Unexpected read')
              }
            },
          }),
          close : () => undefined,
        }))

        const questioner = new Questioner({ interactions : ib, output })

        await questioner.question()
        const result = questioner.getResult('IS_CLIENT')

        expect(result.value).toBe(expected)
        expect(result.rawAnswer).toBe(answer)
        expect(result.disposition).toBe(ANSWERED)
      }
    )
  })

  describe('boolean questions', () => {
    test.each([
      ['y', true],
      ['n', false],
      ['Y', true],
      ['N', false],
      ['t', true],
      ['T', true],
      ['f', false],
      ['F', false],
      ['yes', true],
      ['Yes', true],
      ['no', false],
      ['No', false],
      ['true', true],
      ['True', true],
      ['false', false],
      ['False', false],
    ])(
      "simple boolean question answer '%s' -> %s",
      async (answer, expected) => {
        let readCount = 0
        readline.createInterface.mockImplementation(() => ({
          [Symbol.asyncIterator] : () => ({
            next : async () => {
              readCount += 1
              if (readCount === 1) {
                return { value : answer }
              }
              else {
                throw new Error('Unexpected read')
              }
            },
          }),
          close : () => undefined,
        }))

        const questioner = new Questioner({
          interactions : simpleIB,
          output,
        })

        await questioner.question()
        const result = questioner.getResult('IS_CLIENT')

        expect(result.value).toBe(expected)
        expect(result.rawAnswer).toBe(answer)
        expect(result.disposition).toBe(ANSWERED)
      }
    )
  })

  describe('Mappings', () => {
    test.each([
      ['yes', 'us'],
      ['no', 'them'],
    ])('value map %s -> %s', async (answer, value) => {
      readline.createInterface.mockImplementation(() => ({
        [Symbol.asyncIterator] : () => ({
          next : async () => {
            return { value : answer }
          },
        }),
        close : () => undefined,
      }))

      const questioner = new Questioner({
        interactions : simpleMapIB,
        output,
      })

      await questioner.question()
      expect(questioner.values.ORG_COMMON_NAME).toEqual(value)
    })

    test.each([
      ['1', 'FAVE_DIFF', 2],
      ['1', 'IS_FAVE_NOT_ZERO', true],
      ['0', 'IS_FAVE_NOT_ZERO', false],
    ])(
      "source map 'FAVE_INT'=%s, yields '%s'=%s'",
      async (faveInt, parameter, value) => {
        const questioner = new Questioner({
          interactions : sourceMappingIB,
          output,
        })
        readline.createInterface.mockImplementation(() => ({
          [Symbol.asyncIterator] : () => ({
            next : async () => {
              return { value : faveInt }
            },
          }),
          close : () => undefined,
        }))

        await questioner.question()

        expect(questioner.values[parameter]).toBe(value)
      }
    )

    test.each([
      ['bool', 'y', true],
      ['int', '1', 1],
      ['numeric', '1.5', 1.5],
    ])(
      "maps 'source'd type %s input '%s' -> %p",
      async (type, value, expected) => {
        const interactions = [
          { maps : [{ parameter: 'V', source: 'ENV_VAR', type }] }
        ]
        const initialParameters = { ENV_VAR: value }

        const questioner = new Questioner({ interactions, initialParameters })
        await questioner.question()

        expect(questioner.get('V')).toBe(expected)
      }
    )
  })

  describe('Conditional questions', () => {
    test.each([
      ['yes', DO_YOU_LIKE_MILK],
      ['no', IS_THIS_THE_END],
    ])('Conditional question %s -> %s', async (answer, followup) => {
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

              return { value : answer }
            }
            else if (readCount === 2) {
              // the intermediate space can be combined with the followup on the read
              expect(stringOut.string.trim()).toBe(followup)

              return { value : 'yes' }
            }
            else {
              return { value : 'yes' }
            }
          },
        }),
        close : () => undefined,
      }))

      const questioner = new Questioner({
        interactions : conditionalQuestionIB,
        output,
      })
      await questioner.question()
    })

    test("when question is condition-skipped, uses 'elseValue' if present (literal 'elseValue')", async () => {
      const interactions = [
        { prompt : 'Q', parameter : 'V', type : 'bool', condition: 'C', elseValue: false },
        {
          condition : 'V',
          maps      : [{ parameter : 'X', value : 'a' }],
        },
        {
          condition : '!V',
          maps      : [{ parameter : 'X', value : 'b' }],
        },
      ]
      const initialParameters = { C : false }

      const questioner = new Questioner({ initialParameters, interactions })

      await questioner.question()

      const result = questioner.getResult('V')
            expect(result.value).toBe(false)
            expect(result.disposition).toBe(CONDITION_SKIPPED)
            expect(questioner.get('X')).toBe('b')
    })

    test("when question is condition-skipped, uses 'elseSource' if present", async () => {
      const interactions = [
        { prompt : 'Q', parameter : 'V', type : 'bool', condition: 'C', elseSource: 'BAR || BAZ' },
        {
          condition : 'BAZ',
          maps      : [{ parameter : 'X', value : 'a' }],
        },
        {
          condition : '!V',
          maps      : [{ parameter : 'X', value : 'b' }],
        },
      ]
      const initialParameters = { C : false, BAR : true, BAZ : false }

      const questioner = new Questioner({ initialParameters, interactions })

      await questioner.question()

      const vResult = questioner.getResult('V')
      expect(vResult.value).toBe(true)
      expect(vResult.disposition).toBe(CONDITION_SKIPPED)
      expect(questioner.get('X')).toBe(undefined)
    })
  })

  describe('Value transforms', () => {
    test.each([
      ['true', 'boolean', true],
      ['true', 'bool', true],
      ['true', 'string', 'true'],
      ['5', 'integer', 5],
      ['5.5', 'float', 5.5],
      ['6.6', 'numeric', 6.6],
    ])("Value '%s' type '%s' -> %p", async (value, type, expected) => {
      const ib = structuredClone(simpleIB)
      ib[0].type = type

      readline.createInterface.mockImplementation(() => ({
        [Symbol.asyncIterator] : () => ({
          next : async () => {
            return { value }
          },
        }),
        close : () => undefined,
      }))

      const questioner = new Questioner({ interactions : ib, output })

      await questioner.question()

      expect(questioner.get('IS_CLIENT')).toBe(expected)
    })
  })

  describe('Defaults', () => {
    test.each([
      [true, 'boolean', true],
      ['true', 'boolean', true],
      [false, 'bool', false],
      ['false', 'bool', false],
      [5, 'integer', 5],
      [5.5, 'float', 5.5],
      [6.6, 'numeric', 6.6],
      [[1,2], 'int', [1,2]]
    ])("literal default '%s' type '%s' -> %p", async (defaultValue, type, expected) => {
      const interactions = [{ prompt: 'Q', parameter: 'V', type, default: defaultValue }]
      if (Array.isArray(defaultValue)) {
        interactions[0].multiValue = true
      }

      let askCount = 0
      readline.createInterface.mockImplementation(() => ({
        [Symbol.asyncIterator] : () => ({
          next : async () => {
            if (askCount > 1) {
              throw new Error('Failed to default on first ask.')
            }
            askCount += 1

            return { value : '' }
          },
        }),
        close : () => undefined,
      }))

      const questioner = new Questioner({ interactions, output })

      await questioner.question()

      expect(questioner.get('V')).toEqual(expected)
    })

    test.each([
      [true, 'bool', /\[Y\/n\|-\]/],
      [false, 'bool', /\[y\/N\|-\]/],
    ])("default '%s' type '%s' prompt matches '%p'", async (defaultValue, type, matches) => {
      const interactions = [ { prompt : 'Q', parameter : 'V', type, default : defaultValue }]

      readline.createInterface.mockImplementation(() => ({
        [Symbol.asyncIterator] : () => ({
          next : async () => {
            expect(stringOut.string.trim()).toMatch(matches)

            return { value : '' }
          },
        }),
        close : () => undefined,
      }))

      const questioner = new Questioner({ interactions, output })

      await questioner.question()
    })

    test('displays default option value', async () => {
      const interactions = [ { prompt : 'Q', parameter : 'V', options: ['foo', 'bar'], default : 'foo' }]

      let readCount = 0
      readline.createInterface.mockImplementation(() => ({
        [Symbol.asyncIterator] : () => ({
          next : async () => {
            readCount += 1
            if (readCount === 1) {
              expect(stringOut.string.trim()).toMatch(/\[foo\]/m)
              stringOut.reset()

              return { value : '' }
            }
            else {
              throw new Error('Unexpected read; output:', stringOut.string)
            }
          },
        }),
        close : () => undefined,
      }))

      const questioner = new Questioner({ interactions, output })

      await questioner.question()
      expect(questioner.get('V')).toBe('foo')
    })
  })

  describe('multi-value input (free form)', () => {
    test.each([
      ['Hi', undefined, ['Hi']],
      ['Hi,Bye', undefined, ['Hi', 'Bye']],
      [' Hi, Bye ', undefined, ['Hi', 'Bye']],
      ['Hi,Bye', '|', ['Hi,Bye']],
      ['Hi|Bye', '|', ['Hi', 'Bye']],
      ['Hi~Bye', '~', ['Hi', 'Bye']],
      ['Hi.Bye', '.', ['Hi', 'Bye']],
      ['Hi&Bye', '&', ['Hi', 'Bye']],
      ['Hi(Bye', '(', ['Hi', 'Bye']],
      ['Hi)Bye', ')', ['Hi', 'Bye']],
      ['Hi{Bye', '{', ['Hi', 'Bye']],
      ['Hi}Bye', '}', ['Hi', 'Bye']],
      ['Hi|&(Bye', '|&(', ['Hi', 'Bye']],
      ['Hi Bye', ' ', ['Hi', 'Bye']],
      [' Hi   Bye ', ' ', ['Hi', 'Bye']],
    ])("Answer '%s' sep '%s' -> %p", async (answer, sep, expected) => {
      const ib = structuredClone(simpleIB)
      delete ib[0].type
      ib[0].multiValue = true
      ib[0].separator = sep

      readline.createInterface.mockImplementation(() => ({
        [Symbol.asyncIterator] : () => ({
          next : async () => {
            return { value : answer }
          },
        }),
        close : () => undefined,
      }))

      const questioner = new Questioner({ interactions : ib, output })

      await questioner.question()
      expect(questioner.values.IS_CLIENT).toEqual(expected)
    })
  })

  describe('multi-value input (option locked)', () => {
    test.each([
      ['1', undefined, ['Hi']],
      ['1,2', undefined, ['Hi', 'Bye']],
      [' 1, 2 ', undefined, ['Hi', 'Bye']],
      ['1|2', '|', ['Hi', 'Bye']],
      ['1~2', '~', ['Hi', 'Bye']],
      ['1|&(2', '|&(', ['Hi', 'Bye']],
      ['1 2', ' ', ['Hi', 'Bye']],
      [' 1   2 ', ' ', ['Hi', 'Bye']],
    ])("Answer '%s' sep '%s' -> %p", async (answer, sep, expected) => {
      const ib = structuredClone(simpleIB)
      delete ib[0].type
      ib[0].multiValue = true
      ib[0].separator = sep
      ib[0].options = ['Hi', 'Bye']

      readline.createInterface.mockImplementation(() => ({
        [Symbol.asyncIterator] : () => ({
          next : async () => {
            return { value : answer }
          },
        }),
        close : () => undefined,
      }))

      const questioner = new Questioner({ interactions : ib, output })

      await questioner.question()
      expect(questioner.values.IS_CLIENT).toEqual(expected)
    })
  })

  describe('answer requirements (single value)', () => {
    test.each([
      // requireDefined
      ['Hi', 'string', 'requireSomething', true],
      ['1', 'int', 'requireSomething', true],
      ['true', 'bool', 'requireSomething', true],
      // requireTruthy
      ['Hi', 'string', 'requireTruthy', true],
      ['1', 'int', 'requireTruthy', true],
      ['true', 'bool', 'requireTruthy', true],
      // requireExact
      ['Hi', 'string', 'requireExact', 'Hi'],
      ['1', 'int', 'requireExact', 1],
      ['true', 'bool', 'requireExact', true],
      ['false', 'bool', 'requireExact', false],
      // requireOneOf
      ['Hi', 'string', 'requireOneOf', ['Hi', 'Bye']],
      ['1', 'int', 'requireOneOf', [1, 2]],
      ['true', 'bool', 'requireOneOf', [true, false]],
      ['false', 'bool', 'requireOneOf', [false, true]],
      // requireMatch
      ['Hi', 'string', 'requireMatch', 'Hi'],
      ['Hi', 'string', 'requireMatch', '[Hi]*'],
      ['Hi', 'string', 'requireMatch', '^[Hi]*$'],
    ])(
      "Value '%s' (%s) and requirement %s=%s is accepted",
      async (value, type, requirement, reqValue) => {
        const ib = structuredClone(simpleIB)
        ib[0].type = type
        ib[0][requirement] = reqValue

        readline.createInterface.mockImplementation(() => ({
          [Symbol.asyncIterator] : () => ({
            next : async () => {
              return { value }
            },
          }),
          close : () => undefined,
        }))

        const questioner = new Questioner({ interactions : ib, output })

        await questioner.question()

        expect(questioner.values.IS_CLIENT + '').toBe(value)
      }
    )

    test.each([
      // minLength
      [
        'a',
        'string',
        'minLength',
        2,
        /must be at least 2 characters long\./,
        'blah',
      ],
      // oneOf (singular)
      ['Hi', 'string', 'oneOf', ['Bye'], /must be 'Bye'/, 'Bye'],
      ['1', 'int', 'oneOf', [2], /must be '2'/, '2'],
      ['true', 'bool', 'oneOf', [false], /must be 'false'/, 'false'],
      ['false', 'bool', 'oneOf', [true], /must be 'true'/, 'true'],
      // oneOf (multiple)
      [
        'Hello',
        'string',
        'oneOf',
        'Hi, Bye',
        /must be one of 'Hi', 'Bye'/,
        'Hi',
      ],
      ['10', 'int', 'oneOf', [1, 2], /must be one of '1', '2'/, '1'],
      // requireMatch
      ['Hi', 'string', 'matchRe', 'Bye', /must match \/Bye\//, 'Bye'],
      [
        'Hi',
        'string',
        'matchRe',
        '^[Bye]*$',
        /must match \/\^\[Bye\]\*\$\//,
        'ByeBye',
      ],
      ['Hi', 'string', 'matchRe', /Bye/, /must match \/Bye\//, 'Bye'],
    ])(
      "Value '%s' (%s) and requirement %s=%s is rejected",
      async (answer, type, requirement, reqValue, errorMatch, valid) => {
        const ib = structuredClone(simpleIB)
        ib[0].type = type
        ib[0][requirement] = reqValue

        let readCount = 0
        readline.createInterface.mockImplementation(() => ({
          [Symbol.asyncIterator] : () => ({
            next : async () => {
              readCount += 1
              if (readCount === 1) {
                stringOut.reset()

                return { value : answer }
              }
              else {
                expect(stringOut.string.trim()).toMatch(errorMatch)

                return { value : valid }
              }
            },
          }),
          close : () => undefined,
        }))

        const questioner = new Questioner({ interactions : ib, output })

        await questioner.question()
      }
    )
  })

  describe('answer requirements (multi value)', () => {
    test.each([
      // requireMinCount
      ['Hi,Bye', 'requireMinCount', 1],
      ['Hi,Bye', 'requireMinCount', 2],
      // requireMaxCount
      ['Hi,Bye', 'requireMaxCount', 3],
      ['Hi,Bye', 'requireMaxCount', 2],
    ])(
      "Value '%s' (%s) and requirement %s=%s is accepted",
      async (value, requirement, reqValue) => {
        const ib = structuredClone(simpleIB)
        ib[0].type = 'string'
        ib[0].multiValue = true
        ib[0][requirement] = reqValue

        readline.createInterface.mockImplementation(() => ({
          [Symbol.asyncIterator] : () => ({
            next : async () => {
              return { value }
            },
          }),
          close : () => undefined,
        }))

        const questioner = new Questioner({ interactions : ib, output })

        await questioner.question()
        expect(questioner.values.IS_CLIENT + '').toBe(value)
      }
    )

    test.each([
      // requireMinCount
      ['Hi', 'requireMinCount', 2, 'hi,bye'],
      ['Hi,Bye', 'requireMinCount', 3, 'hi,bye,what'],
      // requireMaxCount
      ['Hi,Bye', 'requireMaxCount', 1, 'hi'],
      ['Hi,Bye,Blah', 'requireMaxCount', 2, 'hi,bye'],
    ])(
      "Value '%s' (%s) and requirement %s=%s is rejected",
      async (answer, requirement, reqValue, valid) => {
        const ib = structuredClone(simpleIB)
        ib[0].multiValue = true
        ib[0].type = 'string'
        ib[0][requirement] = reqValue

        let readCount = 0
        readline.createInterface.mockImplementation(() => ({
          [Symbol.asyncIterator] : () => ({
            next : async () => {
              readCount += 1
              if (readCount === 1) {
                return { value : answer }
              }
              else {
                expect(stringOut.string.trim()).toMatch(/must/)

                return { value : valid }
              }
            },
          }),
          close : () => undefined,
        }))

        const questioner = new Questioner({ interactions : ib, output })

        await questioner.question()
      }
    )
  })

  describe('cookie parameters', () => {
    const questioner = new Questioner({
      interactions : cookieParameterIB,
      output,
    })

    beforeAll(async () => {
      readline.createInterface.mockImplementation(() => ({
        [Symbol.asyncIterator] : () => ({
          next : async () => {
            return { value : 'yes' }
          },
        }),
        close : () => undefined,
      }))

      const qPromise = questioner.question()
      await qPromise
    })

    test('are passed from questions', () =>
      expect(questioner.getResult('IS_CLIENT').handling).toBe('bundle'))

    test('are passed from maps', () =>
      expect(questioner.getResult('ORG_COMMON_NAME').handling).toBe('bundle'))
  })

  describe('statements', () => {
    test('prints statement', async () => {
      const questioner = new Questioner({
        interactions : statementIB,
        output,
      })

      await questioner.question()

      expect(stringOut.string.trim()).toBe('Hi!')
    })

    test('properly skips condition skip statements', async () => {
      const questioner = new Questioner({
        interactions : conditionStatementIB,
        output,
      })
      await questioner.question()

      expect(stringOut.string.trim()).toBe('Bye!')
    })
  })

  describe('Answer validation', () => {
    test.each([
      ['int', '1', 1],
      [types.Integer, '-2', -2],
      ['bool', 't', true],
    ])('validate type %s input %s => %s', async (type, input, expected) => {
      const validateIB = structuredClone(simpleIB)
      validateIB[0].type = type

      readline.createInterface.mockImplementation(() => ({
        [Symbol.asyncIterator] : () => ({
          next : async () => {
            return { value : input }
          },
        }),
        close : () => undefined,
      }))

      const questioner = new Questioner({
        interactions : validateIB,
        output,
      })
      await questioner.question()

      expect(questioner.get('IS_CLIENT')).toBe(expected)
    })
  
    const badDefaultOptions = [
      { prompt: 'Q', options: ['foo', 'bar'], default: 'baz', parameter: 'V' }
    ]

    test.each([
      ['an invalid parameter type', badParameterIB, /invalid parameter type/i],
      [
        "no 'parameter' for question",
        noQuestionParameterIB,
        /does not define a 'parameter'/,
      ],
      ['bad options type', [{ prompt: 'Q', options: 'blah', parameter: 'V' }], /'options' must be an array/],
      ['default does not match options', badDefaultOptions, /is not any of the specified options/],
    ])('Raises exception on verifying interactions with %s.', (desc, ib, exceptionRe) =>
      expect(() => new Questioner({ interactions : ib })).toThrow(exceptionRe))
  })

  describe('Preset parameters', () => {
    test('raises an error when invalid (initial parameters)', async () => {
      const interactions = [{ parameter: 'V', prompt: 'Q', type: 'int' }]
      const initialParameters = { V: 'foo' }
      

      try {
        const questioner = new Questioner({ initialParameters, interactions, output })
        throw new Error('Did not throw when expected')
      }
      catch (e) {
        expect(e.message).toMatch(/does not appear to be an integer\. Check your initial parameters./)
      }
    })
  })

  describe('Reviews', () => {
    test('gracefully handles empty review', async () => {
      const interactions = [{ review: 'questions' }]
      const questioner = new Questioner({ interactions })
      await questioner.question()
    })
  })
})
