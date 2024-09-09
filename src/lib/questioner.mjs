/**
 * Exports `Questioner` object used to interogate the user and generate results based on answers and data mappings.
 * Refer to the [User's guide](https://github.com/liquid-labs/question-and-answer/README.md#users-guide) for
 * intherrogation bundle structure and expected behavior.
 *
 * ## Developer notes
 *
 * We're not strictly enforcing parameter types in-so-far as action defined parameters `value`, `source`, `elseValue`
 * and `elseSource` are essentially "trusted" to be of the proper type, though we do  but we should check and coerce
 * string results (from the values). Also, why not have `evalString` as an option from condition eval? E.g., `'' ||
 * 'Larry'` is a valid expression. (If we do this, it might make sense to separate out the 'safe expression' testing
 * to be distinct based on the type of item; e.g., '+' and '||' are valid with strings, but '%' is just nonsensical.)
 */
import * as readline from 'node:readline'

import columns from 'cli-columns'
import { getPrinter } from 'magic-print'
import {
  ArgumentInvalidError,
  ArgumentMissingError,
  ArgumentTypeError,
  rethrowIf
} from 'standard-error-set'
import { BooleanString, Integer, Numeric } from 'string-input'

import { Evaluator } from '@liquid-labs/condition-eval'

import { ibClone } from './lib/ib-clone'
import { translateType } from './lib/translate-type'

// disposition constants
const ANSWERED = 'answered'
const CONDITION_SKIPPED = 'condition-skipped'
const DEFINED_SKIPPED = 'define-skipped'

