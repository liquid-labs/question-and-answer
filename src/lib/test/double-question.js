import { Questioner } from '../questioner'
import { doubleQuestionIB } from './test-data'

const questioner = new Questioner()
questioner.interogationBundle = conditionalQuestionIB

questioner.question()
