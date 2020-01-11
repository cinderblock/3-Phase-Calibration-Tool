import { watch } from 'fs';
import { Observable } from 'rxjs';
import md5file from 'md5-file';
import { promisify } from 'util';

const md5filePromise = promisify(md5file);

export default function observeFileChange(file: string, suppressInitial = false): Observable<void> {
  let hash: string;

  return new Observable<void>(observer => {
    const watcher = watch(file);

    watcher.on('change', async (eventType: 'change' | 'rename', filename: string) => {
      if (eventType != 'change') return;
      console.log('Change event:', eventType, filename);

      const newHash = await md5filePromise(file).catch();

      if (newHash !== hash) {
        hash = newHash;
        observer.next();
      }
    });

    watcher.on('error', observer.error);

    watcher.on('close', observer.complete);

    if (!suppressInitial) observer.next();

    return (): void => {
      watcher.close();
    };
  });
}
