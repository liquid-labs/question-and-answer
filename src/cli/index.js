import * as fs from 'node:fs/promises'

import { Questioner } from '../lib/questioner'

const filePath = process.argv[2]
const envFile = process.argv[3];
(async () => {
  const interactions = JSON.parse(
    await fs.readFile(filePath, { encoding : 'utf8' })
  )
  const initialParameters =
    envFile === undefined
      ? {}
      : JSON.parse(await fs.readFile(envFile, { encoding : 'utf8' }))

  const questioner = new Questioner({ initialParameters, interactions })
  await questioner.question()

  console.log(
    '\n'
      + JSON.stringify(questioner.values, null, '  ')
      + '\n'
      + JSON.stringify(questioner.results, null, '  ')
  )
})()
