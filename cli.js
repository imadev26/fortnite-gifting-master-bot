const readline = require('readline');
const EpicAuthService = require('./src/services/epicAuthService');
const GiftingService = require('./src/services/giftingService');
const FortniteApiService = require('./src/services/fortniteApi');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(promptText) {
  return new Promise((resolve) => rl.question(promptText, resolve));
}

async function mainCLI() {
  console.log('\n=============================================');
  console.log('🎁 FORTNITE DIRECT GIFTING CLI ENGINE');
  console.log('=============================================\n');

  while (true) {
    console.log('\nSelect an option:');
    console.log('1. Add Epic Account (Device Authorization)');
    console.log('2. View Linked Accounts');
    console.log('3. Gift Item to Recipient');
    console.log('4. Check Current Shop Items');
    console.log('5. Exit');

    const choice = await question('\nEnter choice (1-5): ');

    if (choice === '1') {
      const url = EpicAuthService.getAuthUrl();
      console.log(`\n1. Open this URL in browser and log into Epic Games:\n   ${url}`);
      const code = await question('\n2. Paste 32-character authorizationCode here: ');
      if (code) {
        console.log('\n⏳ Authenticating and creating DeviceAuth...');
        const res = await EpicAuthService.createDeviceAuthFromCode(code.trim());
        if (res.success) {
          console.log(`✅ Success! Linked account: ${res.account.displayName} (${res.account.accountId})`);
        } else {
          console.log(`❌ Error: ${res.error}`);
        }
      }
    } else if (choice === '2') {
      const accounts = EpicAuthService.getAccounts();
      console.log(`\n📂 Linked Accounts (${accounts.length}):`);
      accounts.forEach((acc, idx) => {
        console.log(`   ${idx + 1}. ${acc.displayName} (ID: ${acc.accountId})`);
      });
    } else if (choice === '3') {
      const accounts = EpicAuthService.getAccounts();
      if (!accounts.length) {
        console.log('\n❌ No accounts linked. Please run option 1 first.');
        continue;
      }
      const item = await question('\nEnter Item Name (e.g. Griddy, Renegade): ');
      const recipient = await question('Enter Recipient Epic Username: ');
      const message = (await question('Enter Gift Message (optional): ')) || 'Enjoy your gift!';

      console.log('\n⏳ Initiating Fortnite Direct Gift transaction...');
      const res = await GiftingService.giftItemToUser(accounts[0], recipient, item, message);
      if (res.success) {
        console.log(`\n🎉 SUCCESS! Sent ${res.item} (${res.price} V-Bucks) to ${res.recipient} from ${res.sender}`);
      } else {
        console.log(`\n❌ GIFTING FAILED: ${res.error}`);
      }
    } else if (choice === '4') {
      console.log('\n⏳ Fetching shop...');
      const shopRes = await FortniteApiService.getShop();
      if (shopRes.success) {
        console.log(`\n🛒 Shop Items Count: ${shopRes.data.entries?.length || 0}`);
        (shopRes.data.entries || []).slice(0, 10).forEach((e, idx) => {
          const name = e.items?.[0]?.name || e.tracks?.[0]?.title || e.bundle?.name || 'Offer';
          const price = e.finalPrice || e.regularPrice || 0;
          console.log(`   ${idx + 1}. ${name} - ${price} V-Bucks (OfferId: ${e.offerId})`);
        });
      }
    } else if (choice === '5') {
      console.log('Goodbye!');
      rl.close();
      process.exit(0);
    }
  }
}

mainCLI();
