import * as readline from 'node:readline'

import createError from 'http-errors'

import { Evaluator } from '@liquid-labs/condition-eval'

const Questioner = class {
  #interogationBundle = []
  #values = {}

  async #doQuestions({ input = process.stdin, output = process.stdout }) {
    for (const q of this.#interogationBundle.questions) {
      const evaluator = new Evaluator({ parameters : this.#values })

      if (q.condition === undefined || evaluator.evalTruth(q.condition)) {
        // to avoid the 'MaxListenersExceededWarning', we have to create the rl inside the loop because everytime we do
        // our loop it ends up adding listeners for whatever reason.
        const rl = readline.createInterface({ input, output, terminal : false })

        try {
          rl.setPrompt('\n' + q.prompt + ' ') // add newline for legibility
          rl.prompt()

          const it = rl[Symbol.asyncIterator]()
          const answer = await it.next() // TODO: check that 'answer' is in the right form

          if (q.paramType === undefined || (/bool(ean)?/i).test(q.paramType)) {
            const value = !!(/^\s*(?:y(?:es)?|t(?:rue)?)\s*$/i).test(answer.value)
            this.#values[q.parameter] = value
          }
          else if ((/string|numeric|float|int(eger)?/i).test(q.paramType)) {
            if ((/int(?:eger)?/i).test(q.paramType)) {
              if (isNaN(answer.value)) {
                throw createError.BadRequest(`Parameter '${q.parameter}' must be a numeric type.`)
              }
              this.#values[q.parameter] = parseInt(answer.value)
            }
            else if ((/float|numeric/i).test(q.paramType)) {
              if (isNaN(answer.value) && (/-?\\d+\\.\\d+/).test(answer.value)) {
                throw new Error(`Parameter '${q.parameter}' must be a (basic) floating point number.`)
              }
              this.#values[q.parameter] = parseFloat(answer.value)
            }
            else { // treat as a string
              this.#values[q.parameter] = answer.value
            }
          }
          else {
            throw new Error(`Unknown parameter type '${q.paramType}' in 'questions' section.`)
          }

          if (q.mappings !== undefined) {
            this.processMappings(q.mappings)
          }
        } // try for rl
        finally { rl.close() }
      }
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

  async question({ input, output } = {}) {
    if (this.#interogationBundle === undefined) {
      throw createError.BadRequest("Must set 'interogation bundle' prior to invoking the questioning.")
    }

    await this.#doQuestions({ input, output })

    if (this.#interogationBundle.mappings !== undefined) {
      this.processMappings(this.#interogationBundle.mappings)
    }
  }

  get values() { return this.#values } // TODO: clone
}

export { Questioner }
