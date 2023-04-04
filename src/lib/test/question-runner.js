import { Questioner } from '../questioner'
import * as testData from './test-data'

const questioner = new Questioner({ interrogationBundle : testData[process.argv[2]] })

questioner.question()
