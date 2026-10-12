"""Real-ESRGAN x4plus upscaler (CPU) voor nieuwe dino-plaatjes, vóór tools/slice_grid.py.

Eenmalig:  pip install torch numpy pillow
           curl -L -o RealESRGAN_x4plus.pth https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth
Gebruik:   python3 tools/upscale_esrgan.py raster.png raster_x4.png   (gewichten in de huidige map)
Model: Real-ESRGAN (BSD-3-Clause), https://github.com/xinntao/Real-ESRGAN
"""
import sys, torch, numpy as np
import torch.nn as nn, torch.nn.functional as F
from PIL import Image

class RDB(nn.Module):
    def __init__(s, nf=64, gc=32):
        super().__init__()
        s.conv1 = nn.Conv2d(nf, gc, 3, 1, 1); s.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1)
        s.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1); s.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1)
        s.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1); s.lrelu = nn.LeakyReLU(0.2, True)
    def forward(s, x):
        x1 = s.lrelu(s.conv1(x)); x2 = s.lrelu(s.conv2(torch.cat((x, x1), 1)))
        x3 = s.lrelu(s.conv3(torch.cat((x, x1, x2), 1))); x4 = s.lrelu(s.conv4(torch.cat((x, x1, x2, x3), 1)))
        return s.conv5(torch.cat((x, x1, x2, x3, x4), 1)) * 0.2 + x

class RRDB(nn.Module):
    def __init__(s, nf=64, gc=32):
        super().__init__(); s.rdb1 = RDB(nf, gc); s.rdb2 = RDB(nf, gc); s.rdb3 = RDB(nf, gc)
    def forward(s, x): return s.rdb3(s.rdb2(s.rdb1(x))) * 0.2 + x

class RRDBNet(nn.Module):
    def __init__(s, nf=64, nb=23, gc=32):
        super().__init__()
        s.conv_first = nn.Conv2d(3, nf, 3, 1, 1); s.body = nn.Sequential(*[RRDB(nf, gc) for _ in range(nb)])
        s.conv_body = nn.Conv2d(nf, nf, 3, 1, 1); s.conv_up1 = nn.Conv2d(nf, nf, 3, 1, 1); s.conv_up2 = nn.Conv2d(nf, nf, 3, 1, 1)
        s.conv_hr = nn.Conv2d(nf, nf, 3, 1, 1); s.conv_last = nn.Conv2d(nf, 3, 3, 1, 1); s.lrelu = nn.LeakyReLU(0.2, True)
    def forward(s, x):
        f = s.conv_first(x); f = f + s.conv_body(s.body(f))
        f = s.lrelu(s.conv_up1(F.interpolate(f, scale_factor=2, mode="nearest")))
        f = s.lrelu(s.conv_up2(F.interpolate(f, scale_factor=2, mode="nearest")))
        return s.conv_last(s.lrelu(s.conv_hr(f)))

def upscale(img, tile=192, pad=12):
    net = RRDBNet(); net.load_state_dict(torch.load("RealESRGAN_x4plus.pth", map_location="cpu")["params_ema"]); net.eval()
    x = torch.from_numpy(np.asarray(img.convert("RGB"), dtype=np.float32) / 255).permute(2, 0, 1)[None]
    _, _, h, w = x.shape; out = torch.zeros(1, 3, h * 4, w * 4)
    with torch.inference_mode():
        for y0 in range(0, h, tile):
            for x0 in range(0, w, tile):
                y1, x1 = min(y0 + tile, h), min(x0 + tile, w)
                py0, px0, py1, px1 = max(y0 - pad, 0), max(x0 - pad, 0), min(y1 + pad, h), min(x1 + pad, w)
                o = net(x[:, :, py0:py1, px0:px1])
                out[:, :, y0 * 4:y1 * 4, x0 * 4:x1 * 4] = o[:, :, (y0 - py0) * 4:(y0 - py0) * 4 + (y1 - y0) * 4, (x0 - px0) * 4:(x0 - px0) * 4 + (x1 - x0) * 4]
            print(f"  rij {y0 // tile + 1}/{(h + tile - 1) // tile}", flush=True)
    return Image.fromarray((out[0].clamp(0, 1).permute(1, 2, 0).numpy() * 255).round().astype(np.uint8))

if __name__ == "__main__":
    torch.set_num_threads(4)
    upscale(Image.open(sys.argv[1])).save(sys.argv[2])
