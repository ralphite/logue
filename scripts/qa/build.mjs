export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(2500);
  console.log("running build:", await api.eval(`document.getElementById('logue-host')?.dataset.logueBuild`));
}
