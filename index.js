// index.js
require('dotenv').config();
const puppeteer = require('puppeteer');
const { Telegraf } = require('telegraf');
const { randomDelay, humanType, sleep } = require('./helpers');

const {
  LOGIN_URL,
  DASHBOARD_URL,
  EMAIL, PASSWORD,
  FULL_NAME, PASSPORT, PASSPORT_EXPIRY, DOB, NATIONALITY, GENDER, PHONE, COUNTRY_CODE, CATEGORY, CITY, ADDITIONAL_INFO,
  TELEGRAM_TOKEN, TELEGRAM_CHAT_ID,
  HEADLESS = 'false',
  POLL_INTERVAL_MS = '5000'
} = process.env;

const bot = new Telegraf(TELEGRAM_TOKEN);

async function start(){
  const browser = await puppeteer.launch({
    headless: HEADLESS === 'true',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  // userAgent padrão é ok; evite truques para ignorar políticas do site
  await page.setViewport({ width: 1280, height: 800 });

  try {
    await login(page);
    await monitorSlots(page);
  } catch (e) {
    console.error('Erro principal:', e);
    if (TELEGRAM_CHAT_ID) await bot.telegram.sendMessage(TELEGRAM_CHAT_ID, `Erro no bot: ${e.message}`);
  } finally {
    await browser.close();
    process.exit(0); // encerra node
  }
}

async function login(page){
  console.log('Acedendo à página de login...');
  await page.goto(LOGIN_URL, { waitUntil: 'networkidle2' });

  // *** ATENÇÃO: ajustar seletores conforme a página real ***
  // Exemplo genérico:
  const emailSelector = 'input[name="email"]';
  const passSelector = 'input[name="password"]';
  const submitSelector = 'button[type="submit"]';

  await humanType(page, emailSelector, EMAIL || '');
  await randomDelay();
  await humanType(page, passSelector, PASSWORD || '');
  await randomDelay(400, 900);
  await page.click(submitSelector);

  // esperar por dashboard ou outra indicação de login bem-sucedido
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(()=>{});
  console.log('Tentativa de login concluída. URL atual:', page.url());
}

async function monitorSlots(page){
  console.log('Iniciando monitoramento de vagas...');
  const poll = Number(POLL_INTERVAL_MS) || 5000;

  while(true){
    try {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
      await randomDelay(800, 1500);

      // --- DETECTAR CAPTCHA / BIOMETRIA ---
      const pageText = await page.evaluate(()=>document.body.innerText.toLowerCase());
      if (pageText.includes('captcha') || pageText.includes('reCAPTCHA') || pageText.includes('reconhecimento')){
        const msg = 'Captcha/Reconhecimento detectado. Intervenção humana necessária: ' + page.url();
        console.warn(msg);
        if (TELEGRAM_CHAT_ID) await bot.telegram.sendMessage(TELEGRAM_CHAT_ID, msg);
        // pausa longa para intervenção manual
        await sleep(1000 * 60 * 10);
        continue;
      }

      // --- VERIFICAÇÃO DE VAGA ---
      // Atenção: substitua este troço por lógica específica baseada nos seletores reais do site.
      const hasAvailable = await page.evaluate(()=>{
        // exemplo: procurar um elemento que indique disponibilidade
        // return !!document.querySelector('.slot-available');
        // ou checar texto:
        const txt = document.body.innerText.toLowerCase();
        if (txt.includes('no appointments available') || txt.includes('no slots')) return false;
        // A heurística abaixo é apenas ilustrativa:
        return txt.includes('available') || txt.match(/choose.*date/i);
      });

      if (hasAvailable){
        console.log('Vaga detectada! Tentando reservar...');
        if (TELEGRAM_CHAT_ID) await bot.telegram.sendMessage(TELEGRAM_CHAT_ID, 'Vaga detectada — tentando reservar agora. URL: ' + page.url());
        const ok = await tryReserve(page);
        if (ok){
          console.log('Reserva concluída com sucesso!');
          if (TELEGRAM_CHAT_ID) await bot.telegram.sendMessage(TELEGRAM_CHAT_ID, '✅ Reserva finalizada com sucesso! Verifique o e-mail e o dashboard.');
          break;
        } else {
          console.log('Tentativa de reserva falhou. Continuando monitoramento...');
          if (TELEGRAM_CHAT_ID) await bot.telegram.sendMessage(TELEGRAM_CHAT_ID, 'Tentativa de reserva falhou — continuando a monitorar.');
        }
      } else {
        console.log('Nenhuma vaga. Vou aguardar', poll, 'ms');
      }

      // esperar intervalo antes da próxima verificação
      await sleep(poll + Math.floor(Math.random() * 1000));
    } catch (e){
      console.error('Erro no loop de monitoramento:', e);
      if (TELEGRAM_CHAT_ID) await bot.telegram.sendMessage(TELEGRAM_CHAT_ID, 'Erro no monitoramento: ' + e.message);
      await sleep(5000);
    }
  }
}

async function tryReserve(page){
  try {
    // *** Ajuste os seletores abaixo conforme a página real do VFS ***
    // Exemplo de ações:
    // 1) aceitar termos
    // 2) escolher slot (clicar na data/hora)
    // 3) preencher formulário com os dados do .env
    // 4) confirmar e verificar página de confirmação

    // Exemplo genérico (substituir seletores):
    const acceptSelector = 'input[name="terms"], #acceptTerms';
    const chooseSlotSelector = '.slot-available'; // precisa ser ajustado
    const confirmBtnSelector = 'button[type="submit"], button.confirm';

    // aceitar termos (se existir)
    if (await page.$(acceptSelector)){
      await page.click(acceptSelector);
      await randomDelay(300,700);
    }

    // escolher a primeira slot disponível
    if (await page.$(chooseSlotSelector)){
      await page.click(chooseSlotSelector);
      await randomDelay(300,800);
    } else {
      console.warn('Não foi encontrado seletor de slot; abortando tentativa.');
      return false;
    }

    // ir para o formulário (ajustar seleção dos inputs)
    // Preencher exemplo:
    const nameSel = 'input[name="fullName"], input#fullName';
    const passportSel = 'input[name="passportNumber"], input#passport';
    const dobSel = 'input[name="dob"]';
    const phoneSel = 'input[name="phone"]';
    const emailSel = 'input[name="email"]';

    if (await page.$(nameSel)) await humanType(page, nameSel, FULL_NAME || '');
    await randomDelay();
    if (await page.$(passportSel)) await humanType(page, passportSel, PASSPORT || '');
    await randomDelay();
    if (await page.$(dobSel)) await humanType(page, dobSel, DOB || '');
    await randomDelay();
    if (await page.$(phoneSel)) await humanType(page, phoneSel, PHONE || '');
    await randomDelay();
    if (await page.$(emailSel)) await humanType(page, emailSel, EMAIL || '');

    // clicar em confirmar (ajuste)
    if (await page.$(confirmBtnSelector)){
      await page.click(confirmBtnSelector);
    } else {
      console.warn('Botão confirmar não encontrado.');
      return false;
    }

    // esperar por confirmação
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(()=>{});
    const body = (await page.content()).toLowerCase();
    if (body.includes('confirmation') || body.includes('booking reference') || body.includes('appointment confirmed')){
      return true;
    } else {
      // Falha provável — pode haver captcha ou etapa de pagamento/biometria
      return false;
    }

  } catch (e){
    console.error('Erro em tryReserve:', e);
    return false;
  }
}

// start
start();
