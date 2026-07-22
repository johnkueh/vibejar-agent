#!/usr/bin/env node
/**
 * README hero — three-beat filmstrip (Fable design 2026-07-22).
 * Real jar mark + Space Grotesk + landing screenshots.
 *
 *   pnpm hero
 */
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement as h } from "react";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const W = 1200;
const H = 630;

const BG = "#0a0a0b";
const FG = "#f3f3f1";
const MUTED = "#c2c2be";
const CARD = "#121214";
const BORDER = "#26262a";

const PAD = 48;
const CARD_W = 332;
const CARD_H = 342;
const GAP = 36;
const CHIP_H = 22;
const CHIP_GAP = 10;

async function loadFonts() {
  const [regular, bold] = await Promise.all([
    readFile(join(root, "assets/fonts/SpaceGrotesk-400.ttf")),
    readFile(join(root, "assets/fonts/SpaceGrotesk-700.ttf")),
  ]);
  return [
    { name: "Space Grotesk", data: regular, weight: 400, style: "normal" },
    { name: "Space Grotesk", data: bold, weight: 700, style: "normal" },
    // satori weight 500/600 → use 700 for numbers/labels (no 500/600 files)
  ];
}

async function loadPng(name) {
  const buf = await readFile(join(root, "assets/screenshots", name));
  return {
    dataUrl: `data:image/png;base64,${buf.toString("base64")}`,
    meta: await sharp(buf).metadata(),
  };
}

function JarIcon({ size = 28, color = FG }) {
  return h(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
    },
    h("path", {
      d: "M8 3.5h8",
      stroke: color,
      strokeWidth: "1.7",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
    h("path", {
      d: "M8.5 3.5v2.2c0 .5-.3.9-.8 1.2C6.6 7.6 6 8.8 6 10v7.5A3.5 3.5 0 0 0 9.5 21h5a3.5 3.5 0 0 0 3.5-3.5V10c0-1.2-.6-2.4-1.7-3.1-.5-.3-.8-.7-.8-1.2V3.5",
      stroke: color,
      strokeWidth: "1.7",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
    h("path", {
      d: "M12.669 8.35811L17.6969 10.3256C20.5969 11.4604 22.0469 12.0277 21.9988 12.9278C21.9508 13.8278 20.4375 14.2405 17.4111 15.0659C16.5099 15.3117 16.0593 15.4346 15.7469 15.7469C15.4346 16.0593 15.3117 16.5099 15.0659 17.4111C14.2405 20.4375 13.8278 21.9508 12.9278 21.9988C12.0277 22.0469 11.4604 20.5969 10.3256 17.6969L8.35811 12.669C7.17004 9.63279 6.57601 8.1147 7.34535 7.34535C8.1147 6.57601 9.63279 7.17004 12.669 8.35811Z",
      fill: color,
      transform: "translate(12 13.9) scale(0.42) translate(-14.5 -14.5)",
    })
  );
}

/**
 * Portrait screenshot cropped into a fixed card.
 * topFrac: negative crop as fraction of scaled image height (Fable anchors).
 */
function ShotCard({ src, imgW, imgH, topFrac }) {
  const scaledH = Math.round(CARD_W * (imgH / imgW));
  const top = Math.round(-topFrac * scaledH);
  return h(
    "div",
    {
      style: {
        display: "flex",
        width: CARD_W,
        height: CARD_H,
        borderRadius: 16,
        border: `1px solid ${BORDER}`,
        background: CARD,
        overflow: "hidden",
        position: "relative",
      },
    },
    h("img", {
      src,
      width: CARD_W,
      height: scaledH,
      style: {
        position: "absolute",
        left: 0,
        top,
      },
    })
  );
}

function Beat({ n, label, src, imgW, imgH, topFrac }) {
  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        width: CARD_W,
      },
    },
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: CHIP_H,
          marginBottom: CHIP_GAP,
        },
      },
      h(
        "span",
        {
          style: {
            color: FG,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.01em",
          },
        },
        n
      ),
      h(
        "span",
        {
          style: {
            color: MUTED,
            fontSize: 15,
            fontWeight: 400,
            letterSpacing: "0.01em",
          },
        },
        label
      )
    ),
    h(ShotCard, { src, imgW, imgH, topFrac })
  );
}

function Arrow() {
  return h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: GAP,
        // chip row + gap + half card so arrow sits on card midline
        height: CHIP_H + CHIP_GAP + CARD_H,
        color: MUTED,
        opacity: 0.55,
        fontSize: 22,
        fontWeight: 400,
      },
    },
    "→"
  );
}

