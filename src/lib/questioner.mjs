/**
 * Exports `Questioner` object used to interogate the user and generate results based on answers and data mappings.
 * Refer to the [User's guide](https://github.com/liquid-labs/question-and-answer/README.md#users-guide) for
 * intherrogation bundle structure and expected behavior.
 *
 * ## Developer notes
 *
 * We're not strictly enforcing parameter types in-so-far as action defined parameters `value`, `source`, `elseValue`
 * and `elseSource` are essentialy "trusted" to be of the proper type, though we do  but we should check and coerce
 * string results (from the values). Also, why not have `evalString` as an option from condition eval? E.g., `'' ||
 * 'Larry'` is a valid expression. (If we do this, it might make sense to separate out the 'safe expression' testing
 * to be distinct based on the type of item; e.g., '+' and '||' are valid with strings, but '%' is just non-sensical.)
 *
 * @module
 */
import * as readline from 'node:readline'

import columns from 'cli-columns'
import createError from 'http-errors'
import { getPrinter } from 'magic-print'

import { Evaluator } from '@liquid-labs/condition-eval'

// disposition constants
const ANSWERED = 'answered'
const CONDITION_SKIPPED = 'condition-skipped'
const DEFINED_SKIPPED = 'define-skipped'

const Questioner = class {
  #initialParameters
  #input
  #output
  #interrogationBundle = []
  #noSkipDefined
  #results = []

  /**
   * Creates a `Questioner`.
   *
   * @param {object} options.input - The object passed to `readline` as input. Default to `process.stdin`.
   * @param {object} options.interrogationBundle - The interrogation spec.
   * @param {object} options.initialParameters - Key/value object defining initial parameter values.
   * @param {boolean} options.noSkipDefined - By default, questions related to defined parameters are skipped. If this
   *   option is true, then defined questions are asked.
   * @param {object} options.output - The output object to use. Must define `write`. If not defined, then 'magic-print'
   *   is is used.
   * @param {object} options.printOptions - Options to pass to the 'magic-print' `getPrinter`. Ignored if `output` is
   *   provided.
   */
  constructor({
    input = process.stdin,
    interrogationBundle,
    initialParameters = {},
    noSkipDefined = false,
    output,
    printOptions
  } = {}) {
    this.#input = input
    if (output === undefined) {
      const print = getPrinter(printOptions)
      output = { write : print }
    }
    this.#output = output
    this.#interrogationBundle = structuredClone(interrogationBundle)
    this.#initialParameters = initialParameters
    this.#noSkipDefined = noSkipDefined

    this.#verifyInterrogationBundle()

    let index = 0
    for (const action of this.#interrogationBundle.actions) {
      action._index = index
      index += 1
    }
  }

  #addResult({ value, source }) {
    // We want 'value' last because the 'value' attached to the source is always a string, while the final value will
    // have been converted by type.
    const result = Object.assign(structuredClone(source), { value })
    // Let's tidy up the results with some info that is more of internal use and less relevant for reporting.
    delete result.mappings
    // TODO: add option to retain these?
    delete result.elseValue
    delete result.elseSource
    this.#results.push(result)
  }

  async #askQuestion(q) {
    // to avoid the 'MaxListenersExceededWarning', we have to create the rl inside the loop because everytime we do
    // our loop it ends up adding listeners for whatever reason.
    const rl = readline.createInterface({ input : this.#input, output : this.#output, terminal : false }) // TODO: why is terminal false?

    try {
      const type = q.paramType || 'string'
      let defaultValue = this.get(q.parameter) || q.default
      if (!verifyAnswerForm({ type, value : defaultValue })) {
        defaultValue = undefined
      }

      let prompt = q.prompt
      let defaultI
      let hint = ''
      if (q.options === undefined) {
        if (defaultValue !== undefined) {
          if (q.paramType?.match(/bool(?:ean)?/i)) {
            hint = '[' + (defaultValue === true ? 'Y/n|-' : 'y/N|-') + '] '
          }
          else {
            hint = `[${defaultValue}|-] `
          }
        }
        else if (prompt.match(/\[[^]+\] *$/)) { // do we already have a hint?
          hint = prompt.replace(/.+(\[[^]+\]) *$/, '$1') + ' '
          prompt = prompt.replace(/(.+?)\s*\[[^]+\] *$/, '$1') // we're gonig to add the hint back in a bit
        }
        else if (q.paramType?.match(/bool(?:ean)?/i)) {
          hint = '[y/n] '
        }

        // the '\n' puts the input cursor below the prompt for consistency
        prompt += '\n' + hint
      }
      else {
        prompt += '\n'
        const cliOptions = q.options.map((o, i) => (i + 1) + ') ' + o)
        prompt += columns(cliOptions, { width : this.#output.width }) + '\n'
        if (defaultValue !== undefined) {
          // defaultI is 1-indexed
          defaultI = q.options.indexOf(defaultValue) + 1
          if (defaultI === 0) {
            delete q.default
          }
          else {
            defaultI += '' // processing expects a string
            prompt += '[' + defaultValue + '] '
          }
        }
      }

      if (q.multiValue === true) {
        const sepDesc = q.separator === undefined ? 'comma' : `"${q.separator}'`
        prompt += `\nEnter one or more ${sepDesc} separated ${q.options ? 'selections' : 'values'}.\n`
      }

      this.#write({ options: q.outputOptions, text: '\n' + prompt })
      // rl.setPrompt(formatTerminalText(prompt))
      // rl.prompt()

      const it = rl[Symbol.asyncIterator]()
      let answer = (await it.next()).value.trim() || ''
      if (answer === '-') {
        answer = undefined
        delete q.default
      }
      else if (answer === '') {
        if (defaultI === 0) {
          answer = undefined
        }
        else {
          answer = defaultI || defaultValue // which will be undefined if no neither defined
        }
      }
      q.rawAnswer = answer

      // escape special characters
      const separator = q.separator?.replaceAll(/(\.|\+|\*|\?|\^|\$|\||\(|\)|\{|\}|\[|\]|\\)/g, '\\$1') || ','
      const splitAnswers = q.multiValue === true ? answer.split(new RegExp(`\\s*${separator}\\s*`)) : [answer]

      let verifyResult = true
      if (q.multiValue === true) {
        verifyResult = verifyMultiValueRequirements({ op : q, splitAnswers })
      }
      const values = []
      if (verifyResult === true) {
        for (const aValue of splitAnswers) {
          if (q.options === undefined) {
            // first verify form as a string
            verifyResult = verifyAnswerForm({ type, value : aValue })
            if (verifyResult === true) {
              const value = transformStringValue({ paramType : type, value : aValue })
              verifyResult = verifySingleValueRequirements({ op : q, value })
              values.push(value)
            }
          }
          else { // it's an option question
            const selectionI = parseInt(aValue)
            if (!aValue.match(/^\d+$/) || isNaN(selectionI) || selectionI < 1 || selectionI > q.options.length) {
              verifyResult = `Please enter a number between 1 and ${q.options.length}.`
            }
            else {
              verifyResult = true
              const value = q.options[selectionI - 1]
              values.push(value)
            }
          }

          if (verifyResult !== true) break
        }
      }

      if (verifyResult === true) {
        q.disposition = ANSWERED
        const value = q.multiValue === true ? values : values[0]
        this.#addResult({ source : q, value })
      }
      else { // the 'answer form' is invalid; let's try again
        verifyResult = '<warn>' + verifyResult + '<rst>\n'
        this.#write({ options: q.outputOptions, text: verifyResult })
        rl.close() // we'll create a new one
        await this.#askQuestion(q)
      }
    } // try for rl
    finally { rl.close() }
  }

  async #processActions() {
    let first = true
    let previousAction
    for (const action of this.#interrogationBundle.actions) {
      // check condition skip
      if (action.condition !== undefined && this.#evalTruth(action.condition) === false) {
        action.disposition = CONDITION_SKIPPED
        if (action.elseValue !== undefined) {
          this.#addResult({ source : action, value : action.elseValue })
        }
        else if (action.elseSource !== undefined) {
          this.#addResult({
            source : action,
            value  : action.paramType.match(/bool(?:ean)?/)
              ? this.#evalTruth(action.elseSource)
              : this.#evalNumber(action.elseSource)
          })
        }
        else {
          this.#addResult({ source : action })
        }
        continue
      }

      const definedSkip =
        // v global no skip               v question-scoped no skip  v otherwise, skip if we has it
        (this.#noSkipDefined !== true && action.noSkipDefined !== true && this.has(action.parameter) === true)

      if (definedSkip === true) { // is already defined?
        action.disposition = DEFINED_SKIPPED
        const value = transformStringValue({ paramType : action.paramType, value : this.get(action.parameter) })
        this.#addResult({ source : action, value })
        continue
      }

      // We want to put a newline between items, but if the previous was a question, we already have a newline from the
      // <return>
      if (first === false && previousAction.prompt === undefined) {
        this.#output.write('\n')
      }
      if (action.prompt !== undefined) { // it's a question
        await this.#askQuestion(action)
      }
      else if (action.maps !== undefined) { // it's a mapping
        this.#processMapping(action)
      }
      else if (action.statement !== undefined) { // it's a statement
        this.#write({ options: action.outputOptions, text: action.statement })
      }
      else if (action.review !== undefined) { // it's a review
        const [result, included] = await this.#processReview(action)
        if (result === true && action.parameter !== undefined) {
          this.#addResult({ source : action, value : result })
        }
        else if (result === false) {
          const toNix = included.reduce((acc, i) => {
            acc[i.parameter] = true
            return acc
          }, {})
          this.#results = this.#results.filter((r) => !(r.parameter in toNix))
          await this.#processActions()
          break
        }
      }
      else {
        throw createError.BadRequest(`Could not determine action type of ${action}.`)
      }
      first = false
      previousAction = action
    } // for (... this.#interrogationBundle.actions)
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
    if (val === undefined) { // val may be 'false', which is fine
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
    return this.get(parameter) !== undefined || (parameter in this.#initialParameters)
  }

  get interrogationBundle() { return structuredClone(this.#interrogationBundle) }

  #processMapping(mapping) {
    if (mapping.condition === undefined || this.#evalTruth(mapping.condition)) {
      mapping.maps.forEach((map) => {
        // having both source and value is not allowed and verified when the IB is loaded
        if (map.source !== undefined) {
          const evaluator = new Evaluator({ parameters : this.#evalParams() })
          let value
          if (map.paramType === undefined || map.paramType === 'string') {
            throw createError.BadRequest(`Cannot map parameter '${map.parameter}' of type 'string' to a 'source' value. Must boolean or some numeric type.`)
          }
          else if (map.paramType.match(/bool(?:ean)?/i)) {
            value = evaluator.evalTruth(map.source)
          }
          else { // it's numeric
            value = evaluator.evalNumber(map.source)
            value = transformStringValue({ paramType : map.paramType, value })
          }

          verifyMappingValue({ map, value })
          this.#addResult({ source : map, value })
        }
        else if (map.value !== undefined) {
          const value = transformStringValue(map)
          verifyMappingValue({ map, value })
          this.#addResult({ source : map, value })
        }
        else { // this should already be verified up front, but for the sake of comopletness
          throw new Error(`Mapping for '${map.parameter}' must specify either 'source' or 'value'.`)
        }
      })
    }
  }

  async #processReview(reviewAction) {
    const reviewType = reviewAction.review
    const included = []
    for (const action of this.#interrogationBundle.actions) {
      if (action === reviewAction) {
        break
      }
      else if (action.review !== undefined) {
        included.slice(0, included.length) // truncate
        continue
      }
      const result = this.#getResultByIndex(action._index)
      const include = action.statement === undefined
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

    const header = `<h2>Review ${included.length} ${reviewType === 'all' ? 'values' : 'answers'}:<rst>`

    this.#output.write(header + '\n' + reviewText, { hangingIndent : 2 })

    while (true) {
      const rl = readline.createInterface({ input : this.#input, output : this.#output, terminal : false })
      try {
        this.#output.write('\n<bold>Verified?<rst> [y/n] ')
        // rl.setPrompt(formatTerminalText('\n<bold>Verified?<rst> [y/n] '))
        // rl.prompt()

        const it = rl[Symbol.asyncIterator]()
        const answer = (await it.next()).value.trim()
        const result = verifyAnswerForm({ type : 'boolean', value : answer })
        if (result === true) {
          return [transformStringValue({ paramType : 'boolean', value : answer }), included]
        }
        else {
          this.#output.write(`<warn>${result}<rst>` + '\n')
        }
      }
      finally { rl.close() }
    }
  }

  async question() {
    if (this.#interrogationBundle === undefined) {
      throw createError.BadRequest("Must set 'interrogation bundle' prior to invoking the questioning.")
    }

    await this.#processActions()
  }

  get results() { return structuredClone(this.#results) }

  get values() {
    return this.#results.reduce((acc, { parameter, value }) => { acc[parameter] = value; return acc }, {})
  }

  #verifyInterrogationBundle() {
    const verifyMapping = ({ maps }) => {
      for (const { parameter, source, value } of maps) {
        if (parameter === undefined) {
          throw createError.BadRequest("One of the mappings lacks a 'parameter' parameter.")
        }
        if (source === undefined && value === undefined) {
          throw createError.BadRequest(`Mapping for '${parameter}' must specify one of 'source' or 'value'.`)
        }
      }
    }

    const ib = this.#interrogationBundle

    ib.actions.forEach((action, i) => {
      if (action.prompt === undefined
          && action.maps === undefined
          && action.statement === undefined
          && action.review === undefined) {
        throw createError.BadRequest('Action defines neither \'prompt\', \'maps\', \'statement\', nor \'review\'; cannot determine type.')
      }
      else if (action.prompt !== undefined) {
        // TODO: replace with some kind of JSON schema verification
        if (action.parameter === undefined) {
          throw createError.BadRequest(`Question ${i + 1} does not define a 'parameter'.`)
        }
        if (action.prompt === undefined) {
          throw createError.BadRequest(`Question ${i + 1} does not define a 'prompt'.`)
        }
        if (action.paramType !== undefined && !action.paramType.match(/bool(?:ean)?|int(?:eger)?|float|numeric|string/)) {
          throw createError.BadRequest(`Found unknown parameter type '${action.paramType}' in interrogation bundle question ${i + 1}.`)
        }
      }
      else if (action.maps !== undefined) {
        verifyMapping(action)
      }
      else if (action.review !== undefined) {
        if (!['all', 'questions'].includes(action.review)) {
          throw createError.BadRequest(`Unknown review type '${action.review}'; must be 'all' or 'questions'.`)
        }
      }
    })
  }

  #write({ options, text }) {
    if (options === undefined) {
      this.#output.write(text)
    }
    else {
      this.#output.writeWithOptions(options, text)
    }
  }
}

const transformStringValue = ({ paramType, value }) => {
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
    throw createError.BadRequest(`Invalid parameter type '${paramType}' found while processing interrogation bundle.`)
  }

  return value
}

const verifyAnswerForm = ({ type, value }) => {
  if ((/int(?:eger)?/i).test(type)) {
    if (isNaN(value + '') || !(value + '').match(/^-?\d+$/)) {
      return `'${value}' is not a valid integer.`
    }
  }
  else if ((/float|numeric/i).test(type)) {
    if (isNaN(value + '') || !(value + '').match(/^-?\d+(?:\.\d+)?$/)) {
      return `'${value}' is not a valid ${type}.`
    }
  }
  else if ((/bool(?:ean)?/i).test(type)) {
    if (typeof value !== 'boolean'
          && (typeof value === 'string' && !value?.match(/\s*(?:y(?:es)?|n(?:o)?|t(?:rue)?|f(?:alse)?)\s*/i))) {
      return `'${value}' is not a valid boolean. Try yes|no|true|false`
    }
  }
  else if (type !== undefined && type !== 'string') {
    throw new Error(`Cannot verify unknown type: '${type}'`)
  }

  return true // we've passed the gauntlet
}

const verifyMappingValue = ({ map, value }) => {
  if (verifySingleValueRequirements({ op : map, value }) !== true) {
    let msg
    if (map.description) {
      msg = `${map.description} ${value} (mapping error)`
    }
    else {
      msg = `Mapping requirement failed for parameter ${map.parameter}`
    }
    throw createError.BadRequest(msg)
  }
}

const verifyMultiValueRequirements = ({ op, splitAnswers }) => {
  const { requireMaxCount, requireMinCount } = op

  if (requireMaxCount !== undefined) {
    const maxCount = typeof requireMaxCount === 'string' ? parseInt(requireMaxCount) : requireMaxCount
    if (splitAnswers.length > maxCount) {
      return `You must provide no more than ${maxCount} values.`
    }
  }
  if (requireMinCount !== undefined) {
    const minCount = typeof requireMinCount === 'string' ? parseInt(requireMinCount) : requireMinCount
    if (splitAnswers.length < minCount) {
      return `You must provide at least ${minCount} values.`
    }
  }

  return true
}

const verifySingleValueRequirements = ({ op, value }) => {
  const { invalidMessage, parameter, requireSomething, requireTruthy, requireExact, requireMatch } = op
  let { requireOneOf } = op

  if ((requireSomething === true || requireSomething === 'true') && value === undefined) {
    return `Parameter '${parameter}' must have a defined value.`
  }
  else if ((requireTruthy === true || requireTruthy === 'true') && !value) {
    return `Parameter '${parameter}' has value '${value}'; must have a "truth-y" value.`
  }
  else if (requireExact !== undefined && (requireExact + '') !== (value + '')) {
    return `Parameter '${parameter}' has value '${value}'; value must be '${requireExact}'.`
  }
  else if (requireOneOf !== undefined) {
    if ((typeof requireOneOf) === 'string') {
      requireOneOf = requireOneOf.split(/\s*,\s*/)
    }
    if (!Array.isArray(requireOneOf)) {
      throw createError.BadRequest(`Parameter '${parameter}' 'requireOneOf' is malformed; must be an array of values.`)
    }
    if (!requireOneOf.includes(value)) {
      return `Parameter '${parameter}' has value '${value}'; value must be one of '${requireOneOf.join("', ")}'.`
    }
  }
  else if (requireMatch !== undefined && value !== undefined) {
    if (!value.match) {
      throw createError.BadRequest(`Parameter '${parameter}' 'requireMatch' must be applied to a string.`)
    }

    let regex
    try { regex = typeof requireMatch === 'string' ? new RegExp(requireMatch) : requireMatch }
    catch { // there's only one reason to throw, right?
      throw createError.BadRequest(`Parameter '${parameter}' 'requireMatch' is not a valid regular expression.`)
    }
    if (!value.match(regex)) {
      return invalidMessage || `Parameter '${parameter}' has value '${value}'; value must match:\n${requireMatch}'.`
    }
  }

  return true
}

export { Questioner, ANSWERED, CONDITION_SKIPPED, DEFINED_SKIPPED }