const Questioner = class {
  #initialParameters
  #input
  #output
  #interactions = []
  #noSkipDefined
  #results = []

  /**
   * Creates a `Questioner`.
   * @param {object} options - Constructor options.
   * @param {object} [options.input = process.stdin] - The object passed to `readline` as input.
   * @param {object} options.interactions - The interrogation spec.
   * @param {object} [options.initialParameters = {}] - Key/value object defining initial parameter values.
   * @param {boolean} [options.noSkipDefined = false] - By default, questions related to defined parameters are
   *   skipped. If this option is true, then defined questions are asked.
   * @param {object} [options.output = magic-print] - Object providing `write` function for output. If not defined,
   *   then [magic-print](https://github.com/liquid-labs/magic-print) is is used.
   * @param {object} [options.printOptions = undefined] - Options to pass to the 'magic-print' `getPrinter`. Ignored if
   *   `output` is provided.
   */
  constructor({
    input = process.stdin,
    interactions,
    initialParameters = {},
    noSkipDefined = false,
    output,
    printOptions,
  }) {
    this.#input = input
    if (output === undefined) {
      const print = getPrinter(printOptions)
      output = { write : print }
    }
    this.#output = output
    this.#interactions = ibClone(interactions)
    this.#initialParameters = initialParameters
    this.#noSkipDefined = noSkipDefined

    this.#verifyInterrogationBundle()

    let index = 0
    for (const action of this.#interactions) {
      action._index = index
      index += 1
    }
  }

  #addResult({ source, value }) {
    // We want 'value' last because the 'value' attached to the source is always a string, while the final value will
    // have been converted by type.

    const result = Object.assign(ibClone(source), { value })
    // Let's tidy up the results with some info that is more of internal use and less relevant for reporting.
    delete result.mappings
    // TODO: add option to retain these?
    delete result.elseValue
    delete result.elseSource
    source.value = value

    this.#results.push(source)
  }

  async #askQuestion(q) {
    // to avoid the 'MaxListenersExceededWarning', we have to create the rl inside the loop because everytime we do
    // our loop it ends up adding listeners for whatever reason.
    const rl = readline.createInterface({
      input    : this.#input,
      output   : this.#output,
      terminal : false,
    }) // TODO: why is terminal false?

    try {
      const type = translateType(q.type)
      // the previous answer, if any, becomes the new default
      let defaultValue
      if (q.options === undefined) {
        defaultValue = Object.hasOwn(q, 'rawAnswer')
          ? q.rawAnswer
          : q.default
      }
      else if (Object.hasOwn(q, 'rawAnswer')) {
        // the raw answer has already been validated on the previous go around, so we can trust it
        const selectionI = parseInt(q.rawAnswer)
        defaultValue = q.options[selectionI - 1]
      }
      else {
        defaultValue = q.default
      }
      if (typeof defaultValue === 'string') {
        const type = translateType(q.type);
        // TODO: this won't work with multivalue actions and multivalue defaults...
        // default values should have already been validated
        ([defaultValue] = verifyAnswerForm({ ...q, input: defaultValue, type }))
      }

      let prompt = q.prompt
      let defaultI
      let hint = ''
      if (q.options === undefined) {
        if (prompt.match(/\[[^]+\] *$/m)) {
          // do we already have a hint?
          hint = prompt.replace(/.+(\[[^]+\]) *$/, '$1') + ' '
          prompt = prompt.replace(/(.+?)\s*\[[^]+\] *$/, '$1') // we're going to add the hint back in a bit
        }
        else if (defaultValue !== undefined) {
          if (type === BooleanString) {
            hint = '[' + (defaultValue === true ? 'Y/n|-' : 'y/N|-') + '] '
          }
          else {
            hint = `[${defaultValue}|-] `
          }
        }
        else if (type === BooleanString) {
          hint = '[y/n] '
        }

        // the '\n' puts the input cursor below the prompt for consistency
        prompt += '\n' + hint
      }
      else {
        // the question has defined options
        prompt += '\n'
        if (defaultValue !== undefined) {
          prompt += '[' + defaultValue + ']\n'
        }
        prompt += '\n'
        const cliOptions = q.options.map((o, i) => i + 1 + ') ' + o)
        prompt += columns(cliOptions, { width : this.#output.width }) + '\n'
      }

      if (q.multiValue === true) {
        const sepDesc = q.separator === undefined ? 'comma' : `"${q.separator}'`
        prompt += `\nEnter one or more ${sepDesc} separated ${q.options ? 'selections' : 'values'}.\n`
      }

      this.#write({ options : q.outputOptions, text : '\n' + prompt })
      // rl.setPrompt(formatTerminalText(prompt))
      // rl.prompt()

      const it = rl[Symbol.asyncIterator]()
      let answer = (await it.next()).value.trim() || ''
      if (answer === '-') {
        answer = undefined
        delete q.rawAnswer
      }
      else {
        q.rawAnswer = answer.toString()
      }/*
      else if (answer === '') {
        if (defaultI === 0) {
          answer = undefined
        }
        else {
          // we change the default to a string so that we can still process the constraints using the 'string-input'
          // style type functions which expect a string input.
          answer = (defaultI !== undefined
            ? defaultI
            : defaultValue !== undefined
              ? defaultValue
              : '').toString()
        }
      }*/

      // if the user defines a separator, it may contain RE special characters we need to escape
      const separator =
        q.separator?.replaceAll(
          /(\.|\+|\*|\?|\^|\$|\||\(|\)|\{|\}|\[|\]|\\)/g,
          '\\$1'
        ) || ','
      // TODO: make this conditional on multi-value answers
      const splitAnswers =
        q.multiValue === true
          ? answer.split(new RegExp(`\\s*${separator}\\s*`))
          : [answer]

      const reAskQuestion = async (issue) => {
        const message = `<warn>${issue}<rst>\n`
        this.#write({ options : q.outputOptions, text : message })
        rl.close() // we'll create a new one
        await this.#askQuestion(q)
      }

      const values = []
      for (const anAnswer of splitAnswers) {
        // TODO: default should be handled separate/before multi-value question. You can't answer a multi-value with a 
        // default not a default; only full default or fully specified answer
        if (anAnswer === '') {
          if (defaultValue !== undefined) {
            values.push(defaultValue)
          }
          else { // there is no answer and no default value
            return await reAskQuestion('No default defined. Please provide a valid answer.')
          }
        }
        else if (q.options === undefined) {
          const [value, issue] = verifyAnswerForm({
            ...q,
            type,
            input : anAnswer,
          })
          if (issue === undefined) {
            values.push(value)
          }
          else {
            delete q.rawAnswer
            return await reAskQuestion(issue)
          }
        }
        else { 
          // it's an options question
          let [selectionI, issue] = verifyAnswerForm({ 
            type: Integer, 
            input: anAnswer,
            required: true,
            max: q.options.length,
            min: q.required === true ? 1 : 0,
            message: `Invalid selection. Please enter a number between 1 and ${q.options.length}.`,
          })
          if (issue !== undefined) {
            delete q.rawAnswer
            return await reAskQuestion(issue)
          } // else continue
          const value = q.options[selectionI - 1]
          values.push(value)
        }
      }

      // if we get here, then the answers are good
      q.disposition = ANSWERED
      const value = q.multiValue === true ? values : values[0]
      this.#addResult({ source : q, value })
    }
    finally {
      // try for rl
      rl.close()
    }
  }

  async #processActions() {
    let first = true
    let previousAction
    for (const action of this.#interactions) {
      // check condition skip
      if (
        action.condition !== undefined
        && this.#evalTruth(action.condition) === false
      ) {
        action.disposition = CONDITION_SKIPPED
        const type = translateType(action.type)
        if (action.elseValue !== undefined) {
          const { elseValue } = action
          const value =
            typeof elseValue === 'string'
              ? verifyAnswerForm({ ...action, input : elseValue, type })
              : elseValue
          this.#addResult({ source : action, value })
        }
        else if (action.elseSource !== undefined) {
          const type = translateType(action.type)
          const evalResult =
            type === BooleanString
              ? this.#evalTruth(action.elseSource)
              : this.#evalNumber(action.elseSource)
          const [value] = verifyAnswerForm({
            ...action,
            input : evalResult.toString(),
            type,
          })
          this.#addResult({ source : action, value })
        }
        else {
          this.#addResult({ source : action })
        }
        continue
      }

      const definedSkip =
        // v global no skip               v question-scoped no skip  v otherwise, skip if we has it
        this.#noSkipDefined !== true
        && action.noSkipDefined !== true
        && this.has(action.parameter) === true

      if (definedSkip === true) {
        // is already defined?
        action.disposition = DEFINED_SKIPPED
        // this is necessary because maybe we're getting the definition as part of the parameter inputs, which could
        // just be a string
        const type = translateType(action.type)
        const input = this.get(action.parameter).toString()
        const [value, issue] = verifyAnswerForm({ ...action, input, type })
        if (issue !== undefined) {
          throw new ArgumentInvalidError({
            endpointType : 'input',
            argumentName : action.parameter,
            issue,
            satus: 500,
          })
        }
        this.#addResult({ source : action, value })
      }
      else {
        // We want to put a newline between items, but if the previous was a question, we already have a newline from
        // the <return>
        if (first === false && previousAction.prompt === undefined) {
          this.#output.write('\n')
        }
        if (action.prompt !== undefined) {
          // it's a question
          await this.#askQuestion(action)
        }
        else if (action.maps !== undefined) {
          // it's a mapping
          this.#processMapping(action)
        }
        else if (action.statement !== undefined) {
          // it's a statement
          this.#write({ options : action.outputOptions, text : action.statement })
        }
        else if (action.review !== undefined) {
          // it's a review
          const [result, included] = await this.#processReview(action)
          if (result === true && action.parameter !== undefined) {
            // successful reviews can set a value
            this.#addResult({ source : action, value : result })
          }
          else if (result === false) {
            const toNix = included.reduce((acc, i) => {
              acc[i.parameter] = true

              return acc
            }, {})
            this.#results = this.#results.filter((r) => !(r.parameter in toNix))
            // TODO: shouldn't this only re-process the included actions?
            return await this.#processActions()
          }
        }
        else {
          throw new ArgumentInvalidError({
            endpointType : 'configuration',
            argumentName : 'interactions',
            issue        : `could not determine action type of ${action}`,
            status       : 500,
          })
        }
      } // else not defined skip
      first = false
      previousAction = action
    } // for (... this.#interactions)
  }

  #evalNumber(condition) {
    const evaluator = new Evaluator({ parameters : this.#evalParams() })

    return evaluator.evalNumber(condition)
  }

  #evalTruth(condition) {
    const evaluator = new Evaluator({ parameters : this.#evalParams() })

    return evaluator.evalTruth(condition)
  }

  #evalParams() {
    return Object.assign({}, this.#initialParameters, this.values)
  }

  get(parameter) {
    const val = this.getResult(parameter)?.value
    if (val === undefined) {
      // val may be 'false', which is fine
      return this.#initialParameters[parameter]
    }

    return val
  }

  getResult(parameter) {
    return this.#results.find((r) => r.parameter === parameter)
  }

  #getResultByIndex(index) {
    return this.#results.find((r) => r._index === index)
  }

  has(parameter) {
    return (
      this.get(parameter) !== undefined || parameter in this.#initialParameters
    )
  }

  get interactions() {
    return this.#interactions
  }

  #processMapping(mapping) {
    if (mapping.condition === undefined || this.#evalTruth(mapping.condition)) {
      mapping.maps.forEach((map) => {
        const type = translateType(map.type)

        // having both source and value is not allowed and verified when the IB is loaded
        if (map.source !== undefined) {
          let value

          // recall maps only support boolean and numeric types
          if (![BooleanString, Integer, Numeric].includes(type)) {
            throw new ArgumentInvalidError({
              endpointType : 'configuration',
              argumentName : 'interactions',
              issue        : `cannot map a 'source' value to parameter '${map.parameter}' of type '${map.type || 'string'}'`,
              hint         : "Type must be 'boolean', 'integer', or 'numeric'.",
              status       : 500,
            })
          }
          else if (map.type === BooleanString) {
            value = this.#evalTruth(map.source)
          }
          else {
            // it's numeric
            value = this.#evalNumber(map.source)
          }

          value = type(value.toString())
          this.#addResult({ source : map, value })
        }
        else if (map.value !== undefined) {
          const [value, issue] = verifyAnswerForm({
            input : map.value.toString(),
            ...map,
            type,
          })
          if (issue !== undefined) {
            throw new ArgumentInvalidError({
              message : `Mapping to parameter '${map.parameter}' ${issue}.`,
              status  : 500,
            })
          }
          this.#addResult({ source : map, value })
        }
        else {
          // this should already be verified up front, but for the sake of comopletness
          throw new Error(
            `Mapping for '${map.parameter}' must specify either 'source' or 'value'.`
          )
        }
      })
    }
  }

  async #processReview(reviewAction) {
    const reviewType = reviewAction.review
    const included = []
    for (const action of this.#interactions) {
      if (action === reviewAction) {
        break
      }
      else if (action.review !== undefined) {
        included.slice(0, included.length) // truncate
        continue
      }
      const result = this.#getResultByIndex(action._index)
      const include =
        action.statement === undefined
        && (reviewType === 'all' || action.prompt !== undefined)
        && !result?.disposition.endsWith('skipped')

      if (include) {
        if (action.prompt !== undefined) {
          included.push(action)
        }
        else if (action.maps !== undefined) {
          included.push(...action.maps)
        }
      }
    }
    if (included.length === 0) {
      return [true, []]
    }

    let reviewText = ''
    for (const action of included) {
      if (reviewText.length > 0) {
        reviewText += '\n'
      }

      if (action.prompt !== undefined) {
        reviewText += action.prompt + '\n'
      }
      reviewText += `[<bold>${action.parameter}<rst>]: <em>${this.get(action.parameter)}<rst>\n`
    }

    const sOrNot = included.length > 1 ? 's' : ''
    const header = `<h2>Review ${included.length} ${reviewType === 'all' ? 'value' : 'answer'}${sOrNot}:<rst>`

    this.#write({
      options : { hangingIndent : 2 },
      text    : header + '\n' + reviewText,
    })

    while (true) {
      const rl = readline.createInterface({
        input    : this.#input,
        output   : this.#output,
        terminal : false,
      })
      try {
        this.#output.write('\n<bold>Verified?<rst> [y/n] ')

        const it = rl[Symbol.asyncIterator]()
        const answer = (await it.next()).value.trim()
        const [value, issue] = verifyAnswerForm({
          type  : BooleanString,
          input : answer,
        })
        if (issue === undefined) {
          return [value, included]
        }
        else {
          this.#output.write(`<warn>${issue}<rst>` + '\n')
        }
      }
      finally {
        rl.close()
      }
    }
  }

  async question() {
    if (this.#interactions === undefined) {
      throw ArgumentMissingError({
        endpointType : 'function',
        argumentName : 'interactions',
        issue        : "must be set prior to invoking 'question'",
        status       : 500,
      })
    }

    await this.#processActions()
  }

  get results() {
    return structuredClone(this.#results)
  }

  get values() {
    return this.#results.reduce((acc, { parameter, value }) => {
      acc[parameter] = value

      return acc
    }, {})
  }

  #verifyInterrogationBundle() {
    const verifyMapping = ({ maps }) => {
      for (const { parameter, source, value } of maps) {
        if (parameter === undefined) {
          throw new ArgumentInvalidError({
            endpointType : 'configuration',
            argumentName : 'interactions',
            issue :
              "one of the 'mapping' actions fails to specify a 'parameter'",
            status : 500,
          })
        }
        if (source === undefined && value === undefined) {
          throw new ArgumentInvalidError({
            endpointType : 'configuration',
            argumentName : 'interactions',
            issue        : `mapping for '${parameter}' must specify one of 'source' or 'value'`,
            status       : 500,
          })
        }
      }
    }

    this.#interactions.forEach((action, i) => {
      if (
        action.prompt === undefined
        && action.maps === undefined
        && action.statement === undefined
        && action.review === undefined
      ) {
        throw new ArgumentInvalidError({
          endpointType : 'configuration',
          argumentName : 'interactions',
          issue        : `action ${i + 1} defines neither 'prompt', 'maps', 'statement', nor 'review'; cannot determine type`,
          status       : 500,
        })
      }
      else if (action.prompt !== undefined) {
        // TODO: replace with some kind of JSON schema verification
        if (action.parameter === undefined) {
          throw new ArgumentInvalidError({
            endpointType : 'configuration',
            argumentName : 'interactions',
            issue        : `question ${i + 1} does not define a 'parameter'`,
            status       : 500,
          })
        }
        
        if (
          action.type !== undefined
          && typeof action.type === 'string'
          && !action.type.match(/bool(?:ean)?|int(?:eger)?|float|numeric|string/)
        ) {
          throw new ArgumentInvalidError({
            endpointType : 'configuration',
            argumentName : 'interactions',
            issue        : `invalid parameter type '${action.type}' in interrogation bundle question ${i + 1}`,
            status       : 500,
          })
        }
      }
      else if (action.maps !== undefined) {
        verifyMapping(action)
      }
      else if (action.review !== undefined) {
        if (!['all', 'questions'].includes(action.review)) {
          throw new ArgumentInvalidError({
            endpointType : 'configuration',
            argumentName : 'interactions',
            issue        : `invalid review type '${action.review}'; must be 'all' or 'questions'`,
            status       : 500,
          })
        }
      }

      if (action.options !== undefined) {
        const { default: defaultValue, options } = action
        if (!Array.isArray(options)) {
          throw new ArgumentTypeError({
            argumentName: "interactions' 'options",
            issue: "'options' must be an array",
            status: 500,
          })
        }
        else if (defaultValue !== undefined && options.indexOf(defaultValue) === -1) {
          throw new ArgumentInvalidError({
            argumentName : "interactions' 'default",
            argumentValue: defaultValue,
            issue : 'is not any of the specified options',
            status: 500,
          })
        }
      }
    }) // foreach interaction
  }

  #write({ options, text }) {
    if (options === undefined) {
      this.#output.write(text)
    }
    else {
      this.#output.write.withOptions(options)(text)
    }
  }
}

const verifyAnswerForm = ({ type, input, ...paramOptions }) => {
  const options = Object.assign({ name : paramOptions.parameter }, paramOptions)
  delete options.parameter
  try {
    const value = type(input, options)

    return [value]
  }
  catch (e) {
    rethrowIf(e, { instanceOfNot : ArgumentInvalidError, statusIsNot : 400 })

    return [undefined, e.message]
  }
}

export { Questioner, ANSWERED, CONDITION_SKIPPED, DEFINED_SKIPPED }
