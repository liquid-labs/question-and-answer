import { Questioner } from '../questioner'
import { simpleIB } from './test-data'

const [,, type, requirement, reqValue] = process.argv

const ib = simpleIB
ib.actions[0].paramType = type
ib.actions[0][requirement] = reqValue

const questioner = new Questioner({ interrogationBundle : ib })

questioner.question()
