import { dirName } from './helper.js';
import { URL } from 'url';
import { readFileSync } from 'fs';
import { basename, join } from 'path';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';
import superagent from 'superagent';

let authHeader = null;
let restletURL = null;

function getSuiteScriptPath(filePath) {
    const rootPath = join(dirName, '../../')
    return join('SuiteScripts', filePath.slice(rootPath.length));
}

function uploadFileToNetSuite(filePath) {
    return new Promise((resolve, reject) => {
        const fileContent = readFileSync(filePath, 'utf8');

        postFile(filePath, fileContent, function (err, res) {
            if (err) reject(hasNetSuiteError('ERROR uploading file.', err, res));

            const fileName = basename(filePath);
            resolve('SUCCESS! File "' + fileName + '" uploaded.')
        });
    })
}

function postFile(filePath, content, callback) {
    postData('file', filePath, content, callback);

}

function postData(type, filePath, content, callback) {
    const relativeName = getSuiteScriptPath(filePath);
    const data = {
        type: type,
        name: relativeName,
        content: content
    };
    superagent.post(restletURL)
        .set("Content-Type", "application/json")
        .set("Authorization", authHeader)
        .send(data)
        .end((err, res) => {
            callback(err, res);
        });
}

function setAuthHeader({ nsKey, nsSecret, consumerToken, consumerSecret, realm, restlet }) {
    if (nsKey && nsKey.length > 0) {
        const opts = {
            consumer: {
                key: consumerToken,
                secret: consumerSecret
            },
            signature_method: 'HMAC-SHA256',
            realm,
            hash_function: function (base_string, key) {
                return crypto.createHmac('sha256', key).update(base_string).digest('base64');
            }
        };

        const oauth = OAuth(opts);

        const token = {
            key: nsKey,
            secret: nsSecret
        };
        const url = new URL(restlet);

        // Build up the data payload to sign.
        // qs will contain the script and deploy params.
        const qs = { script: url.searchParams.get('?script'), deploy: url.searchParams.get('deploy') };

        const header = oauth.toHeader(oauth.authorize({
            method: 'POST',
            url: restlet,
            data: qs
        }, token));

        restletURL = restlet;
        authHeader = header.Authorization;
        return true;
    }

    throw "No authentication method found in settings.json (user or workspace settings).";
}

function hasNetSuiteError(custommessage, err, response) {
    if (err) {
        const get = function (obj, key) {
            return key.split('.').reduce(function (o, x) {
                return (typeof o == 'undefined' || o === null) ? o : o[x];
            }, obj);
        };

        let errorDetails = [];
        if (response && get(response, 'status') === 403) { // Forbidden. Bad Auth.
            errorDetails = [
                'AUTHENTICATION FAILED!',
                'HTTP Status: 403',
                'HTTP Error: ' + get(response, 'message'),
                'Local Stack:',
                get(response, 'stack')
            ];
        } else if (err.shortmessage) {
            // We passed in a simple, short message which is all we need to display.
            errorDetails = [err.shortmessage];

        } else if (response && response.body && response.body.error) {
            // The body of the response may contain a JSON object containing a NetSuite-specific
            // message. We'll parse and display that in addition to the HTTP message.
            try {

                const nsErrorObj = JSON.parse(response.body.error.message);

                if (nsErrorObj.name === 'SSS_MISSING_REQD_ARGUMENT') {
                    custommessage += ' NetSuite N/file module does not allow storing an empty file.';
                }

                errorDetails = [
                    'NetSuite Error Details:',
                    get(nsErrorObj, 'type'),
                    get(nsErrorObj, 'name'),
                    get(nsErrorObj, 'message'),
                    get(nsErrorObj, 'code'),
                    'Remote Stack:',
                    get(nsErrorObj, 'stack'),
                    'HTTP Status: ' + get(err, 'status'),
                    'HTTP Error: ' + get(err, 'message'),
                    'Local Stack:',
                    get(err, 'stack')
                ];
            } catch (e) {
                // Response body error does not contain a JSON message.
                errorDetails = [
                    'NetSuite Error Details:',
                    'NS Error: ' + get(response.body.error, 'code'),
                    'NS Message: ' + get(response.body.error, 'message'),
                    'HTTP Status: ' + get(err, 'status'),
                    'HTTP Error: ' + get(err, 'message'),
                    'Local Stack:',
                    get(err, 'stack')
                ];
            }
        } else {
            errorDetails = [
                'Unknown Error:',
                'HTTP Status: ' + get(err, 'status'),
                'HTTP Error: ' + get(err, 'message'),
                'Local Stack:',
                get(err, 'stack')
            ];
        }

        // Pre-pend the custommessage and our own message.
        errorDetails.unshift(custommessage);
        errorDetails.push('Use Help…Toggle Developer Tools and choose the Console tab for a better formatted error message.');
        console.log(errorDetails.join('\n'));

        return true;
    }
    return false;
}

export { uploadFileToNetSuite, setAuthHeader }