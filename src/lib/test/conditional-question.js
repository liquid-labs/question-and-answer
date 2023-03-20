import { Questioner } from '../questioner'
import { conditionalQuestionIB } from './test-data'

const questioner = new Questioner({ interrogationBundle : conditionalQuestionIB })

questioner.question()
