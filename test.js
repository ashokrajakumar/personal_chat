const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  await page.goto('http://localhost:3000');
  
  await page.waitForSelector('#username-input');
  await page.type('#username-input', 'ashok');
  console.log('Typed username.');
  
  await page.click('#join-btn');
  console.log('Clicked join button.');
  
  await new Promise(r => setTimeout(r, 2000));
  
  const isHidden = await page.evaluate(() => {
     return !document.getElementById('auth-modal').classList.contains('active');
  });
  console.log('Is modal hidden?', isHidden);
  
  await browser.close();
})();

