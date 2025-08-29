// helpers.js
function randInt(min, max){ return Math.floor(Math.random()*(max-min)+min); }
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
async function randomDelay(min=200, max=800){ return sleep(randInt(min,max)); }

async function humanType(page, selector, text, minDelay=40, maxDelay=120){
  await page.focus(selector);
  for (const ch of text){
    await page.keyboard.type(ch);
    await sleep(randInt(minDelay, maxDelay));
  }
}

module.exports = { randInt, sleep, randomDelay, humanType };
