import { Questioner } from '../questioner'
import { conditionalQuestionIB, DO_YOU_LIKE_MILK, IS_THIS_THE_END } from './test-data'

const firstAnswer = process.argv[2]

const questioner = new Questioner()
questioner.interogationBundle = conditionalQuestionIB

questioner.question()
