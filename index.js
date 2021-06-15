#!/usr/bin/env node

"use strict";

import { access, F_OK, readFileSync, existsSync, lstatSync } from 'fs';
import { join } from 'path';
import { getAuthDetails, showMenu, printHelp, log, setConfig, envPath, tsconfigPath, cwitchconfigPath, currentWD } from './helper.js'
import dotenv from 'dotenv';

dotenv.config({ path: envPath });

access(cwitchconfigPath, F_OK, async (err) => {
    if (err) return console.error('can not find cwitchconfig.json file')

    const config = readFileSync(cwitchconfigPath, 'utf-8')
    setConfig({ data: JSON.parse(config) })

    access(envPath, F_OK, async (err) => {
        if (err) return console.error('can not find .env file')

        if (tsconfigPath) {
            access(tsconfigPath, F_OK, (err) => {
                if (err) return console.error('can not find tsconfig file')

                handleRequest();
            })
        } else {
            handleRequest(false);
        }
    })
})

const handleRequest = (canCompile = true) => {
    const args = process.argv.slice(2)

    if (args.length > 0) {
        const accIndex = args.indexOf('-a')
        const switchIndex = args.indexOf('-s')
        const helpIndex = args.indexOf('-h')
        const uploadIndex = args.indexOf('-u')
        const dirPaths = []

        if (uploadIndex > -1) {
            const pathList = args.slice(uploadIndex + 1)
            pathList.forEach(path => {
                const relativePath = join(currentWD, path)
                if (existsSync(relativePath) && lstatSync(relativePath).isDirectory()) dirPaths.push(relativePath)
            })
        }

        if (helpIndex > -1) printHelp()
        else if (accIndex > -1) {
            canCompile
                ? getAuthDetails({ accountType: args[accIndex + 1], option: '-a', dirPaths })
                : console.log(`you can not use option "-a" without adding tsconnfig path to the cwitchconfig.json file.`);
        }
        else if (switchIndex > -1) {
            getAuthDetails({ accountType: args[switchIndex + 1], option: '-s', dirPaths })
        }
        else if (!dirPaths[0]) log({ message: 'you have provided and invalid option.' })

    } else showMenu();
}
