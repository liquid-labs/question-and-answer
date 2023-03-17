const WHATS_YOUR_FAVORITE_INT = "What's your favorite int?"
const simpleIntQuestionIB = {
  questions : [
    { prompt : WHATS_YOUR_FAVORITE_INT, parameter : 'IS_CLIENT', paramType : 'int' }
  ]
}

const IS_THE_COMPANY_THE_CLIENT = 'Is the Company the client? (y=client/n=contractor)'
const simpleIB = {
  questions : [
    { prompt : IS_THE_COMPANY_THE_CLIENT, parameter : 'IS_CLIENT', paramType : 'bool' }
  ]
}

const commonMapping = [
  {
    condition : 'IS_CLIENT',
    maps      : [
      { parameter : 'ORG_COMMON_NAME', value : 'us' }
    ]
  },
  {
    condition : '!IS_CLIENT',
    maps      : [
      { parameter : 'ORG_COMMON_NAME', value : 'them' }
    ]
  }
]

const simpleMapIB = structuredClone(simpleIB)
simpleMapIB.mappings = structuredClone(commonMapping)

const simpleLocalMapIB = structuredClone(simpleIB)
simpleLocalMapIB.questions[0].mappings = structuredClone(commonMapping)

const cookieParameterIB = structuredClone(simpleIB)
cookieParameterIB.mappings = structuredClone(commonMapping)
cookieParameterIB.questions[0].mappings = structuredClone(commonMapping)
cookieParameterIB.mappings[0].maps[0].parameter = 'TARGET_DEMO'
cookieParameterIB.mappings[1].maps[0].parameter = 'TARGET_DEMO'
cookieParameterIB.questions[0].handling = 'bundle'
cookieParameterIB.mappings[0].maps[0].handling = 'bundle'
cookieParameterIB.questions[0].mappings[0].maps[0].handling = 'bundle'

const DO_YOU_LIKE_MILK = 'Do you like milk?'
const IS_THIS_THE_END = 'Is this the end?'
const conditionalQuestionIB = structuredClone(simpleIB)
conditionalQuestionIB.questions.push({ condition : 'IS_CLIENT', prompt : DO_YOU_LIKE_MILK, parameter : 'LIKES_MILK' })
conditionalQuestionIB.questions.push({ prompt : IS_THIS_THE_END, parameter : 'IS_END' })

const badParameterIB = {
  questions : [
    { parameter : 'FOO', prompt : 'foo?', paramType : 'invalid' }
  ]
}

const noQuestionParameterIB = {
  questions : [
    { prompt : 'hey' }
  ]
}

const noQuestionPromptIB = {
  questions : [
    { parameter : 'FOO' }
  ]
}

export {
  WHATS_YOUR_FAVORITE_INT,
  IS_THE_COMPANY_THE_CLIENT,
  DO_YOU_LIKE_MILK,
  IS_THIS_THE_END,
  cookieParameterIB,
  simpleIntQuestionIB,
  simpleIB,
  simpleMapIB,
  simpleLocalMapIB,
  conditionalQuestionIB,
  badParameterIB,
  noQuestionParameterIB,
  noQuestionPromptIB
}
