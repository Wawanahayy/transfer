import { ethers } from 'ethers';
import readline from 'readline';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
dotenv.config();
import colors from 'colors';

function displayHeader() {
  process.stdout.write('\x1Bc');
  console.log(colors.bgGreen('========================================================='));
  console.log(colors.bgGreen('========================================================='));
  console.log(colors.bgWhite('====================== TRANSFER ========================='));
  console.log(colors.bgWhite('================ CREATE By: JAWA-PRIDE  ================='));
  console.log(colors.bgWhite('=========== https://t.me/AirdropJP_JawaPride ============')); 
  console.log(colors.bgGreen('========================================================='));
  console.log(colors.bgGreen('========================================================='));
  console.log();
}

const NETWORK = {
  name: "Tea Sepolia Testnet",
  rpcUrl: "https://tea-sepolia.g.alchemy.com/public",
  explorer: "https://sepolia.tea.xyz/tx/"
};

const provider = new ethers.JsonRpcProvider(NETWORK.rpcUrl);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function getAddressesFromFile(filename) {
  return readFileSync(filename, 'utf-8')
    .split('\n')
    .map(addr => addr.trim())
    .filter(addr => addr.length > 0);
}

function getRandomAmount(min, max) {
  const amount = Math.random() * (max - min) + min;
  return ethers.parseUnits(amount.toFixed(6), 18); // Ensure precision to 6 decimal places
}

// Fungsi untuk delay dengan waktu acak antara min dan max (dalam milidetik)
function randomDelay(min, max) {
  const delayTime = Math.floor(Math.random() * (max - min + 1)) + min; // random antara min dan max
  return new Promise(resolve => setTimeout(resolve, delayTime));
}

async function sendTeaToMultipleAddresses() {
  // Display header before getting input
  displayHeader();

  const addresses = getAddressesFromFile("address.txt");
  if (addresses.length === 0) {
    console.log(chalk.red("File address.txt kosong!"));
    return;
  }

  rl.question(chalk.yellow("Masukkan jumlah minimum dan maksimum (contoh: 0.01 0.00001) atau tekan Enter untuk default: "), async (input) => {
    let min = 0.00001, max = 0.0031;
    if (input.trim()) {
      const parts = input.split(" ").map(parseFloat);
      if (parts.length === 2 && parts.every(n => !isNaN(n))) {
        [max, min] = parts;
      }
    }

    console.log(chalk.yellow(`Mengirim TEA ke ${addresses.length} alamat...`));
    let nonce = await provider.getTransactionCount(wallet.address, 'pending');

    for (let recipient of addresses) {
      const amount = getRandomAmount(min, max);
      console.log(chalk.cyan(`Mengirim ${ethers.formatUnits(amount, 18)} TEA ke ${recipient}`));
      await sendTransaction(recipient, amount, nonce);
      nonce++; // Increment nonce for the next transaction
      await randomDelay(5000, 15000); // Delay acak antara 5 detik dan 15 detik
    }

    console.log(chalk.green("✅ Semua transaksi selesai!"));
    rl.close();
  });
}

async function sendTransaction(to, amount, nonce) {
  while (true) {
    try {
      const balance = await provider.getBalance(wallet.address);
      if (balance < amount) {
        console.log(chalk.red("Saldo tidak mencukupi, menunggu saldo mencukupi..."));
        await delay(5000);
        continue;
      }

      const tx = await wallet.sendTransaction({ to, value: amount, nonce });
      console.log(chalk.green(`✅ Berhasil! TX: ${NETWORK.explorer}${tx.hash}`));
      break;
    } catch (error) {
      if (error.message.includes("nonce too low")) {
        console.log(chalk.red("⚠️ Nonce terlalu rendah, memperbarui nonce..."));
        nonce = await provider.getTransactionCount(wallet.address, 'pending');
      } else {
        console.error(chalk.red("Gagal mengirim TEA:", error.message));
        break;
      }
    }
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start the process
sendTeaToMultipleAddresses();
