import fs from 'fs/promises';
import path from 'path';

const buildFile = path.resolve(process.cwd(), 'buildnr.txt');

async function main() {
  let current = 0;

  try {
    const content = await fs.readFile(buildFile, 'utf8');
    current = parseInt(content.trim(), 10);
    if (Number.isNaN(current)) {
      current = 0;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Unable to read existing build number:', error);
      process.exit(1);
    }
  }

  const next = current + 1;

  try {
    await fs.writeFile(buildFile, String(next), 'utf8');
    console.log(`Updated build number to ${next}`);
  } catch (error) {
    console.error('Unable to write build number:', error);
    process.exit(1);
  }
}

main();
