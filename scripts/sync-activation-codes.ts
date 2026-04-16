import { activationCodeFileService } from "../lib/services/activation-code-file-service";

async function main() {
  await activationCodeFileService.syncTxtSnapshot();
  // eslint-disable-next-line no-console
  console.log("Activation code txt snapshot synced.");
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
