export default function ForceQuit(timeout: number) {
  setTimeout(() => {
    console.log('Forcing quit');
    process.exit(0);
  }, timeout).unref();
}
