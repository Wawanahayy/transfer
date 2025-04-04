import { ethers } from 'ethers';
import chalk from 'chalk';
import fs from 'fs';
import dotenv from 'dotenv';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

// Fungsi tampilan awal
function displayHeader() {
  console.log("\x1b[40;96m============================================================\x1b[0m");
  console.log("\x1b[42;37m=======================  J.W.P.A  ==========================\x1b[0m");
  console.log("\x1b[45;97m================= @AirdropJP_JawaPride =====================\x1b[0m");
  console.log("\x1b[43;30m=============== https://x.com/JAWAPRIDE_ID =================\x1b[0m");
  console.log("\x1b[41;97m============= https://linktr.ee/Jawa_Pride_ID ==============\x1b[0m");
  console.log("\x1b[44;30m============================================================\x1b[0m");
}

// Load ENV & Network
dotenv.config();
const network = JSON.parse(fs.readFileSync('network/network.json', 'utf-8'));

// Setup Provider
const provider = new ethers.providers.JsonRpcProvider(network.rpcUrl);

// Load Private Keys
const privateKeys = process.env.PRIVATE_KEYS.split(',');

// Fungsi untuk membaca alamat tujuan dari file
function getAddressesFromFile(filename) {
  return fs.readFileSync(filename, 'utf-8')
    .split('\n')
    .map(addr => addr.trim())
    .filter(addr => addr.length > 0);
}

// Fungsi untuk mendapatkan jumlah acak dalam rentang tertentu
function getRandomAmount(min, max) {
  const amount = Math.random() * (max - min) + min;
  return ethers.utils.parseUnits(amount.toFixed(6), 18);
}

// Fungsi untuk delay acak
function randomDelay(min, max) {
  const delayTime = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delayTime));
}

// Fungsi untuk mengacak array
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Fungsi utama untuk mengirim transaksi
async function sendToMultipleAddresses() {
  displayHeader();
  await delay(5000);

  const rl = readline.createInterface({ input, output });

  const addresses = getAddressesFromFile("address.txt");
  if (addresses.length === 0) {
    console.log(chalk.red("File address.txt kosong!"));
    return;
  }

  const option = await rl.question(chalk.yellow("Pilih transaksi: (1) Native Token (2) ERC-20 Token: "));
  if (option !== '1' && option !== '2') {
    console.log(chalk.red("Pilihan tidak valid!"));
    rl.close();
    return;
  }

  let tokenContractAddresses = [];
  let min = 0.00001, max = 0.0031;

  if (option === '2') {
    const contractInput = await rl.question(chalk.green("Masukkan token contract address per akun (pisahkan dengan koma): "));
    tokenContractAddresses = contractInput.split(',').map(s => s.trim());

    if (tokenContractAddresses.length !== privateKeys.length) {
      console.log(chalk.red("Jumlah token contract harus sama dengan jumlah akun!"));
      rl.close();
      return;
    }
  }

  const inputAmount = await rl.question(chalk.yellow("Masukkan jumlah min & max (contoh: 0.01 0.002): "));
  if (inputAmount.trim()) {
    const parts = inputAmount.split(" ").map(parseFloat);
    if (parts.length === 2 && parts.every(n => !isNaN(n))) {
      [min, max] = parts;
    } else if (parts.length === 1 && !isNaN(parts[0])) {
      min = max = parts[0];
    }
  }

  await processTransactions(addresses, option, tokenContractAddresses, min, max);
  rl.close();
}

// Fungsi untuk memproses transaksi secara acak
async function processTransactions(addresses, option, tokenContractAddresses, min, max) {
  console.log(chalk.yellow(`🔄 Mengacak pengiriman ke ${addresses.length} alamat dari ${privateKeys.length} akun...`));

  const walletRecipientPairs = [];

  for (let i = 0; i < privateKeys.length; i++) {
    const privateKey = privateKeys[i];
    const wallet = new ethers.Wallet(privateKey, provider);
    for (let recipient of addresses) {
      walletRecipientPairs.push({
        wallet,
        recipient,
        contract: option === '2' ? tokenContractAddresses[i] : null,
      });
    }
  }

  shuffleArray(walletRecipientPairs);

  for (const { wallet, recipient, contract } of walletRecipientPairs) {
    const amount = getRandomAmount(min, max);
    const nonce = await provider.getTransactionCount(wallet.address, 'pending');

    console.log(chalk.cyan(`🔹 ${wallet.address} ➜ ${recipient} | ${ethers.utils.formatUnits(amount, 18)}`));

    try {
      if (option === '1') {
        await sendNativeTransaction(wallet, recipient, amount, nonce);
      } else {
        await sendERC20Transaction(wallet, recipient, amount, nonce, contract);
      }
    } catch (error) {
      console.error(chalk.red(`❌ Gagal kirim ke ${recipient} oleh ${wallet.address}:`), error.message);
    }

    await randomDelay(5000, 15000);
  }

  console.log(chalk.green("✅ Semua transaksi acak selesai!"));
}

// Fungsi untuk mengirim Native Token
async function sendNativeTransaction(wallet, to, amount, nonce) {
  while (true) {
    try {
      const balance = await provider.getBalance(wallet.address);
      if (balance.lt(amount)) {
        console.log(chalk.red(`❌ Saldo ${wallet.address} tidak cukup, menunggu...`));
        await delay(5000);
        continue;
      }

      const tx = await wallet.sendTransaction({ to, value: amount, nonce });
      console.log(chalk.green(`✅ Berhasil! TX: ${network.explorer}${tx.hash}`));
      break;
    } catch (error) {
      console.error(chalk.red("⚠️ Error:"), error.message);
      break;
    }
  }
}

// Fungsi untuk mengirim ERC-20 Token
async function sendERC20Transaction(wallet, to, amount, nonce, tokenContractAddress) {
  try {
    const erc20Abi = [
      "function transfer(address to, uint256 value) public returns (bool)",
      "function balanceOf(address owner) view returns (uint256)"
    ];
    const contract = new ethers.Contract(tokenContractAddress, erc20Abi, wallet);
    const balance = await contract.balanceOf(wallet.address);

    if (balance.lt(amount)) {
      console.log(chalk.red(`❌ Saldo token tidak cukup untuk ${wallet.address}, menunggu...`));
      return;
    }

    const tx = await contract.transfer(to, amount, { nonce });
    console.log(chalk.green(`✅ Berhasil mengirim token! TX: ${network.explorer}${tx.hash}`));
  } catch (error) {
    console.error(chalk.red("⚠️ Error:"), error.message);
  }
}

// Fungsi delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Jalankan script
sendToMultipleAddresses();

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('💥 Unhandled Rejection:'), reason);
});

process.on('uncaughtException', (err) => {
  console.error(chalk.red('💥 Uncaught Exception:'), err);
});