async function main() {
  const fonts = await loadFonts();
  const [a, b, c] = await Promise.all([
    loadPng("annotate-frame.png"),
    loadPng("claude-mobile-frame.png"),
    loadPng("github-pr.png"),
  ]);

  // Fable crop fractions (of scaled image height)
  const beats = [
    {
      n: "01",
      label: "Circle the bug",
      shot: a,
      topFrac: 0.115,
    },
    {
      n: "02",
      label: "Your agent claims it",
      shot: b,
      topFrac: 0.055,
    },
    {
      n: "03",
      label: "Fix merged, with proof",
      shot: c,
      // slightly deeper crop to surface BEFORE/AFTER + claude comment
      topFrac: 0.18,
    },
  ];

  const filmstripW = 3 * CARD_W + 2 * GAP; // 1068
  const sideSlack = Math.floor((W - 2 * PAD - filmstripW) / 2);

  const tree = h(
    "div",
    {
      style: {
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        background: BG,
        fontFamily: "Space Grotesk",
        border: `1px solid ${BORDER}`,
        position: "relative",
      },
    },
    // Header
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 40,
          marginTop: PAD,
          marginLeft: PAD,
          marginRight: PAD,
        },
      },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 10 } },
        h(JarIcon, { size: 28, color: FG }),
        h(
          "div",
          { style: { display: "flex", alignItems: "baseline", gap: 8 } },
          h(
            "span",
            {
              style: {
                color: FG,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.03em",
              },
            },
            "vibejar"
          ),
          h(
            "span",
            {
              style: {
                color: MUTED,
                fontSize: 18,
                fontWeight: 400,
                letterSpacing: "-0.02em",
              },
            },
            "/ agent"
          )
        )
      ),
      h(
        "span",
        {
          style: {
            color: MUTED,
            fontSize: 15,
            fontWeight: 400,
            letterSpacing: "-0.01em",
          },
        },
        "agent CLI + skill + protocol — MIT"
      )
    ),
    // Headline
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          height: 46,
          marginTop: 24,
          marginLeft: PAD,
          marginRight: PAD,
          whiteSpace: "nowrap",
        },
      },
      h(
        "span",
        {
          style: {
            color: MUTED,
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: "-0.03em",
          },
        },
        "Screenshot a bug."
      ),
      h(
        "span",
        {
          style: {
            color: "#ffffff",
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: "-0.03em",
          },
        },
        "Your agent ships the fix."
      )
    ),
    // Filmstrip
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          marginTop: 28,
          marginLeft: PAD + sideSlack,
          height: CHIP_H + CHIP_GAP + CARD_H,
        },
      },
      h(Beat, {
        n: beats[0].n,
        label: beats[0].label,
        src: beats[0].shot.dataUrl,
        imgW: beats[0].shot.meta.width,
        imgH: beats[0].shot.meta.height,
        topFrac: beats[0].topFrac,
      }),
      h(Arrow),
      h(Beat, {
        n: beats[1].n,
        label: beats[1].label,
        src: beats[1].shot.dataUrl,
        imgW: beats[1].shot.meta.width,
        imgH: beats[1].shot.meta.height,
        topFrac: beats[1].topFrac,
      }),
      h(Arrow),
      h(Beat, {
        n: beats[2].n,
        label: beats[2].label,
        src: beats[2].shot.dataUrl,
        imgW: beats[2].shot.meta.width,
        imgH: beats[2].shot.meta.height,
        topFrac: beats[2].topFrac,
      })
    ),
    // Footer
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "auto",
          marginBottom: PAD,
          marginLeft: PAD,
          marginRight: PAD,
          height: 20,
        },
      },
      h(
        "span",
        {
          style: {
            color: MUTED,
            fontSize: 14,
            fontWeight: 400,
            letterSpacing: "-0.01em",
          },
        },
        "vibejar.com"
      ),
      h(
        "span",
        {
          style: {
            color: MUTED,
            fontSize: 14,
            fontWeight: 400,
            letterSpacing: "-0.01em",
          },
        },
        "capture app — $88 once"
      )
    )
  );

  const svg = await satori(tree, { width: W, height: H, fonts });
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: W } });
  const png = resvg.render().asPng();
  const out = join(root, "assets/hero.png");
  await writeFile(out, png);
  console.log("wrote", out, `(${png.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
