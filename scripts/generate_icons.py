from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "public" / "icons"


def build_icon(size: int) -> Image.Image:
    image = Image.new("RGB", (size, size), "#0f766e")
    draw = ImageDraw.Draw(image)
    margin = int(size * 0.12)
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=int(size * 0.12),
        fill="#ffffff",
    )
    road_width = int(size * 0.16)
    center = size // 2
    draw.line(
        [(center, int(size * 0.24)), (center, int(size * 0.76))],
        fill="#1d4ed8",
        width=road_width,
    )
    draw.line(
        [(int(size * 0.24), center), (int(size * 0.76), center)],
        fill="#0f766e",
        width=road_width,
    )
    draw.ellipse(
        [
            int(size * 0.38),
            int(size * 0.38),
            int(size * 0.62),
            int(size * 0.62),
        ],
        fill="#f59e0b",
    )

    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", int(size * 0.16))
    except OSError:
        font = ImageFont.load_default()

    text = "UF"
    bbox = draw.textbbox((0, 0), text, font=font)
    draw.text(
        ((size - (bbox[2] - bbox[0])) / 2, int(size * 0.67)),
        text,
        fill="#10201d",
        font=font,
    )
    return image


def main() -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        build_icon(size).save(ICON_DIR / f"icon-{size}.png")


if __name__ == "__main__":
    main()
