import { Questioner } from '../questioner'
import { doubleQuestionIB } from './test-data'

const questioner = new Questioner()
questioner.interogationBundle = doubleQuestionIB

questioner.question()
