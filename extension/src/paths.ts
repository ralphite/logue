/**
 * Where the extension's own files live at runtime.
 *
 * The installer keeps a stable folder whose manifest points at a versioned
 * `releases/<id>/` directory, so any path written as a bare filename resolves
 * to the extension root — where nothing is. Every internal page must be
 * resolved from a path the manifest actually declares.
 */

/** The directory containing `worker`, with its trailing slash. */
export function assetDirectory(worker: string): string {
  return worker.includes("/") ? worker.slice(0, worker.lastIndexOf("/") + 1) : "";
}

export function siblingOf(worker: string, file: string): string {
  return `${assetDirectory(worker)}${file}`;
}
