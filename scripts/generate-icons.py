from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "electron" / "assets"
OUT.mkdir(parents=True, exist_ok=True)


def make_icon(size: int) -> Image.Image:
    scale = size / 256
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        [22 * scale, 22 * scale, 234 * scale, 234 * scale],
        radius=50 * scale,
        fill=(0, 0, 0, 88),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(1, int(10 * scale))))
    image.alpha_composite(shadow)

    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        [18 * scale, 18 * scale, 238 * scale, 238 * scale],
        radius=52 * scale,
        fill=(18, 26, 38, 255),
        outline=(80, 221, 255, 210),
        width=max(1, int(6 * scale)),
    )

    # Command deck mark: a bright slash over two calm deck lines.
    draw.rounded_rectangle(
        [68 * scale, 78 * scale, 164 * scale, 98 * scale],
        radius=10 * scale,
        fill=(239, 247, 255, 235),
    )
    draw.rounded_rectangle(
        [68 * scale, 124 * scale, 140 * scale, 144 * scale],
        radius=10 * scale,
        fill=(239, 247, 255, 205),
    )
    draw.rounded_rectangle(
        [68 * scale, 170 * scale, 172 * scale, 190 * scale],
        radius=10 * scale,
        fill=(239, 247, 255, 185),
    )

    slash = [
        (162 * scale, 54 * scale),
        (198 * scale, 54 * scale),
        (112 * scale, 216 * scale),
        (76 * scale, 216 * scale),
    ]
    draw.polygon(slash, fill=(82, 219, 255, 255))

    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.polygon(slash, fill=(82, 219, 255, 95))
    glow = glow.filter(ImageFilter.GaussianBlur(max(1, int(8 * scale))))
    image.alpha_composite(glow)
    draw = ImageDraw.Draw(image)
    draw.polygon(slash, fill=(82, 219, 255, 255))

    return image


icons = [make_icon(size) for size in (16, 24, 32, 48, 64, 128, 256)]
make_icon(256).save(OUT / "app.png")
make_icon(32).save(OUT / "tray.png")
icons[-1].save(
    OUT / "app.ico",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
