import * as fs from 'node:fs/promises'

import { Questioner } from '../lib/questioner'

const filePath = process.argv[2]
const envFile = process.argv[3];

(async () => {
  const ib = JSON.parse(await fs.readFile(filePath, { encoding: 'utf8' }))
  const initialParameters = envFile === undefined
    ? {}
    : JSON.parse(await fs.readFile(envFile, { encoding: 'utf8' }))

  const questioner = new Questioner({ initialParameters })
  questioner.interogationBundle = ib
  await questioner.question()

  console.log(questioner.values)
})()
