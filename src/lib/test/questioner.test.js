/* global describe expect test */
import { stdin } from 'mock-stdin'

import { Questioner } from '../questioner'

const input = stdin()

const simplePrompt = "Is the Company the client? (y=client/n=contractor)"
const simpleIB = {
  questions: [
    { prompt: simplePrompt, parameter: "IS_CLIENT" }
  ]
}

const simpleMapIB = structuredClone(simpleIB)
simpleMapIB.mappings = [
  {
    "condition": "IS_CLIENT",
    "maps": [
      { "target": "ORG_COMMON_NAME", "value": "us" },
    ]
  },
  {
    "condition": "!IS_CLIENT",
    "maps": [
      { "target": "ORG_COMMON_NAME", "value": "them" },
    ]
  }
]

describe('Questioner', () => {
  test('can process a simple boolean question', (done) => {
    const questioner = new Questioner()
    questioner.interogationBundle = simpleIB

    questioner.question({ input }).then(() => {
      expect(questioner.values.IS_CLIENT).toBe(true)
      done()
    })

    input.send('yes\n')
  })

  test.each([ ['yes', 'us'], ['no', 'them'] ])('Global map %s -> %s', (answer, mapping, done) => {
    const questioner = new Questioner()
    questioner.interogationBundle = simpleMapIB

    questioner.question({ input }).then(() => {
      expect(questioner.values.ORG_COMMON_NAME).toBe(mapping)
      done()
    })

    input.send(answer + '\n')
  })
})