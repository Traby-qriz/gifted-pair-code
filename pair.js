const { giftedid } = require('./id.js');
const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const { Storage } = require("megajs");

const {
    default: Gifted_Tech,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    DisconnectReason
} = require("@whiskeysockets/baileys");

// Create temp directory if it doesn't exist
if (!fs.existsSync('./temp')) {
    fs.mkdirSync('./temp', { recursive: true });
}

// Function to generate a random Mega ID
function randomMegaId(length = 6, numberLength = 4) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    const number = Math.floor(Math.random() * Math.pow(10, numberLength));
    return `${result}${number}`;
}

// Function to upload credentials to Mega
async function uploadCredsToMega(credsPath) {
    try {
        const storage = await new Storage({
            email: 'casperqriz@gmail.com',
            password: 'jm20032000'
        }).ready;
        console.log('Mega storage initialized.');

        if (!fs.existsSync(credsPath)) {
            throw new Error(`File not found: ${credsPath}`);
        }

        const fileSize = fs.statSync(credsPath).size;
        const uploadResult = await storage.upload({
            name: `${randomMegaId()}.json`,
            size: fileSize
        }, fs.createReadStream(credsPath)).complete;

        console.log('Session successfully uploaded to Mega.');
        const fileNode = storage.files[uploadResult.nodeId];
        const megaUrl = await fileNode.link();
        console.log(`Session Url: ${megaUrl}`);
        return megaUrl;
    } catch (error) {
        console.error('Error uploading to Mega:', error);
        throw error;
    }
}

// Function to remove a file
function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

// Router to handle pairing code generation
router.get('/', async (req, res) => {
    const id = giftedid();
    let num = req.query.number;
    let connectionAttempts = 0;
    const MAX_RETRIES = 5;

    async function GIFTED_PAIR_CODE() {
        if (connectionAttempts >= MAX_RETRIES) {
            console.log("Max connection attempts reached");
            removeFile('./temp/' + id);
            if (!res.headersSent) {
                res.status(500).send({ code: "Maximum retry attempts reached" });
            }
            return;
        }

        connectionAttempts++;
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);

        try {
            let Gifted = Gifted_Tech({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
                connectTimeoutMs: 60000,
                retryRequestDelayMs: 5000,
                maxRetries: 5,
                defaultQueryTimeoutMs: 60000
            });

            if (!Gifted.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await Gifted.requestPairingCode(num);
                console.log(`Your Code: ${code}`);

                if (!res.headersSent) {
                    res.send({ code });
                }
            }

            Gifted.ev.on('creds.update', saveCreds);
            
            Gifted.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "close") {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const shouldReconnect = (
                        statusCode !== DisconnectReason.loggedOut &&
                        statusCode !== 401 &&
                        connectionAttempts < MAX_RETRIES
                    );

                    console.log(`Connection closed with status ${statusCode}. Reconnect: ${shouldReconnect}`);

                    if (shouldReconnect) {
                        console.log(`Reconnection attempt ${connectionAttempts + 1}/${MAX_RETRIES}`);
                        await delay(5000 * connectionAttempts); // Exponential backoff
                        await GIFTED_PAIR_CODE();
                    } else {
                        console.log("Connection closed permanently");
                        removeFile('./temp/' + id);
                    }
                } else if (connection === "open") {
                    console.log("Connection opened successfully!");
                    connectionAttempts = 0; // Reset connection attempts on successful connection

                    await delay(5000);
                    const filePath = __dirname + `/temp/${id}/creds.json`;

                    if (!fs.existsSync(filePath)) {
                        console.error("File not found:", filePath);
                        return;
                    }

                    const megaUrl = await uploadCredsToMega(filePath);
                    const sid = megaUrl.includes("https://mega.nz/file/")
                        ? 'CASPER-TECH~' + megaUrl.split("https://mega.nz/file/")[1]
                        : 'Error: Invalid URL';

                    console.log(`Session ID: ${sid}`);

                    const session = await Gifted.sendMessage(Gifted.user.id, { text: sid });

                    const GIFTED_TEXT = `
 *✅𝐬𝐞𝐬𝐬𝐢𝐨𝐧 𝐠𝐞𝐧𝐞𝐫𝐚𝐭𝐞𝐝 𝐩𝐞𝐫𝐟𝐞𝐜𝐭𝐥𝐲✅*
 ______________________________
 ╔════◇
 ║『 𝙲𝙰𝚂𝙿𝙴𝚁-𝚇𝙼𝙳 𝚆𝙰𝚂 𝙰𝙳𝙳𝙴𝙳 𝚃𝙾 𝚈𝙾𝚄𝚁 𝚆𝙷𝙰𝚃𝚂𝙰𝙿𝙿 😉 』
 ║ You've Completed the First Step
 ║ to Deploy a Whatsapp Bot.
 ╚══════════════╝
 ╔═════◇
 ║ 『❣️ ⋆G⋆E⋆T⋆ H⋆E⋆L⋆P⋆ H⋆E⋆R⋆E⋆ ❣️』
 ║❇️𝐘𝐨𝐮𝐭𝐮𝐛𝐞: _youtube.com/@casper.tech.254_
 ║❇️𝐎𝐰𝐧𝐞𝐫: _https://t.me/casper_tech_ke
 ║✳️𝐑𝐞𝐩𝐨: _https://github.com/Traby-qriz/CASPER-XMD
 ║✳️𝐖𝐚𝐂𝐡𝐚𝐧𝐧𝐞𝐥: _https://whatsapp.com/channel/0029VazABxMJZg40sEZBX242/0029VaYauR9ISTkHTj4xvi1l_
 ║✳️𝐖𝐚𝐆𝐫𝐨𝐮𝐩 : _
 ║ 😋💝💝💝💝🤪
 ╚══════════════╝ 
  𝗖𝗔𝗦𝗣𝗘𝗥-𝗫𝗠𝗗 
  > 𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝙲𝙰𝚂𝙿𝙴𝚁 𝚃𝙴𝙲𝙷 𝙺𝙴𝙽𝚈𝙰
 _______________________________

 Use your Session ID Above to Deploy your Bot.
 Check on YouTube Channel for Deployment Procedure(Ensure you have Github Account.)
 Don't Forget To Give Star⭐ To My Repo`;

                    await Gifted.sendMessage(Gifted.user.id, { text: GIFTED_TEXT }, { quoted: session });

                    await delay(100);
                    try {
                        await Gifted.ws.close();
                    } catch (error) {
                        console.log("Error closing connection:", error);
                    }
                    return removeFile('./temp/' + id);
                }
            });
        } catch (err) {
            console.error("Service Error:", err);
            removeFile('./temp/' + id);

            if (!res.headersSent) {
                res.status(500).json({
                    code: "Service is Currently Unavailable",
                    error: err.message
                });
            }
        }
    }

    try {
        await GIFTED_PAIR_CODE();
    } catch (error) {
        console.error("Fatal Error:", error);
        removeFile('./temp/' + id);
        if (!res.headersSent) {
            res.status(500).send({ code: "Service encountered a fatal error" });
        }
    }
});

// Cleanup on process termination
process.on('SIGINT', async () => {
    console.log('Cleaning up...');
    const tempDir = './temp';
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
    process.exit(0);
});

module.exports = router;
