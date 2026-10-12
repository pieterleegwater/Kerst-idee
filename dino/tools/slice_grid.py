"""Knipt een rasterplaatje (bijv. van Gemini) in losse dino's met transparante achtergrond.

Gebruik:
  python3 tools/slice_grid.py raster.png              # standaard 4 rijen x 5 kolommen
  python3 tools/slice_grid.py raster.png --rows 4 --cols 5

Volgorde van de vakjes (rij voor rij, links naar rechts) staat in ORDER hieronder; het 20e vakje is leeg.
Schrijft public/img/dino/<naam>.webp en public/img/dino/manifest.json.
Tip: vergroot een klein raster eerst met een AI-upscaler (bijv. Real-ESRGAN x4) voor scherpe kaarten.
"""
import argparse, json, os
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

ORDER = ["rex", "raptor", "spino", "allo", "carno",
         "dilo", "brachio", "diplo", "titan", "tri",
         "styraco", "pachy", "stego", "anky", "kentro",
         "ptera", "quetzal", "mosa", "plesio"]

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "img", "dino")


def remove_background(img, tol=38):
    """Maakt de effen achtergrond transparant: vult vanaf de randen alles wat op de randkleur lijkt."""
    rgb = np.asarray(img.convert("RGB")).astype(np.int16)
    h, w, _ = rgb.shape
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    close = np.sqrt(((rgb - bg) ** 2).sum(axis=2)) < tol
    mask = np.zeros((h, w), bool)  # True = achtergrond
    q = deque([(y, x) for x in range(w) for y in (0, h - 1)] + [(y, x) for y in range(h) for x in (0, w - 1)])
    while q:
        y, x = q.popleft()
        if mask[y, x] or not close[y, x]:
            continue
        mask[y, x] = True
        if y > 0: q.append((y - 1, x))
        if y < h - 1: q.append((y + 1, x))
        if x > 0: q.append((y, x - 1))
        if x < w - 1: q.append((y, x + 1))
    # rand iets inkrimpen en zacht maken; schaalt mee met de grootte van het plaatje
    k = max(3, int(round(min(h, w) / 220)) * 2 + 1)
    alpha = Image.fromarray(np.where(mask, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(k)).filter(ImageFilter.GaussianBlur(k / 2.5))
    out = img.convert("RGBA")
    out.putalpha(alpha)
    return out


def trim(img, pad=0.04):
    box = img.getchannel("A").point(lambda a: 255 if a > 24 else 0).getbbox()
    if not box:
        return img
    img = img.crop(box)
    p = int(max(img.size) * pad)
    canvas = Image.new("RGBA", (img.width + 2 * p, img.height + 2 * p))
    canvas.paste(img, (p, p))
    return canvas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("grid")
    ap.add_argument("--rows", type=int, default=4)
    ap.add_argument("--cols", type=int, default=5)
    ap.add_argument("--inset", type=float, default=0.02, help="rand per vakje weglaten (scheidingslijnen)")
    ap.add_argument("--out", default=OUT, help="uitvoermap")
    ap.add_argument("--max", type=int, default=900, help="maximale breedte/hoogte per dino in pixels")
    args = ap.parse_args()
    out_dir = args.out
    grid = Image.open(args.grid).convert("RGB")
    W, H = grid.size
    cw, ch = W / args.cols, H / args.rows
    os.makedirs(out_dir, exist_ok=True)
    done = []
    for i, name in enumerate(ORDER):
        r, c = divmod(i, args.cols)
        ix, iy = cw * args.inset, ch * args.inset
        cell = grid.crop((int(c * cw + ix), int(r * ch + iy), int((c + 1) * cw - ix), int((r + 1) * ch - iy)))
        cut = trim(remove_background(cell))
        cut.thumbnail((args.max, args.max), Image.LANCZOS)
        # WebP met transparantie: scherp maar klein, zodat het album snel laadt op telefoons
        cut.save(os.path.join(out_dir, f"{name}.webp"), "WEBP", quality=88, method=6)
        done.append(name)
        print(f"{name:8s} {cut.size}")
    with open(os.path.join(out_dir, "manifest.json"), "w") as f:
        json.dump({"images": done}, f)
    print(f"{len(done)} dino's opgeslagen in {os.path.normpath(out_dir)}")


if __name__ == "__main__":
    main()
