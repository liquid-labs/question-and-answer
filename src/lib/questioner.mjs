/**
 * Exports `Questioner` object used to interogate the user and generate results based on answers and data mappings.
 *
 * ## When are questions asked?
 *
 * A question may have a `condition` attached to it. When the condition, the question (and any question-local mappngs)
 * are skipped entirely. By default, the question is skipped for the user if the `parameter` already has a value or is
 * "[positively blank](#positively-blank)", though in this case the question-local mappings are executed (so long as
 * the condition passes).
 *
 * ## Positively blank
 *
 * An answer or value of '-' is interpretted to mean 'nullify (or blank) the value. This allows the user to un-set an
 * answer, as when the value is already set and the answer has a default. In that case, just hitting return would
 * result in the value staying as the default. To un-set the value, the user would answer '-'.
 *
 * Note that a blank answer with no default is also blank. You can, but don't have to use the '-'.
 *
 * <details>
 * <summary>Developer notes</summary>
 *
 * ## Developer notes
 *
 * We're not strictly enforcing parameter types in-so-far as user suppelied `values` our `source` results (including
 * `elseValue` and `elseSource`) are essentialy "trusted" to be of the proper type, but we should check and coerce
 * string results (from the valuess). Also, why not have `evalString` as an option from condition eval? E.g., `'' ||
 * 'Larry'` is a valid expression. (If we do this, it might make sense to separate out the 'safe expression' testing
 * to be distinct based on the type of item; e.g., '+' and '||' are valid with strings, but '%' is just non-sensical.)
 *
 * </detials>
 */
import * as readline from 'node:readline'

import columns from 'cli-columns'
import createError from 'http-errors'

