import * as readline from 'node:readline'

import createError from 'http-errors'

import { Evaluator } from '@liquid-labs/condition-eval'

const Questioner = class {
  #input
  #output
  #interogationBundle = []
  #results = []

  constructor({ input = process.stdin, output = process.stdout } = {}) {
    this.#input = input
    this.#output = output
  }

  #addResult({ value, source }) {
    // We want source second so that we create a new object rather than modify source. We want 'value' last because
    // the 'value' attached to the source is always a string, while the final value will have been converted by type.
    // We could also use 'structuredClone', but Object.assign should be sufficient.
    const result = Object.assign({}, source, { value })
    delete result.mappings
    this.#results.push(result)
  }

  async #askQuestion(q) {
    if (q.condition === undefined || this.#evalCondition(q.condition)) {
      // to avoid the 'MaxListenersExceededWarning', we have to create the rl inside the loop because everytime we do
      // our loop it ends up adding listeners for whatever reason.
      const rl = readline.createInterface({ input : this.#input, output : this.#output, terminal : false })

      try {
        rl.setPrompt('\n' + q.prompt + ' ') // add newline for legibility
        rl.prompt()

        const it = rl[Symbol.asyncIterator]()
        const answer = (await it.next()).value.trim() // TODO: check that 'answer' is in the right form

        const type = q.paramType || 'string'
        const verifyResult = verifyAnswerForm({ type, value : answer })
        if (verifyResult === true) {
          this.#addResult({ source : q, value : transformValue({ paramType : type, value : answer }) })

          if (q.mappings !== undefined) {
            this.#processMappings(q.mappings)
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

  #evalCondition(condition) {
    const evaluator = new Evaluator({ parameters : this.values })
    return evaluator.evalTruth(condition)
  }

  get(parameter) {
    return this.getResult(parameter)?.value
  }

  getResult(parameter) {
    return this.#results.find((r) => r.parameter === parameter)
  }

  get interogationBundle() { return this.#interogationBundle } // TODO: clone

  set interogationBundle(ib) {
    const verifyMappings = (mappings) => {
      for (const { maps } of mappings) { // TODO: verify condition if present
        for (const { parameter, source, value } of maps) {
          if (parameter === undefined) {
            throw createError.BadRequest("One of the mappings lacks a 'parameter' parameter.")
          }
          if (source === undefined && value === undefined) {
            throw createError.BadRequest(`Mapping for '${parameter}' must specify one of 'source' or 'value'.`)
          }
        }
      }
    }

    ib.questions.forEach(({ mappings, parameter, paramType, prompt }, i) => {
      // TODO: replace with some kind of JSON schema verification
      if (parameter === undefined) {
        throw createError.BadRequest(`Question ${i + 1} does not define a 'parameter'.`)
      }
      if (prompt === undefined) {
        throw createError.BadRequest(`Question ${i + 1} does not define a 'prompt'.`)
      }
      if (paramType !== undefined && !paramType.match(/bool(?:ean)?|int(?:eger)?|float|numeric|string/)) {
        throw createError.BadRequest(`Found unknown parameter type '${paramType}' in interogation bundle question ${i + 1}.`)
      }

      if (mappings) {
        verifyMappings(mappings)
      }

      // TODO: verify conditionals...
    })

    if (ib.mappings) {
      verifyMappings(ib.mappings)
    }

    this.#interogationBundle = ib
  }

  #processMappings(mappings) {
    mappings.forEach((mapping) => {
      if (mapping.condition === undefined || this.#evalCondition(mapping.condition)) {
        mapping.maps.forEach((map) => {
          // having both source and value is not allowed and verified when the IB is loaded
          if (map.source !== undefined) {
            const evaluator = new Evaluator({ parameters : this.values })
            let value
            if (map.paramType.match(/bool(?:ean)?/i)) {
              value = evaluator.evalTruth(map.source)
            }
            else if (map.paramType === undefined || map.paramType === 'string') {
              throw createError.BadRequest(`Cannot map parameter '${map.parameter}' of type 'string' to a 'source' value. Must boolean or some numeric type.`)
            }
            else {
              value = evaluator.evalNumber(map.source)
              value = transformValue({ paramType : map.paramType, value })
            }
            this.#addResult({ source : map, value })
          }
          else if (map.value !== undefined) {
            this.#addResult({ source : map, value : transformValue(map) })
          }
          else { // this should already be verified up front, but for the sake of comopletness
            throw new Error(`Mapping for '${map.parameter}' must specify either 'source' or 'value'.`)
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
      this.#processMappings(this.#interogationBundle.mappings)
    }
  }

  get results() { return structuredClone(this.#results) }

  get values() {
    return this.#results.reduce((acc, { parameter, value }) => { acc[parameter] = value; return acc }, {})
  }
}

const transformValue = ({ paramType, value }) => {
  if (paramType === undefined || paramType === 'string') { // most common case
    return value
  }
  else if ((/bool(ean)?/i).test(paramType)) {
    value = !!(/^\s*(?:y(?:es)?|t(?:rue)?)\s*$/i).test(value)
  }
  else if ((/int(?:eger)?/i).test(paramType)) {
    value = parseInt(value)
  }
  else if ((/float|numeric/i).test(paramType)) {
    value = parseFloat(value)
  }
  else { // this should be pre-screenned, but for the sake of robustness and completeness
    throw createError.BadRequest(`Invalid parameter type '${paramType}' found while processing interogation bundle.`)
  }

  return value
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
