import { Questioner } from '../questioner'
import { simpleIB } from './test-data'

const [,, requirement, reqValue] = process.argv

const ib = simpleIB
ib.actions[0].multiValue = true
ib.actions[0].paramType = 'string'
ib.actions[0][requirement] = reqValue

const questioner = new Questioner({ interrogationBundle : ib })

questioner.question()
