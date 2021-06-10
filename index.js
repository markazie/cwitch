#!/usr/bin/env node

"use strict";

import { access, F_OK, readFileSync } from 'fs';
import dotenv from 'dotenv';
import { getAuthDetails, showMenu, envPath, tsconfigPath, printHelp, log, setConfig, cwitchconfigPath } from './helper.js'

dotenv.config();

access(cwitchconfigPath, F_OK, async (err) => {
    if (err) return console.error('can not find cwitchconfig.json file')

    const config = readFileSync(cwitchconfigPath, 'utf-8')
    setConfig({ data: JSON.parse(config) })

    access(envPath, F_OK, async (err) => {
        if (err) return console.error('can not find .env file')

        access(tsconfigPath, F_OK, (err) => {
            if (err) return console.error('can not find tsconfig file')

            const { argv } = process

            if (argv.length > 2) {
                const accIndex = argv.indexOf('-a')
                const switchIndex = argv.indexOf('-s')
                const helpIndex = argv.indexOf('-h')

                if (helpIndex > -1) printHelp()
                else if (accIndex > -1) getAuthDetails({ accountType: argv[accIndex + 1], option: '-a' })
                else if (switchIndex > -1) getAuthDetails({ accountType: argv[switchIndex + 1], option: '-s', shoudCompile: false })
                else log({ message: 'you have provided and invalid option.' })

            } else showMenu();
        })
    })
})
