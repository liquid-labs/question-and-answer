const WHATS_YOUR_FAVORITE_INT = "What's your favorite int?"
const simpleIntQuestionIB = [
    { prompt : WHATS_YOUR_FAVORITE_INT, parameter : 'FAVE_INT', type : 'int' },
  ]

const IS_THE_COMPANY_THE_CLIENT =
  'Is the Company the client? [y=client/n=contractor]'
const simpleIB = [
  { prompt : IS_THE_COMPANY_THE_CLIENT, parameter : 'IS_CLIENT', type : 'bool' },
]

const commonMapping = [
  {
    condition : 'IS_CLIENT',
    maps      : [{ parameter : 'ORG_COMMON_NAME', value : 'us' }],
  },
  {
    condition : '!IS_CLIENT',
    maps      : [{ parameter : 'ORG_COMMON_NAME', value : 'them' }],
  },
]

const simpleMapIB = structuredClone(simpleIB)
simpleMapIB.push(...structuredClone(commonMapping))

const sourceMappingIB = structuredClone(simpleIntQuestionIB)
sourceMappingIB.push(
  ...[
    // we would do this as a question, but to get more than one input line, we
    // have to do the spawn process trick, but we want to keeep this in-process so we can check the values
    {
      maps : [{ parameter : 'HATED_INT', source : '0 - FAVE_INT', type : 'int' }],
    },
    {
      maps : [
        { parameter : 'FAVE_DIFF', source : 'FAVE_INT - HATED_INT', type : 'int' },
        { parameter : 'IS_FAVE_NOT_ZERO', source : 'FAVE_INT', type : 'bool' },
      ],
    },
  ]
)

const cookieParameterIB = structuredClone(simpleIB)
cookieParameterIB.push(...structuredClone(commonMapping))
cookieParameterIB[0].handling = 'bundle'
cookieParameterIB[1].maps[0].handling = 'bundle'
cookieParameterIB[2].maps[0].handling = 'bundle'

const doubleQuestionIB = structuredClone(simpleIB)
doubleQuestionIB.push({
  prompt    : 'Really?',
  parameter : 'IS_CLIENT',
  type      : 'bool',
})
doubleQuestionIB.push({
  prompt    : 'Done?',
  parameter : 'DONE',
  type      : 'bool',
})

const DO_YOU_LIKE_MILK = 'Do you like milk?'
const IS_THIS_THE_END = 'Is this the end?'
const conditionalQuestionIB = structuredClone(simpleIB)
conditionalQuestionIB.push({
  condition : 'IS_CLIENT',
  prompt    : DO_YOU_LIKE_MILK,
  parameter : 'LIKES_MILK',
})
conditionalQuestionIB.push({
  prompt    : IS_THIS_THE_END,
  parameter : 'IS_END',
})

const badParameterIB = [{ parameter : 'FOO', prompt : 'foo?', type : 'invalid' }]

const noQuestionParameterIB = [{ prompt : 'hey' }]

const statementIB = [{ statement : 'Hi!' }]

const conditionStatementIB = [{ statement : 'Hi!', condition : 'false' }, { statement : 'Bye!' }]

export {
  WHATS_YOUR_FAVORITE_INT,
  IS_THE_COMPANY_THE_CLIENT,
  DO_YOU_LIKE_MILK,
  IS_THIS_THE_END,
  badParameterIB,
  conditionalQuestionIB,
  conditionStatementIB,
  cookieParameterIB,
  doubleQuestionIB,
  noQuestionParameterIB,
  simpleIntQuestionIB,
  simpleIB,
  simpleMapIB,
  sourceMappingIB,
  statementIB
}
