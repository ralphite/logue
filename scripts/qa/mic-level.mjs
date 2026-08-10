// Is the fake microphone actually feeding the file?
//
// Every voice check depends on this and none of them assert it. When the file
// is not playing, getUserMedia still succeeds and MediaRecorder still writes a
// WebM — a tiny one, of silence — and the failure surfaces much later as a
// model that "heard it wrong", which is a completely different investigation.
export async function run(api) {
  await api.goto("http://127.0.0.1:8787/stream");
  await api.sleep(1500);

  const heard = JSON.parse(
    await api.eval(`(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.start(1000);
    let peak = 0;
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 200));
      analyser.getFloatTimeDomainData(samples);
      for (const s of samples) peak = Math.max(peak, Math.abs(s));
    }
    const blob = await new Promise(r => { recorder.onstop = () => r(new Blob(chunks)); recorder.stop(); });
    stream.getTracks().forEach(t => t.stop());
    await context.close();
    return JSON.stringify({ peak: Number(peak.toFixed(4)), bytes: blob.size, seconds: 5 });
  })()`),
  );

  const loud = heard.peak >= 0.02;
  console.log(`${loud ? "PASS" : "FAIL"}  the fake microphone is feeding audio  — peak ${heard.peak}, ${heard.bytes} bytes in 5s`);
  if (!loud) {
    console.log("        silence. Every voice check below this is measuring nothing.");
    throw new Error("the fake microphone is silent");
  }
}
