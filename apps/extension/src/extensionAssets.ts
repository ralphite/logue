export function installedExtensionAssetPath(serviceWorkerPath: string | undefined, assetName: string) {
  const cleanAsset = assetName.trim();
  if (!cleanAsset || cleanAsset.startsWith("/") || cleanAsset.split("/").includes("..")) {
    throw new Error("Extension asset path must stay inside the active release.");
  }
  const workerPath = serviceWorkerPath?.trim() ?? "";
  if (workerPath.startsWith("/") || workerPath.split("/").includes("..")) {
    throw new Error("Extension worker path must stay inside the extension.");
  }
  const separator = workerPath.lastIndexOf("/");
  return `${separator >= 0 ? workerPath.slice(0, separator + 1) : ""}${cleanAsset}`;
}
