const IS_THE_COMPANY_THE_CLIENT = "Is the Company the client? (y=client/n=contractor)"
const simpleIB = {
  questions: [
    { prompt: IS_THE_COMPANY_THE_CLIENT, parameter: "IS_CLIENT" }
  ]
}

const commonMapping = [
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

const simpleMapIB = structuredClone(simpleIB)
simpleMapIB.mappings = structuredClone(commonMapping)

const simpleLocalMapIB = structuredClone(simpleIB)
simpleLocalMapIB.questions[0].mappings = structuredClone(commonMapping)

const DO_YOU_LIKE_MILK = "Do you like milk?"
const IS_THIS_THE_END = "Is this the end?"
const conditionalQuestionIB = structuredClone(simpleIB)
conditionalQuestionIB.questions.push({ condition: "IS_CLIENT", prompt: DO_YOU_LIKE_MILK, parameter: "LIKES_MILK" })
conditionalQuestionIB.questions.push({ prompt: IS_THIS_THE_END, parameter: "IS_END" })

export {
  IS_THE_COMPANY_THE_CLIENT,
  DO_YOU_LIKE_MILK,
  IS_THIS_THE_END,
  simpleIB,
  simpleMapIB,
  simpleLocalMapIB,
  conditionalQuestionIB
}