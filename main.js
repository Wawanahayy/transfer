import { ethers } from 'ethers';
import readline from 'readline';
import chalk from 'chalk';
import fs from 'fs';
import dotenv from 'dotenv';

// Load ENV & Network
dotenv.config();
const network = JSON.parse(fs.readFileSync('network/network.json', 'utf-8'));
const tokenData = JSON.parse(fs.readFileSync('token/token.json', 'utf-8'));

// Setup Provider
const provider = new ethers.JsonRpcProvider(network.rpcUrl);
const privateKeys = process.env.PRIVATE_KEYS ? process.env.PRIVATE_KEYS.split(',') : [];

if (privateKeys.length === 0) {
    console.log(chalk.red("❌ Tidak ada private key di .env!"));
    process.exit(1);
}

// Fungsi untuk membaca alamat tujuan dari file
function getAddressesFromFile(filename) {
  return fs.readFileSync(filename, 'utf-8')
    .split('\n')
    .map(addr => addr.trim())
    .filter(addr => addr.length > 0);
}

// Fungsi untuk mendapatkan saldo token ERC-20 yang tersedia
async function getAvailableTokens(wallet) {
  const erc20Abi = ["function balanceOf(address owner) view returns (uint256)"];
  const availableTokens = [];

  for (const [tokenName, { address, decimals }] of Object.entries(tokenData.ERC20)) {
    const contract = new ethers.Contract(address, erc20Abi, wallet);
    const balance = await contract.balanceOf(wallet.address);

    if (balance > 0) {
      availableTokens.push({ 
        name: tokenName, 
        contract: address, 
        balance: ethers.formatUnits(balance, decimals) 
      });
    }
  }

  return availableTokens;
}

// Fungsi utama untuk mengirim transaksi
async function sendToMultipleAddresses() {
  const addresses = getAddressesFromFile("address.txt");
  if (addresses.length === 0) {
    console.log(chalk.red("❌ File address.txt kosong!"));
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  rl.question(chalk.yellow("Pilih transaksi: (1) Native Token (2) ERC-20 Token: "), async (option) => {
    if (option !== '1' && option !== '2') {
      console.log(chalk.red("❌ Pilihan tidak valid!"));
      rl.close();
      return;
    }

    let tokenContractAddress = null;

    if (option === '2') {
      const wallet = new ethers.Wallet(privateKeys[0], provider);
      const availableTokens = await getAvailableTokens(wallet);

      if (availableTokens.length === 0) {
        console.log(chalk.red("❌ Tidak ada saldo token ERC-20 yang tersedia!"));
        rl.close();
        return;
      }

      console.log(chalk.yellow("\nToken yang tersedia:"));
      availableTokens.forEach((token, index) => {
        console.log(`${index + 1}. ${token.name} - ${token.balance} tokens`);
      });

      rl.question(chalk.green("\nPilih nomor token yang ingin dikirim: "), async (tokenIndex) => {
        tokenIndex = parseInt(tokenIndex, 10) - 1;
        if (tokenIndex < 0 || tokenIndex >= availableTokens.length) {
          console.log(chalk.red("❌ Pilihan tidak valid!"));
          rl.close();
          return;
        }

        tokenContractAddress = availableTokens[tokenIndex].contract;
        await processTransactions(addresses, option, tokenContractAddress);
        rl.close();
      });
    } else {
      await processTransactions(addresses, option, null);
      rl.close();
    }
  });
}

// Fungsi untuk memproses transaksi
async function processTransactions(addresses, option, tokenContractAddress) {
  console.log(chalk.yellow(`Mengirim ke ${addresses.length} alamat menggunakan ${privateKeys.length} akun...`));

  for (let privateKey of privateKeys) {
    const wallet = new ethers.Wallet(privateKey, provider);
    let nonce = await provider.getTransactionCount(wallet.address, 'pending');

    for (let recipient of addresses) {
      console.log(chalk.cyan(`🔹 Mengirim ke ${recipient}`));

      if (option === '1') {
        await sendNativeTransaction(wallet, recipient, nonce);
      } else {
        await sendERC20Transaction(wallet, recipient, nonce, tokenContractAddress);
      }

      nonce++;
      await randomDelay(5000, 15000);
    }
  }

  console.log(chalk.green("✅ Semua transaksi selesai!"));
}

// Fungsi untuk mengirim Native Token
async function sendNativeTransaction(wallet, to, nonce) {
  try {
    const balance = await provider.getBalance(wallet.address);
    const gasPrice = await provider.getFeeData();

    const amount = balance.div(10); // Kirim 10% saldo sebagai contoh
    const estimatedGas = ethers.parseUnits("21000", "wei");

    if (balance < amount.add(estimatedGas)) {
      console.log(chalk.red(`❌ Saldo tidak cukup untuk ${wallet.address}, menunggu...`));
      return;
    }

    const tx = await wallet.sendTransaction({ to, value: amount, nonce });
    console.log(chalk.green(`✅ Berhasil! TX: ${network.explorer}${tx.hash}`));
  } catch (error) {
    console.error(chalk.red("⚠️ Error:", error.message));
  }
}

// Fungsi untuk mengirim ERC-20 Token
async function sendERC20Transaction(wallet, to, nonce, tokenContractAddress) {
  try {
    const erc20Abi = [
      "function transfer(address to, uint256 value) public returns (bool)",
      "function balanceOf(address owner) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ];
    const contract = new ethers.Contract(tokenContractAddress, erc20Abi, wallet);
    const balance = await contract.balanceOf(wallet.address);
    const decimals = await contract.decimals();
    const amount = balance.div(10); // Kirim 10% saldo sebagai contoh

    if (balance < amount) {
      console.log(chalk.red(`❌ Saldo token tidak cukup untuk ${wallet.address}, menunggu...`));
      return;
    }

    const tx = await contract.transfer(to, amount, { nonce });
    console.log(chalk.green(`✅ Berhasil mengirim token! TX: ${network.explorer}${tx.hash}`));
  } catch (error) {
    console.error(chalk.red("⚠️ Error:", error.message));
  }
}

// Fungsi delay acak
function randomDelay(min, max) {
  const delayTime = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delayTime));
}

// Jalankan script
sendToMultipleAddresses();
