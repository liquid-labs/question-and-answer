import { Questioner } from '../questioner'
import { simpleIntQuestionIB } from './test-data'

const questioner = new Questioner({ interrogationBundle : simpleIntQuestionIB })

questioner.question()
