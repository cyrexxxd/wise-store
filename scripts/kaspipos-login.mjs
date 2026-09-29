#!/usr/bin/env node
// Вход кассира Kaspi Pay по SMS для оплаты Kaspi на сайте (NUXT_KASPIPOS_*).
// Порт входа из tapter-dev/kaspi-pos-automation (MIT): src/routes/auth.js, src/crypto.js, src/helpers.js.
//
//   node scripts/kaspipos-login.mjs            — спросит номер КАССИРА и код из SMS, напечатает строки env
//
// Каждый вход регистрирует новое «устройство» (ключ ECDSA + deviceId) — старая сессия после этого не действует.
// Напечатанные строки — секреты уровня строки БД: только в Render → Environment (и в локальный .env для теста),
// не в чат и не в git. Номером кассира больше нигде не входить: вход в настоящем приложении выбьет сессию.
// Kaspi поднял минимальную версию (OldVersionToUpdate) — задать KASPIPOS_APP_VERSION / KASPIPOS_APP_BUILD.
import { createHash, createHmac, createPublicKey, createSign, diffieHellman, generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline/promises'

const APP = {
  version: process.env.KASPIPOS_APP_VERSION || '26.0921',
  build: process.env.KASPIPOS_APP_BUILD || '1115',
  platform: 'iOS', platformVer: '18.4', locale: 'ru-RU', model: 'iPhone16,2', brand: 'Apple', deviceName: 'iPhone',
  screenW: '430.0', screenH: '932.0', cfNetwork: 'CFNetwork/3826.400.120', darwin: 'Darwin/24.4.0',
}
const ENTRANCE = 'https://entrance-pay.kaspi.kz'
const MTOKEN = 'https://mtoken.kaspi.kz'
const UA_NATIVE = `Kaspi%20Pay/${APP.build} ${APP.cfNetwork} ${APP.darwin}`
const UA_BROWSER = `Mozilla/5.0 (iPhone; CPU iPhone OS ${APP.platformVer.replace('.', '_')} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148`

// ─── новое устройство ───
const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const privateKeyB64 = ec.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64')
const spki = ec.publicKey.export({ type: 'spki', format: 'der' })
const pk = spki.subarray(spki.length - 65).toString('base64')
const DEVICE = {
  deviceId: randomUUID().toUpperCase(),
  installId: randomUUID().toUpperCase(),
  pinHash: createHash('md5').update(randomBytes(16)).digest('hex'),
  pk,
  pkTag: createHash('md5').update(pk).digest('hex'),
}

// ─── подпись ───
const almatyIso = (d = new Date()) => `${new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 23)}+0500`
const ecSign = (data) => { const s = createSign('SHA256'); s.update(data); s.end(); return s.sign(ec.privateKey).toString('base64') }
const xsu = (url) => createHash('md5').update(url.toLowerCase()).digest('hex')
function xSign(url, headers, xsh, body) {
  let text = xsh.split(',').map((n) => (n === 'url' ? `url:${url.toLowerCase()}` : `${n.toLowerCase()}:${headers[n] ?? ''}`)).join('\n')
  if (body) text += `\n${body}`
  return ecSign(createHash('sha256').update(text, 'utf8').digest())
}
function tokenSnMac(tokenSn, secret) {
  const q = Buffer.from(tokenSn || '00000000').toString('hex').substring(0, 64)
  const data = Buffer.concat([Buffer.from('OCRA-1:HOTP-SHA256-6:QH64-T1M'), Buffer.from([0]),
    Buffer.from(q.padEnd(256, '0'), 'hex'), Buffer.from((BigInt(Date.now()) / 30000n).toString(16).padStart(16, '0'), 'hex')])
  const h = createHmac('sha256', secret).update(data).digest()
  const o = h[h.length - 1] & 0x0f
  return String((((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1_000_000).padStart(6, '0')
}

// ─── шаги входа ───
let userToken = null
const cookie = () => `deviceId=${DEVICE.deviceId}; installId=${DEVICE.installId}; is_mobile_app=true; locale=${APP.locale}; ma_bld=${APP.build}; ma_platform_type=${APP.platform}; ma_platform_ver=${APP.platformVer}; ma_ver=${APP.version}; pk=${DEVICE.pk}; pkTag=${DEVICE.pkTag}; xs=R:0|E:0|RH:0|N:0${userToken ? `; user_token=${userToken}` : ''}`

async function step(referer, body) {
  const res = await fetch(`${ENTRANCE}/api/v1/entrance/step`, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*', 'Content-Type': 'application/json', 'Accept-Language': 'ru',
      Origin: ENTRANCE, 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Dest': 'empty',
      'User-Agent': UA_BROWSER, Referer: referer, Cookie: cookie(),
    },
    body: JSON.stringify(body),
  })
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const m = c.match(/user_token=([^;]+)/)
    if (m) userToken = m[1]
  }
  return res.json()
}

const alarm = (b) => b?.view?.onOpenAlarm?.error ?? b?.error ?? null

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stderr })
  const init = await step(`${ENTRANCE}/process/entrance/?auth=2&appBuild=${APP.build}&appVersion=${APP.version}&platformVersion=${APP.platformVer}&platformType=IOS&deviceBrand=${APP.brand}&deviceModel=${APP.model}&deviceId=${DEVICE.deviceId}&installId=${DEVICE.installId}&frontCameraAvailable=true&sf=registration&pc=KPEntrance&noPass=0`, {
    data: {},
    Data: { auth: '2', appBuild: APP.build, appVersion: APP.version, platformVersion: APP.platformVer, platformType: 'IOS', deviceBrand: APP.brand,
      deviceModel: APP.model, deviceId: DEVICE.deviceId, installId: DEVICE.installId, frontCameraAvailable: 'true', sf: 'registration', pc: 'KPEntrance', noPass: '0' },
    actType: 'Success',
  })
  const pId = init?.meta?.pId
  if (!pId) throw new Error(`Kaspi не начал вход: ${JSON.stringify(alarm(init) ?? init).slice(0, 300)}`)
  const referer = `${ENTRANCE}/process/universal-enter-phone-number?pId=${pId}&firstPage=KPUniversalEnterPhoneNumber`

  const phone = (await rl.question('Номер КАССИРА (10 цифр после +7, например 7761234567): ')).replace(/\D/g, '').replace(/^[78](?=\d{10}$)/, '')
  if (!/^7\d{9}$/.test(phone)) throw new Error('нужны 10 цифр после +7, начиная с 7')
  const sent = await step(referer, { meta: { pId, sn: 'EnterPhoneNumber' }, data: { phoneNumber: phone }, actType: 'Success' })
  if (sent?.view?.code !== 'EnterOtp') {
    const a = alarm(sent)
    if (a?.code === 'OldVersionToUpdate') throw new Error('Kaspi требует новую версию приложения: задайте KASPIPOS_APP_VERSION/KASPIPOS_APP_BUILD (актуальные — в issues tapter-dev/kaspi-pos-automation) и те же значения в NUXT_KASPIPOS_APP_*')
    throw new Error(`SMS не отправлено: ${a?.label || a?.code || sent?.view?.code || 'неизвестная ошибка'}`)
  }
  const otp = (await rl.question('Код из SMS: ')).replace(/\D/g, '')
  rl.close()
  const verified = await step(referer, { meta: { pId, sn: 'ViewEnterOtp' }, data: { userOtp: otp, inputType: 'auto' }, actType: 'Success' })
  if (verified?.data?.type !== 'kpDeviceRegistration' && verified?.view?.code !== 'KPMobileCall') {
    throw new Error(`код не принят: ${alarm(verified)?.label || verified?.view?.code || 'неизвестная ошибка'}`)
  }

  // finish: регистрация устройства + ECDH → секрет vtoken
  const ecdh = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const signedData = Buffer.from(JSON.stringify({ installId: DEVICE.installId, time: almatyIso(), auth: [{ value: '', type: 'pincode' }], userIdHash: '' })).toString('base64')
  const finishUrl = `${ENTRANCE}/api/v1/kpentrance/finish`
  const fh = {
    'Content-Type': 'application/json', Accept: '*/*', 'Accept-Language': 'ru', 'User-Agent': UA_NATIVE, 'X-Time': almatyIso(), 'X-Call': 'notConnected',
    'X-Platform-Type': APP.platform, 'X-PkTag': DEVICE.pkTag, 'X-SU': xsu(finishUrl), 'X-Net-Type': 'WIFI/ETHERNET', 'X-Emulator': '0', 'X-Locale': APP.locale,
    'X-SV': '2', 'X-Request-ID': randomUUID().toUpperCase(), 'X-Time-Zone': 'GMT+05:00',
    'X-SH': 'url,X-Time-Zone,X-Request-ID,X-Net-Type,X-Emulator,X-Call,X-Platform-Type,X-Locale,X-Time,X-SV',
  }
  const finishBody = JSON.stringify({
    signed: { sign: ecSign(signedData), data: signedData },
    guard: { pinHash: DEVICE.pinHash, x509: ecdh.publicKey.export({ type: 'spki', format: 'der' }).toString('base64') },
    processId: pId,
  })
  fh['X-Sign'] = xSign(finishUrl, fh, fh['X-SH'], finishBody)
  const fin = await (await fetch(finishUrl, { method: 'POST', headers: fh, body: finishBody })).json()
  if (!fin?.success || !fin?.data?.tokenSN || !fin?.data?.x509) throw new Error(`Kaspi не завершил вход: ${JSON.stringify(fin?.data?.scenario ?? fin?.error ?? fin).slice(0, 300)}`)
  const tokenSn = fin.data.tokenSN
  const secret = diffieHellman({ privateKey: ecdh.privateKey, publicKey: createPublicKey({ key: Buffer.from(fin.data.x509, 'base64'), format: 'der', type: 'spki' }) })

  // организация и профиль кассира
  const orgUrl = `${MTOKEN}/v08/organizations/org-context-otp`
  const oh = {
    'Content-Type': 'application/json', Accept: '*/*', 'Accept-Language': 'ru', 'User-Agent': UA_NATIVE, 'X-Kb-TokenSn': tokenSn,
    'X-Kb-TokenSnMac': tokenSnMac(tokenSn, secret), 'X-Install-ID': DEVICE.installId, 'X-App-Ver': APP.version, 'X-App-Bld': APP.build,
    'X-Locale': APP.locale, 'X-Call': 'notConnected', 'X-Time': almatyIso(), 'X-S': 'R:0|E:0|RH:0|N:0', 'X-SV': '2', 'X-Kb-Client-Ip': '192.168.1.96',
    'X-PkTag': DEVICE.pkTag, 'X-SU': xsu(orgUrl), 'X-Request-ID': randomUUID().toUpperCase(),
    'X-SH': 'url,X-Kb-Client-Ip,X-Time,X-App-Ver,X-SV,X-Locale,X-App-Bld,X-Install-ID,X-Kb-TokenSn,X-S,X-Kb-TokenSnMac,X-Call',
  }
  const orgBody = JSON.stringify({
    DeviceInformation: { SdkVersion: 'AOTP service', DeviceId: DEVICE.deviceId, ApplicationId: 'kz.kaspi.business', ScreenWidth: APP.screenW, Model: APP.model,
      ScreenHeight: APP.screenH, DeviceName: APP.deviceName, VersionName: APP.version, BuildRelease: `${APP.platform} ${APP.platformVer}`, Brand: APP.brand,
      Board: APP.platformVer, Platform: APP.platform, Product: 'Kaspi Pay', frontCameraAvailable: true, VersionCode: APP.build, InstallId: DEVICE.installId },
    OrganizationId: 0,
  })
  oh['X-Sign'] = xSign(orgUrl, oh, oh['X-SH'], orgBody)
  const org = await (await fetch(orgUrl, { method: 'POST', headers: oh, body: orgBody })).json()
  const cur = org?.Data?.Current
  if (!cur?.ProfileId) throw new Error('Kaspi не вернул профиль кассира — номер не привязан к организации как кассир?')
  if (!cur.IsCashier) console.error('ВНИМАНИЕ: этот номер не кассир (IsCashier=false). Для сайта нужен отдельный кассир, не владелец.')

  console.error(`\nВход выполнен: ${cur.OrganizationName}, профиль ${cur.ProfileId}. Строки ниже — в Render → Environment, затем перезапуск:\n`)
  console.log([
    `NUXT_KASPIPOS_DEVICE_ID=${DEVICE.deviceId}`,
    `NUXT_KASPIPOS_INSTALL_ID=${DEVICE.installId}`,
    `NUXT_KASPIPOS_PRIVATE_KEY=${privateKeyB64}`,
    `NUXT_KASPIPOS_TOKEN_SN=${tokenSn}`,
    `NUXT_KASPIPOS_SECRET=${secret.toString('hex')}`,
    `NUXT_KASPIPOS_PROFILE_ID=${cur.ProfileId}`,
    `NUXT_KASPIPOS_APP_VERSION=${APP.version}`,
    `NUXT_KASPIPOS_APP_BUILD=${APP.build}`,
  ].join('\n'))
}

main().catch((e) => {
  console.error(`\nОшибка: ${e.message}`)
  process.exit(1)
})
