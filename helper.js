"use strict";
import { access, F_OK, readFile, writeFile } from 'fs';
import inquirer from 'inquirer';
import { exec } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const DIR_NAME = dirname(fileURLToPath(import.meta.url))
const envPath = join(DIR_NAME, '../../.env');
const vscodeSettingsPath = join(DIR_NAME, '../../.vscode/settings.json');
const cwitchconfigPath = join(DIR_NAME, '../../cwitchconfig.json');

let tsconfigPath = '';
let choiceMap = null;

const JUST_SWITCH_ACC = 'Just Switch Account'

const showMenu = async () => {
    try {
        const { account } = await inquirer.prompt([
            {
                type: 'list',
                message: 'Please select an option:',
                name: 'account',
                choices: [...Object.keys(choiceMap), JUST_SWITCH_ACC]
            }
        ])

        if (account !== JUST_SWITCH_ACC) getAuthDetails({ accountType: account })
        else {
            const { switchAccount } = await inquirer.prompt([
                {
                    type: 'list',
                    message: 'Please select the account:',
                    name: 'switchAccount',
                    choices: Object.keys(choiceMap)
                }
            ])

            getAuthDetails({ accountType: switchAccount, option: '-s' })
        }
    } catch (error) {
        if (error.isTtyError) {
            console.error(`Prompt couldn't be rendered in the current environment`)
        } else {
            console.error('Something went wrong please try again.\n', error)
        }
    }
}

const getAuthDetails = ({ accountType, option = '-a' }) => {
    if (accountType) {
        const firstChar = accountType.toLowerCase().charAt(0)

        let key = ''

        switch (firstChar) {
            case 'p':
                key = choiceMap['Production']
                break
            case 's':
                key = choiceMap['Staging']
                break
            case 'a':
                key = choiceMap['Admin Tech']
                break
            case 'r':
                key = choiceMap['Release Preview']
                break
        }

        if (key) {
            const realm = process.env[`${key}REALM`]
            const subdomain = realm.toLowerCase().split('_').join('-')
            const restlet = `https://${subdomain}.${process.env['URL']}`
            const nsKey = process.env[`${key}NETSUITE_KEY`]
            const nsSecret = process.env[`${key}NETSUITE_SECRET`]
            const consumerToken = process.env[`${key}CONSUMER_TOKEN`]
            const consumerSecret = process.env[`${key}CONSUMER_SECRET`]

            compileAndModifySettings({ restlet, nsKey, nsSecret, consumerSecret, consumerToken, realm, shoudCompile: option === '-a' })
        } else {
            log({ message: `you have provided an invalid value "${accountType}" for option ${option}` })
        }
    } else log({ message: `you have used option ${option} without any value` })
}

const compileAndModifySettings = ({ restlet, nsKey, nsSecret, consumerToken, consumerSecret, realm, shoudCompile }) => {
    access(vscodeSettingsPath, F_OK, (err) => {
        if (err) return console.error('can not find vscode settings file')

        shoudCompile && compileTS()

        readFile(vscodeSettingsPath, 'utf8', function (err, data) {
            if (err) throw err;
            const vscodeSettings = JSON.parse(data);

            vscodeSettings["netSuiteUpload.restlet"] = restlet;
            vscodeSettings["netSuiteUpload.netSuiteKey"] = nsKey;
            vscodeSettings["netSuiteUpload.netSuiteSecret"] = nsSecret;
            vscodeSettings["netSuiteUpload.consumerToken"] = consumerToken;
            vscodeSettings["netSuiteUpload.consumerSecret"] = consumerSecret;
            vscodeSettings["netSuiteUpload.realm"] = realm;

            writeFile(vscodeSettingsPath, JSON.stringify(vscodeSettings, null, 4), function (err) {
                if (err) throw err;
            });
        });
    })
}

const compileTS = () => {
    exec(`tsc -p ${tsconfigPath}`, (err) => {
        if (err) throw err;
    });
}

const printHelp = () => {
    console.log('Options:')
    console.log('-h\t\t\t\tPrint help message.')
    console.log('-a ACCOUNT NAME\t\t\tCompile ts files to js and set auth for the given account: p, a, s, r or production, admin tech, staging, release preview')
    console.log('-s ACCOUNT NAME\t\t\tSet auth for the given account: p, a, s, r or production, admin tech, staging, release preview')
}

const log = ({ message, showHelp = true }) => {
    console.log(message + '\n')
    showHelp && printHelp()
}

const setConfig = ({ data }) => {
    const { tsconfig, accounts } = data
    tsconfigPath = join(cwitchconfigPath, '../', tsconfig)
    choiceMap = accounts
}

export { showMenu, getAuthDetails, printHelp, log, setConfig, envPath, tsconfigPath, cwitchconfigPath }