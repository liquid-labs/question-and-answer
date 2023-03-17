import { Questioner } from '../questioner'
import { simpleIntQuestionIB } from './test-data'

const questioner = new Questioner()
questioner.interogationBundle = simpleIntQuestionIB

questioner.question()
