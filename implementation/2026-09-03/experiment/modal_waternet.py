"""Run WaterNet (tnwei/waternet MIT re-implementation, UIEB-trained) on a few clips on a Modal A10G.
The CPU run took over an hour without finishing one clip; the GPU run is seconds per clip.
Usage: python -m modal run modal_waternet.py --clips "clips/<a>/snippet.mp4,clips/<b>/snippet.mp4"
Writes out_waternet/<clip>.mp4 locally.
"""
import os, sys, modal

ROOT = os.path.dirname(os.path.abspath(__file__))
WATERNET_DIR = os.path.join(ROOT, "ext", "waternet")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1", "libglib2.0-0", "ffmpeg")
    .pip_install("torch==2.4.1", "torchvision==0.19.1", "numpy<2", "opencv-python-headless", "tqdm")
    .add_local_dir(WATERNET_DIR, remote_path="/waternet_src")
)
app = modal.App("fishspotter-waternet", image=image)

@app.function(gpu="A10G", timeout=1800)
def run_waternet(name: str, mp4_bytes: bytes) -> bytes:
    import shutil, subprocess, glob, pathlib
    work = "/tmp/waternet"
    if not os.path.isdir(work): shutil.copytree("/waternet_src", work)
    src = f"/tmp/{name}.mp4"; pathlib.Path(src).write_bytes(mp4_bytes)
    r = subprocess.run([sys.executable, "inference.py", "--source", src, "--weights", "dl_waternet_exported_state_dict-daa0ee.pt", "--name", name], cwd=work, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("inference.py failed:\nSTDOUT:\n" + r.stdout[-1500:] + "\nSTDERR:\n" + r.stderr[-3000:])
    outs = glob.glob(f"{work}/output/{name}/**/*.mp4", recursive=True) + glob.glob(f"{work}/output/{name}/*.mp4")
    if not outs: raise RuntimeError("no output produced: " + str(os.listdir(f"{work}/output")))
    out = outs[0]
    # the repo writes with OpenCV (mp4v); re-encode to H.264 so it plays in a browser and matches the other outputs
    h264 = out + ".h264.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", out, "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", h264], check=True)
    return pathlib.Path(h264).read_bytes()

@app.local_entrypoint()
def main(clips: str):
    os.makedirs(os.path.join(ROOT, "out_waternet"), exist_ok=True)
    jobs = []
    for p in clips.split(","):
        p = p.strip(); name = os.path.basename(os.path.dirname(p))
        jobs.append((name, run_waternet.spawn(name, open(os.path.join(ROOT, p), "rb").read())))
    for name, call in jobs:
        data = call.get()
        dst = os.path.join(ROOT, "out_waternet", f"{name}.mp4"); open(dst, "wb").write(data)
        print("wrote", dst, len(data) // 1024, "KB")