import { Evaluator } from '@liquid-labs/condition-eval'
import { formatTerminalText } from '@liquid-labs/terminal-text'
import { wrap } from '@liquid-labs/wrap-text'

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
  #width
  #wrap

  constructor({
    input = process.stdin,
    output = process.stdout,
    interrogationBundle,
    initialParameters = {},
    noSkipDefined = false,
    width // leave undefined and take the 'wrap' default width if none provided
  } = {}) {
    this.#input = input
    this.#output = output
    this.#interrogationBundle = structuredClone(interrogationBundle)
    this.#initialParameters = initialParameters
    this.#noSkipDefined = noSkipDefined
    this.#width = width
    this.#wrap = (text, options) => wrap(text, Object.assign({ width : this.#width, ignoreTags : true }, options))

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
    const rl = readline.createInterface({ input : this.#input, output : this.#output, terminal : false })

    try {
      const type = q.paramType || 'string'
      let defaultValue = this.get(q.parameter) || q.default
      if (!verifyAnswerForm({ type, value : defaultValue })) {
        defaultValue = undefined
      }

      let prompt = q.prompt
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
        prompt = this.#wrap(prompt) + '\n' + hint
      }
      else {
        prompt = this.#wrap(prompt) + '\n\n'
        const cliOptions = q.options.map((o, i) => (i + 1) + ') ' + o)
        prompt += columns(cliOptions, { width : this.width }) + '\n'
        if (defaultValue !== undefined) {
          const defaultI = q.options.indexOf(defaultValue)
          if (defaultI === -1) {
            delete q.default
          }
          else {
            prompt += '[' + (defaultI + 1) + '] '
          }
        }
      }

      rl.setPrompt(formatTerminalText(prompt))
      rl.prompt()

      const it = rl[Symbol.asyncIterator]()
      let verifyResult, value
      if (q.options === undefined) {
        let answer = (await it.next()).value.trim() || defaultValue || ''
        if (answer === '-') {
          answer = undefined
          delete q.default
        }
        else if (answer === '') {
          answer = defaultValue
        }
        else {
          q.default = answer
        }

        // first verify form as a string
        verifyResult = verifyAnswerForm({ type, value : answer })
        if (verifyResult === true) {
          q.rawAnswer = answer
          value = transformStringValue({ paramType : type, value : answer })
          verifyResult = verifyRequirements({ op : q, value })
        }
      }
      else { // it's an option question
        const selectionS = (await it.next()).value
        const selectionI = parseInt(selectionS)
        if (isNaN(selectionI) || selectionI < 1 || selectionI > q.options.length) {
          verifyResult = `Please enter a number 1-${q.options.length}.`
        }
        else {
          verifyResult = true
          value = q.options[selectionI - 1]
        }
      }

      if (verifyResult === true) {
        q.disposition = ANSWERED
        this.#addResult({ source : q, value })
      }
      else { // the 'answer form' is invalid; let's try again
        verifyResult = '<warn>' + verifyResult + '<rst>'
        verifyResult = this.#wrap(verifyResult) + '\n'
        this.#output.write(formatTerminalText(verifyResult))
        rl.close() // we'll create a new one
        this.#output.write('\n')
        await this.#askQuestion(q)
      }
    } // try for rl
    finally { rl.close() }
  }

  async #processActions() {
    let first = true
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
        this.#addResult({ source : action, value : this.get(action.parameter) })
        continue
      }

      if (first === false) {
        this.#output.write('\n')
      }
      if (action.prompt !== undefined) { // it's a question
        await this.#askQuestion(action)
      }
      else if (action.maps !== undefined) { // it's a mapping
        this.#processMapping(action)
      }
      else if (action.statement !== undefined) { // it's a statement
        this.#output.write(formatTerminalText(this.#wrap(action.statement) + '\n'))
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
          console.log('filtered results:', this.#results, '\ntoNix:', toNix) // DEBUG
          await this.#processActions()
          break
        }
      }
      else {
        throw createError.BadRequest(`Could not determine action type of ${action}.`)
      }
      first = false
    }
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
        && !result.disposition.endsWith('skipped')

      if (include) {
        included.push(action)
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

    this.#output.write(formatTerminalText(this.#wrap(header + '\n' + reviewText, { hangingIndent : 2 })))

    while (true) {
      const rl = readline.createInterface({ input : this.#input, output : this.#output, terminal : false })
      try {
        rl.setPrompt(formatTerminalText('\n<bold>Verified?<rst> [y/n] '))
        rl.prompt()

        const it = rl[Symbol.asyncIterator]()
        const answer = (await it.next()).value.trim()
        const result = verifyAnswerForm({ type : 'boolean', value : answer })
        if (result === true) {
          return [transformStringValue({ paramType : 'boolean', value : answer }), included]
        }
        else {
          this.#output.write(formatTerminalText(this.#wrap(`<warn>${result}<rst>`) + '\n'))
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
          console.log('what')
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
    if (isNaN(value) || !value.match(/^\d+$/)) {
      return `'${value}' is not a valid integer.`
    }
  }
  else if ((/float|numeric/i).test(type)) {
    if (isNaN(value) || !value.match(/^-?\d+(?:\.\d+)?$/)) {
      return `'${value}' is not a valid ${type}.`
    }
  }
  else if ((/bool(?:ean)?/i).test(type)) {
    if (!value?.match(/\s*(?:y(?:es)?|n(?:o)?|t(?:rue)?|f(?:alse)?)\s*/i)) {
      return `'${value}' is not a valid boolean. Try yes|no|true|false`
    }
  }
  else if (type !== undefined && type !== 'string') {
    throw new Error(`Cannot verify unknown type: '${type}'`)
  }

  return true // we've passed the gauntlet
}

const verifyMappingValue = ({ map, value }) => {
  if (verifyRequirements({ op : map, value }) !== true) {
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

const verifyRequirements = ({ op, value }) => {
  const { parameter, requireSomething, requireTruthy, requireExact, requireMatch } = op
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
  else if (requireMatch !== undefined) {
    if (!value.match) {
      throw createError.BadRequest(`Parameter '${parameter}' 'requireMatch' must be applied a string.`)
    }

    let regex
    try { regex = new RegExp(requireMatch) }
    catch { // there's only one reason to throw, right?
      throw createError.BadRequest(`Parameter '${parameter}' 'requireMatch' is not a valid regular expression.`)
    }

    if (!value.match(regex)) {
      return `Parameter '${parameter}' has value '${value}'; value must match /${requireMatch}/'.`
    }
  }

  return true
}

export { Questioner, ANSWERED, CONDITION_SKIPPED, DEFINED_SKIPPED }
