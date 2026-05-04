export const VERSION = '0.1.0';

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`Tidio Remake server v${VERSION} starting...`);
}
