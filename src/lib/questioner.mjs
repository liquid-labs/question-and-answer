import * as readline from 'node:readline'

import createError from 'http-errors'

import { Evaluator } from '@liquid-labs/condition-eval'

const Questioner = class {
  #input
  #output
  #interogationBundle = []
  #values = {}

  constructor({ input = process.stdin, output = process.stdout } = {}) {
    this.#input = input
    this.#output = output
  }

  async #askQuestion(q) {
    const evaluator = new Evaluator({ parameters : this.#values })

    if (q.condition === undefined || evaluator.evalTruth(q.condition)) {
      // to avoid the 'MaxListenersExceededWarning', we have to create the rl inside the loop because everytime we do
      // our loop it ends up adding listeners for whatever reason.
      const rl = readline.createInterface({ input: this.#input, output: this.#output, terminal : false })

      try {
        rl.setPrompt('\n' + q.prompt + ' ') // add newline for legibility
        rl.prompt()

        const it = rl[Symbol.asyncIterator]()
        const answer = (await it.next()).value.trim() // TODO: check that 'answer' is in the right form

        const type = q.paramType || 'boolean'
        const verifyResult = verifyAnswerForm({ type, value: answer })
        if (verifyResult === true) {
          if ((/bool(ean)?/i).test(type)) {
            const value = !!(/^\s*(?:y(?:es)?|t(?:rue)?)\s*$/i).test(answer)
            this.#values[q.parameter] = value
          }
          else if ((/int(?:eger)?/i).test(type)) {
            this.#values[q.parameter] = parseInt(answer)
          }
          else if ((/float|numeric/i).test(type)) {
            this.#values[q.parameter] = parseFloat(answer)
          }
          else { // treat as a string
            this.#values[q.parameter] = answer
          }

          if (q.mappings !== undefined) {
            this.processMappings(q.mappings)
          }
        }
        else { // the 'answer form' is invalid; let's try again
          this.#output.write(verifyResult)
          rl.close() // we'll create a new one
          this.#askQuestion(q)
        }
      } // try for rl
      finally { rl.close() }
    }
  }

  async #doQuestions() {
    for (const q of this.#interogationBundle.questions) {
      await this.#askQuestion(q)
    }
  }

  get interogationBundle() { return this.#interogationBundle } // TODO: clone

  set interogationBundle(ib) { this.#interogationBundle = ib }

  processMappings(mappings) {
    mappings.forEach((mapping) => {
      const evaluator = new Evaluator({ parameters : this.#values })

      if (mapping.condition === undefined || evaluator.evalTruth(mapping.condition)) {
        mapping.maps.forEach((map) => {
          if (map.source !== undefined) {
            this.#values[map.target] = this.#values[map.source]
          }
          else if (map.value !== undefined) {
            this.#values[map.target] = map.value
          }
          else {
            throw new Error(`Mapping for '${map.target}' must specify either 'source' or 'value'.`)
          }
        })
      }
    })
  }

  async question() {
    if (this.#interogationBundle === undefined) {
      throw createError.BadRequest("Must set 'interogation bundle' prior to invoking the questioning.")
    }

    await this.#doQuestions()

    if (this.#interogationBundle.mappings !== undefined) {
      this.processMappings(this.#interogationBundle.mappings)
    }
  }

  get values() { return this.#values } // TODO: clone
}

const verifyAnswerForm = ({ output, type, value }) => {
  if ((/int(?:eger)?/i).test(type)) {
    if (isNaN(value) || !value.match(/^\d+$/)) {
      return `'${value}' is not a valid integer.`
    }
  }
  else if ((/float|numeric/i).test(type)) {
    if (isNaN(value) || !value.match(/^-?\d+(?:\.\d+)?$/)) {
      return `'${value}' is not a valid ${type}.`
    }
  }
  // else it's a string

  return true // we've passed the gauntlet
}

export { Questioner }
