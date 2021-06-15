"use strict";
import { access, F_OK, readFile, writeFile, readdirSync } from 'fs';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { setAuthConfig, uploadFileToNetSuite } from './uploadHelper.js';

const dirName = dirname(fileURLToPath(import.meta.url))
const currentWD = process.cwd()
const envPath = join(dirName, '../../.env');
const vscodeSettingsPath = join(dirName, '../../.vscode/settings.json');
const cwitchconfigPath = join(dirName, '../../cwitchconfig.json');
const ALLOWED_EXTENSIONS = ['.js', '.html']
const JUST_SWITCH_ACC = 'Just Switch Account'

let tsconfigPath = '';
let choiceMap = null;


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

const getAuthDetails = ({ accountType, option = '-a', dirPaths = [] }) => {
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
            const restlet = process.env[`${key}RESTLET`]
            const nsKey = process.env[`${key}NETSUITE_KEY`]
            const nsSecret = process.env[`${key}NETSUITE_SECRET`]
            const consumerToken = process.env[`${key}CONSUMER_TOKEN`]
            const consumerSecret = process.env[`${key}CONSUMER_SECRET`]

            setAuthConfig({ nsKey, nsSecret, consumerToken, consumerSecret, realm, restlet })

            compileAndModifySettings({ restlet, nsKey, nsSecret, consumerSecret, consumerToken, realm, shoudCompile: option === '-a', dirPaths })
        } else {
            log({ message: `you have provided an invalid value "${accountType}" for option ${option}` })
        }
    } else log({ message: `you have used option ${option} without any value` })
}

const compileAndModifySettings = ({ restlet, nsKey, nsSecret, consumerToken, consumerSecret, realm, shoudCompile, dirPaths }) => {
    access(vscodeSettingsPath, F_OK, (err) => {
        if (err) return console.error('can not find vscode settings file')

        shoudCompile && compileTS({ dirPaths })

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

                if (!shoudCompile && dirPaths[0]) uploadDirectory({ dirPaths })
            });
        });
    })
}

const compileTS = ({ dirPaths = [] }) => {
    execSync(`tsc -p ${tsconfigPath}`, (err) => {
        if (err) rej(err);
    });

    if (dirPaths[0]) uploadDirectory({ dirPaths })
}

const uploadDirectory = async ({ dirPaths }) => {

    const files = []

    dirPaths.forEach((path) => {
        readdirSync(path).forEach(fileName => {
            const fileEXT = extname(fileName);
            if (ALLOWED_EXTENSIONS.indexOf(fileEXT) > -1) {
                const filePath = join(path, fileName);
                files.push(filePath)
            }
        });
    })

    for (const file of files) {
        try {
            const res = await uploadFileToNetSuite(file);
            console.log(res);
        } catch (err) { }
    }
}

const printHelp = () => {
    console.log('Options:')
    console.log('-h\t\t\t\tPrint help message.')
    console.log('-a ACCOUNT NAME\t\t\tCompile ts files to js and set auth for the given account: p, a, s, r or production, admin tech, staging, release preview')
    console.log('-s ACCOUNT NAME\t\t\tSet auth for the given account: p, a, s, r or production, admin tech, staging, release preview')
    console.log('-u DIRECTORY PATH\t\tUpload valid files indise the given directories: you can separate relative directory paths by space')
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

export { showMenu, getAuthDetails, printHelp, log, setConfig, dirName, currentWD, envPath, tsconfigPath, cwitchconfigPath }