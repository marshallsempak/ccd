const { ethers } = require('ethers');
const axios = require('axios');
const bip39 = require('bip39');
const moment = require('moment');
const cheerio = require('cheerio');
const fs = require('fs-extra');
require('colors');

/**
 * Delays the execution for the specified number of milliseconds.
 * @param {number} ms - The number of milliseconds to delay the execution.
 * @returns {Promise<void>} - A promise that resolves after the specified delay.
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Logs a message to the console with a timestamp.
 * @param {string} message - The message to be logged.
 * @param {string} type - The type of message to log (e.g. 'info', 'error', 'warning').
 */
function logger(message, type) {
  switch (type) {
    case 'info':
      console.log(`[${moment().format('HH:mm:ss')}] ${message}`);
      break;
    case 'success':
      console.log(`[${moment().format('HH:mm:ss')}] ${message}`.green);
      break;
    case 'error':
      console.error(`[${moment().format('HH:mm:ss')}] ${message}`.red);
      break;
    case 'warning':
      console.warn(`[${moment().format('HH:mm:ss')}] ${message}`.yellow);
      break;
    default:
      console.log(`[${moment().format('HH:mm:ss')}] ${message}`);
  }
}

/**
 * Generates a seed phrase using random bytes.
 * @returns {string} The generated seed phrase.
 */
function generateSeedPhrase() {
  const randomLength = Math.random() > 0.5 ? 24 : 12;
  const randomBytes = require('crypto').randomBytes(randomLength === 24 ? 32 : 16);
  return bip39.entropyToMnemonic(randomBytes.toString('hex'));
}

/**
 * Scrapes the Blockscan website to retrieve the balance of a given address.
 * @param {string} address - The Ethereum address to scrape the balance for.
 * @param {string} network - The network to scrape the balance from (e.g., 'eth', 'avax', 'optimism', 'fantom').
 * @returns {Promise<string|boolean>} - A promise that resolves to the balance as a string, or false if an error occurs.
 */
async function scrapeBlockscan(address, network) {
  let type;
  switch (network) {
    case 'eth':
      type = 'etherscan';
      break;
    case 'avax':
      type = 'cchain';
      break;
    case 'optimism':
      type = 'optimism';
      break;
    case 'fantom':
      type = 'ftmscan';
      break;
    default:
      type = 'etherscan';
  }
  const url = `https://${type}.com/address/${address}`;
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    let balance;
    switch (network) {
      case 'eth':
      case 'optimism':
      case 'fantom':
        balance = $('#ContentPlaceHolder1_divSummary > div.row.g-3.mb-4 > div:nth-child(1) > div > div > div:nth-child(3)').text();
        break;
      case 'avax':
        balance = $('#balances > tbody > tr:nth-child(2) > td').text();
        break;
      default:
        balance = '';
    }
    const balanceResult = balance.split('\n')[4];
    return balanceResult !== undefined ? balanceResult : '$0.00';
  } catch (error) {
    await delay(100);
    return '$0.00';
  }
}

/**
 * Runs the brute force process to generate seed phrases, create wallets, and check balances.
 * Logs the address, mnemonic, private key, and balance of each wallet checked.
 * If a wallet with a non-zero balance is found, appends the wallet information to a file named 'wallets.txt'.
 * @returns {Promise<void>} A promise that resolves when the brute force process is complete.
 */
async function runBruteforce() {
  let progress = 0;

  while (true) {
    try {
      const resSeedPhrase = generateSeedPhrase();
      const resEtherWallet = ethers.Wallet.fromPhrase(resSeedPhrase);

      const [
        resEthBalance,
        resBnbBalance,
        resMaticBalance,
        resAvaxBalance,
        resOptimismBalance,
        resFantomBalance
      ] = await Promise.all([
        scrapeBlockscan(resEtherWallet.address, 'eth'),
        scrapeBlockscan(resEtherWallet.address, 'bsc'),
        scrapeBlockscan(resEtherWallet.address, 'polygon'),
        scrapeBlockscan(resEtherWallet.address, 'avax'),
        scrapeBlockscan(resEtherWallet.address, 'optimism'),
        scrapeBlockscan(resEtherWallet.address, 'fantom')
      ]);

      progress++;
      logger(`[${progress}] 👾 Address: ${resEtherWallet.address}`, 'info');

      let hasBalance = false;

      if (resEthBalance !== '$0.00') {
        logger(`💬 Mnemonic: ${resEtherWallet.mnemonic.phrase}`, 'info');
        logger(`🔑 Private key: ${resEtherWallet.privateKey}`, 'info');
        logger(`🤑 ETH Balance: ${resEthBalance}`, 'success');
        hasBalance = true;
      } else {
        logger(`🤑 ETH Balance: ${resEthBalance}`, 'error');
      }

      if (resBnbBalance !== '$0.00') {
        logger(`🤑 BNB Balance: ${resBnbBalance}`, 'success');
        hasBalance = true;
      } else {
        logger(`🤑 BNB Balance: ${resBnbBalance}`, 'error');
      }

      if (resMaticBalance !== '$0.00') {
        logger(`🤑 MATIC Balance: ${resMaticBalance}`, 'success');
        hasBalance = true;
      } else {
        logger(`🤑 MATIC Balance: ${resMaticBalance}`, 'error');
      }

      if (resAvaxBalance !== '$0.00') {
        logger(`🤑 AVAX Balance: ${resAvaxBalance}`, 'success');
        hasBalance = true;
      } else {
        logger(`🤑 AVAX Balance: ${resAvaxBalance}`, 'error');
      }

      if (resOptimismBalance !== '$0.00') {
        logger(`🤑 Optimism Balance: ${resOptimismBalance}`, 'success');
        hasBalance = true;
      } else {
        logger(`🤑 Optimism Balance: ${resOptimismBalance}`, 'error');
      }

      if (resFantomBalance !== '$0.00') {
        logger(`🤑 Fantom Balance: ${resFantomBalance}`, 'success');
        hasBalance = true;
      } else {
        logger(`🤑 Fantom Balance: ${resFantomBalance}`, 'error');
      }

      if (hasBalance) {
        logger(`🎉 Found a wallet with a non-zero balance!`, 'success');
        await fs.appendFileSync(
          'wallets.txt',
          `👾 Address: ${resEtherWallet.address}\n💬 Mnemonic: ${resEtherWallet.mnemonic.phrase}\n🔑 Private key: ${resEtherWallet.privateKey}\n🤑 ETH Balance: ${resEthBalance}\n🤑 BNB Balance: ${resBnbBalance}\n🤑 MATIC Balance: ${resMaticBalance}\n🤑 AVAX Balance: ${resAvaxBalance}\n🤑 Optimism Balance: ${resOptimismBalance}\n🤑 Fantom Balance: ${resFantomBalance}\n\n`
        );
      }
    } catch (error) {
      logger(`An error occurred: ${error.message}`, 'error');
    }
    await delay(10); 
    console.log('');
  }
}

/**
 * Runs the bruteforce attack.
 */
runBruteforce();
