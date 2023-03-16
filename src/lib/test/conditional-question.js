import { Questioner } from '../questioner'
import { conditionalQuestionIB } from './test-data'

const questioner = new Questioner()
questioner.interogationBundle = conditionalQuestionIB

questioner.question()
