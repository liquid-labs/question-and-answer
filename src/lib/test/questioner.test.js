/* global afterAll beforeAll describe expect jest test */
import * as fsPath from 'node:path'
import { spawn } from 'node:child_process'

import { stdin } from 'mock-stdin'

import {
  badParameterIB,
  cookieParameterIB,
  noQuestionParameterIB,
  simpleIB,
  simpleMapIB,
  sourceMappingIB,
  DO_YOU_LIKE_MILK,
  IS_THIS_THE_END,
  WHATS_YOUR_FAVORITE_INT
} from './test-data'
import { Questioner, ANSWERED, CONDITION_SKIPPED } from '../questioner'

const input = stdin()

jest.setTimeout(750) // tried to set this in 'beforeAll', but it failed; we try and restore value 'afterAll' tests.

describe('Questioner', () => {
  afterAll(() => jest.setTimeout(5000)) // restore default

  describe('QnA flow', () => {
    test('skips questions with a pre-existing parameter value', (done) => {
      const testScriptPath = fsPath.join(__dirname, 'double-question.js')

      // You cannot (as of Node 19.3.0) listen for events on your own stdout, so we have to create a child process.
      const child = spawn('node', [testScriptPath])

      child.stdout.resume()
      let readCount = 0
      child.stdout.on('data', (output) => {
        try {
          if (readCount === 0) {
            expect(output.toString().trim()).toBe('Is the Company the client?\n[y=client/n=contractor]')
          }
          else if (readCount === 1) {
            expect(output.toString().trim()).toBe('')
          }
          else if (readCount === 2) {
            expect(output.toString().trim()).toBe('Done?\n[y/n]')
            child.stdin.write('yes\n')
            child.kill('SIGINT')
            done()
          }
        }
        catch (e) {
          child.kill('SIGINT')
          done()
          throw e
        }

        readCount += 1
      })

      child.stdin.write('yes\n')
    })

    test("when question is condition-skipped, uses 'elseValue' if present", (done) => {
      const ib = structuredClone(simpleMapIB)
      ib.actions[0].condition = 'FOO'
      ib.actions[0].elseValue = false
      const initialParameters = { FOO : false }

      const questioner = new Questioner({ initialParameters, interrogationBundle : ib })

      questioner.question().then(() => {
        try {
          expect(questioner.get('IS_CLIENT')).toBe(false)
          expect(questioner.getResult('IS_CLIENT').disposition).toBe(CONDITION_SKIPPED)
          expect(questioner.get('ORG_COMMON_NAME')).toBe('them') // this is the mapped value
        }
        finally { done() }
      })
    })

    test('Will re-ask questions when answer form invalid', (done) => {
      const testScriptPath = fsPath.join(__dirname, 'simple-int-question.js')

      // You cannot (as of Node 19.3.0) listen for events on your own stdout, so we have to create a child process.
      const child = spawn('node', [testScriptPath])

      child.stdout.resume()
      let count = 0
      child.stdout.on('data', (output) => {
        try {
          if (count === 0) {
            expect(output.toString().trim()).toBe(WHATS_YOUR_FAVORITE_INT)
          }
          else if (count === 1 && output.toString().split('\n').length === 2) {
            expect(output.toString().trim()).toMatch(/not a valid.+\n.+favorite int/m)
            child.kill('SIGINT')
            done()
          }
          else if (count === 1) {
            expect(output.toString().trim()).toMatch(/not a valid/)
          }
          else if (count === 2) {
            expect(output.toString().trim()).toBe(WHATS_YOUR_FAVORITE_INT)
            child.kill('SIGINT')
            done()
          }
        }
        catch (e) {
          child.kill('SIGINT')
          done()
        }

        count += 1
      })

      child.stdin.write('not a number\n')
    })

    test.each([
      ['an invalid parameter type', badParameterIB, /unknown parameter type/i],
      ["no 'parameter' for question", noQuestionParameterIB, /does not define a 'parameter'/]
    ])('Will raise an exception on %s.', (desc, ib, exceptionRe) => {
      expect(() => new Questioner({ interrogationBundle : ib })).toThrow(exceptionRe)
    })
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
      ['False', false]
    ])("simple boolean question answer '%s' -> %s", (answer, expected, done) => {
      const questioner = new Questioner({ interrogationBundle : simpleIB })

      questioner.question().then(() => {
        try {
          const result = questioner.getResult('IS_CLIENT')
          expect(result.value).toBe(expected)
          expect(result.rawAnswer).toBe(answer)
          expect(result.disposition).toBe(ANSWERED)
        }
        finally { done() }
      })
      input.send(answer + '\n')
    })
  })

  describe('Mappings', () => {
    test.each([/* ['yes', 'us'], */['no', 'them']])('value map %s -> %s', (answer, value, done) => {
      const questioner = new Questioner({ interrogationBundle : simpleMapIB })

      questioner.question().then(() => {
        try {
          expect(questioner.values.ORG_COMMON_NAME).toBe(value)
        }
        finally { done() }
      })
      input.send(answer + '\n')
    })

    test.each([
      ['1', 'FAVE_DIFF', 2],
      ['1', 'IS_FAVE_NOT_ZERO', true],
      ['0', 'IS_FAVE_NOT_ZERO', false]
    ])("source map 'FAVE_INT'=%s, yields '%s'=%s'", (faveInt, parameter, value, done) => {
      const questioner = new Questioner({ interrogationBundle : sourceMappingIB })

      questioner.question().then(() => {
        expect(questioner.values[parameter]).toBe(value)
        done()
      })
      input.send(faveInt + '\n')
    })

    test.each([
      ['bool', 'y', true],
      ['int', '1', 1]
    ])('maps \'source\'d paramType %s input \'%s\' -> %p', (paramType, value, expected, done) => {
      const interrogationBundle = structuredClone(simpleMapIB)
      delete interrogationBundle.actions[1].maps[0].value
      interrogationBundle.actions[1].maps[0].paramType = paramType
      interrogationBundle.actions[1].maps[0].source = 'ENV_VAR'
      const initialParameters = { ENV_VAR : value }

      const questioner = new Questioner({ interrogationBundle, initialParameters })

      questioner.question().then(() => {
        expect(questioner.values.ORG_COMMON_NAME).toBe(expected)
        done()
      })
      input.send('yes\n')
    })
  })

  describe('Conditional questions', () => {
    test.each([
      ['yes', DO_YOU_LIKE_MILK],
      ['no', IS_THIS_THE_END]
    ])('Conditional question %s -> %s', (answer, followup, done) => {
      const testScriptPath = fsPath.join(__dirname, 'conditional-question.js')

      // You cannot (as of Node 19.3.0) listen for events on your own stdout, so we have to create a child process.
      const child = spawn('node', [testScriptPath])

      child.stdout.resume()
      let readCount = 0

      const complete = () => {
        child.stdin.write('yes\n')
        if (answer === 'yes') {
          child.stdin.write('yes\n')
        }
        child.kill('SIGINT')
        done()
      }

      child.stdout.on('data', (output) => {
        try {
          output = output.toString().trim()
          if (readCount === 0) {
            expect(output).toBe('Is the Company the client?\n[y=client/n=contractor]')
          }
          else if (readCount === 1) {
            // the intermediate space can be combined with the followup on the read
            try {
              expect(output).toBe('')
            }
            catch (e) {
              expect(output).toBe(followup)
              complete()
            }
          }
          else if (readCount === 2) {
            expect(output).toBe(followup)
            complete()
          }
          readCount += 1
        }
        catch (e) {
          child.kill('SIGINT')
          done()
          throw e
        }
      })

      child.stdin.write(answer + '\n')
    })

    test("when question is condition-skipped, uses 'elseSource' if present", (done) => {
      const ib = structuredClone(simpleMapIB)
      ib.actions[0].condition = 'FOO'
      ib.actions[0].elseSource = 'BAR || BAZ'
      ib.actions[1].condition = 'BAZ'
      const initialParameters = { FOO : false, BAR : true, BAZ : false }

      const questioner = new Questioner({ initialParameters, interrogationBundle : ib })

      questioner.question().then(() => {
        try {
          expect(questioner.get('IS_CLIENT')).toBe(true)
          expect(questioner.getResult('IS_CLIENT').disposition).toBe(CONDITION_SKIPPED)
          expect(questioner.get('ORG_COMMON_NAME')).toBe(undefined) // this is the mapped value
        }
        finally { done() }
      })
    })
  })

  describe('Value transforms', () => {
    test.each([
      ['true', 'boolean', true],
      ['true', 'bool', true],
      ['true', 'string', 'true'],
      ['5', 'integer', 5],
      ['5.5', 'float', 5.5],
      ['6.6', 'numeric', 6.6]
    ])("Value '%s' type '%s' -> %p", (value, type, expected, done) => {
      const ib = structuredClone(simpleIB)
      ib.actions[0].paramType = type

      const questioner = new Questioner({ interrogationBundle : ib })

      questioner.question().then(() => {
        try {
          expect(questioner.values.IS_CLIENT).toBe(expected)
        }
        finally { done() }
      })
      input.send(value + '\n')
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
      [' Hi   Bye ', ' ', ['Hi', 'Bye']]
    ])("Answer '%s' sep '%s' -> %p", (answer, sep, expected, done) => {
      const ib = structuredClone(simpleIB)
      delete ib.actions[0].paramType
      ib.actions[0].multiValue = true
      ib.actions[0].separator = sep

      const questioner = new Questioner({ interrogationBundle : ib })

      questioner.question().then(() => {
        try {
          expect(questioner.values.IS_CLIENT).toEqual(expected)
        }
        finally { done() }
      })
      input.send(answer + '\n')
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
      [' 1   2 ', ' ', ['Hi', 'Bye']]
    ])("Answer '%s' sep '%s' -> %p", (answer, sep, expected, done) => {
      const ib = structuredClone(simpleIB)
      delete ib.actions[0].paramType
      ib.actions[0].multiValue = true
      ib.actions[0].separator = sep
      ib.actions[0].options = ['Hi', 'Bye']

      const questioner = new Questioner({ interrogationBundle : ib })

      questioner.question().then(() => {
        try {
          expect(questioner.values.IS_CLIENT).toEqual(expected)
        }
        finally { done() }
      })
      input.send(answer + '\n')
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
      ['Hi', 'string', 'requireMatch', '^[Hi]*$']
    ])("Value '%s' (%s) and requirement %s=%s is accepted", (value, type, requirement, reqValue, done) => {
      const ib = structuredClone(simpleIB)
      ib.actions[0].paramType = type
      ib.actions[0][requirement] = reqValue

      const questioner = new Questioner({ interrogationBundle : ib })

      questioner.question().then(() => {
        try {
          expect(questioner.values.IS_CLIENT + '').toBe(value)
        }
        finally { done() }
      })
      input.send(value + '\n')
    })

    test.each([
      // requireSomething
      ['', 'string', 'requireSomething', true],
      // requireTruthy
      ['', 'string', 'requireTruthy', true],
      ['0', 'int', 'requireTruthy', true],
      ['false', 'bool', 'requireExact', true],
      // requireExact
      ['Hi', 'string', 'requireExact', 'Bye'],
      ['1', 'int', 'requireExact', 2],
      ['true', 'bool', 'requireExact', false],
      ['false', 'bool', 'requireExact', true],
      // requireOneOf
      ['Hello', 'string', 'requireOneOf', 'Hi, Bye'],
      ['10', 'int', 'requireOneOf', '1,2'],
      ['false', 'bool', 'requireOneOf', 'true'],
      // requireMatch
      ['Hi', 'string', 'requireMatch', 'Bye'],
      ['Hi', 'string', 'requireMatch', '^[Bye]*$']
    ])("Value '%s' (%s) and requirement %s=%s is rejected", (answer, type, requirement, reqValue, done) => {
      const testScriptPath = fsPath.join(__dirname, 'verify-failure-question.js')

      // You cannot (as of Node 19.3.0) listen for events on your own stdout, so we have to create a child process.
      const child = spawn('node', [testScriptPath, type, requirement, reqValue])
      child.stdout.resume()
      child.stdout.once('data', (devNull) => { // this is just the original question; we don't care about it here
        child.stdout.once('data', (output) => {
          try {
            expect(output.toString().trim()).toMatch(/must/)
          }
          finally {
            child.kill('SIGINT')
            done()
          }
        })
        child.stdin.write(answer + '\n')
      })
    })
  })

  describe('answer requirements (multi value)', () => {
    test.each([
      // requireMinCount
      ['Hi,Bye', 'requireMinCount', 1],
      ['Hi,Bye', 'requireMinCount', 2],
      // requireMaxCount
      ['Hi,Bye', 'requireMaxCount', 3],
      ['Hi,Bye', 'requireMaxCount', 2]
    ])("Value '%s' (%s) and requirement %s=%s is accepted", (value, requirement, reqValue, done) => {
      const ib = structuredClone(simpleIB)
      ib.actions[0].paramType = 'string'
      ib.actions[0].multiValue = true
      ib.actions[0][requirement] = reqValue

      const questioner = new Questioner({ interrogationBundle : ib })

      questioner.question().then(() => {
        try {
          expect(questioner.values.IS_CLIENT + '').toBe(value)
        }
        finally { done() }
      })
      input.send(value + '\n')
    })

    test.each([
      // requireMinCount
      ['Hi', 'requireMinCount', 2],
      ['Hi,Bye', 'requireMinCount', 3],
      // requireMaxCount
      ['Hi,Bye', 'requireMaxCount', 1],
      ['Hi,Bye,Blah', 'requireMaxCount', 2]
    ])("Value '%s' (%s) and requirement %s=%s is rejected", (answer, requirement, reqValue, done) => {
      const testScriptPath = fsPath.join(__dirname, 'verify-failure-multi-question.js')

      // You cannot (as of Node 19.3.0) listen for events on your own stdout, so we have to create a child process.
      const child = spawn('node', [testScriptPath, requirement, reqValue])
      child.stdout.resume()
      child.stdout.once('data', (devNull) => { // this is just the original question; we don't care about it here
        child.stdout.once('data', (output) => {
          try {
            expect(output.toString().trim()).toMatch(/must/)
          }
          finally {
            child.kill('SIGINT')
            done()
          }
        })
        child.stdin.write(answer + '\n')
      })
    })
  })

  describe('cookie parameters', () => {
    const questioner = new Questioner({ interrogationBundle : cookieParameterIB })

    beforeAll(async() => {
      const qPromise = questioner.question()
      input.send('yes\n')
      await qPromise
    })

    test('are passed from questions', () =>
      expect(questioner.getResult('IS_CLIENT').handling).toBe('bundle')
    )

    test('are passed from maps', () =>
      expect(questioner.getResult('ORG_COMMON_NAME').handling).toBe('bundle')
    )
  })

  describe('statements', () => {
    test('prints statement', (done) => {
      const testScriptPath = fsPath.join(__dirname, 'question-runner.js')
      const child = spawn('node', [testScriptPath, 'statementIB'])

      child.stdout.resume()
      child.stdout.once('data', (output) => {
        try {
          expect(output.toString().trim()).toBe('Hi!')
        }
        finally {
          child.kill('SIGINT')
          done()
        }
      })
    })

    test('properly skips condition skip statements', (done) => {
      const testScriptPath = fsPath.join(__dirname, 'question-runner.js')
      const child = spawn('node', [testScriptPath, 'conditionStatementIB'])

      child.stdout.resume()
      child.stdout.once('data', (output) => {
        try {
          expect(output.toString().trim()).toBe('Bye!')
        }
        finally {
          child.kill('SIGINT')
          done()
        }
      })
    })
  })
})
