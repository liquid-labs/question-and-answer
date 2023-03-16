import * as fs from 'node:fs/promises'

import { Questioner } from '../lib/questioner'

const filePath = process.argv[2];

(async () => {
  const ib = JSON.parse(await fs.readFile(filePath, { encoding: 'utf8' }))

  const questioner = new Questioner()
  questioner.interogationBundle = ib
  await questioner.question()

  console.log(questioner.values)
})()
