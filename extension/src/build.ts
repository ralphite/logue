/**
 * Keeping the browser on the build that was last deployed.
 *
 * An unpacked extension never updates itself: a deploy replaces the folder on
 * disk and the browser keeps running the code it loaded until someone opens
 * chrome://extensions and presses Reload. That turns "this machine runs one
 * version" into something a person has to remember.
 *
 * The Host can see the installed folder, so it simply reports which build is on
 * disk. The worker compares that with the build it was compiled as, and reloads
 * itself when they stop matching — which re-reads the folder.
 */

export interface BuildCheck {
  /** The build this worker was compiled as. */
  running: string;
  /** The build the Host sees installed on disk. */
  installed: string;
  /** The installed build this worker already reloaded for, if any. */
  reloadedFor: string;
}

export function shouldReload({ running, installed, reloadedFor }: BuildCheck): boolean {
  // A blank on either side is not evidence of anything — a Host started outside
  // the installed layout reports nothing, and reloading on that would restart
  // the worker every few minutes for no reason.
  if (!running || !installed) return false;
  if (running === installed) return false;
  // One attempt per installed build. If the reload does not close the gap —
  // a half-finished deploy, a folder this browser never loaded — the worker
  // must not spend the rest of the session restarting itself.
  return reloadedFor !== installed;
}
