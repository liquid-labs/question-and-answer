import { Questioner } from '../questioner'
import { doubleQuestionIB } from './test-data'

const questioner = new Questioner({ interrogationBundle: doubleQuestionIB })

questioner.question()
