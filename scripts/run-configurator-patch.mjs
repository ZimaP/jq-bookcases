import { writeFileSync } from "node:fs";

try {
  await import("./apply-configurator-transaction.mjs");
  writeFileSync(
    "ENGINE-PATCH-STATUS.md",
    "Transactional patch status: success. Application files were patched and verified.\n"
  );
} catch (error) {
  const details = error instanceof Error ? error.stack || error.message : String(error);
  writeFileSync(
    "ENGINE-PATCH-STATUS.md",
    `Transactional patch status: failed.\n\n\`\`\`text\n${details}\n\`\`\`\n`
  );
  console.error(details);
}
