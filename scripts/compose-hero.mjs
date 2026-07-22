#!/usr/bin/env node
/**
 * Compose assets/hero.png with Satori — real Space Grotesk + jar mark +
 * landing screenshots (not a generative mock).
 *
 *   node scripts/compose-hero.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement as h } from "react";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const W = 1200;
const H = 630;

const BG = "#0a0a0b";
const FG = "#f3f3f1";
const MUTED = "#c2c2be";
const FAINT = "#8c8c88";
const CARD = "#161618";
const BORDER = "#26262b";

async function loadFonts() {
  const [regular, bold] = await Promise.all([
    readFile(join(root, "assets/fonts/SpaceGrotesk-400.ttf")),
    readFile(join(root, "assets/fonts/SpaceGrotesk-700.ttf")),
  ]);
  return [
    { name: "Space Grotesk", data: regular, weight: 400, style: "normal" },
    { name: "Space Grotesk", data: bold, weight: 700, style: "normal" },
  ];
}

async function loadPng(name) {
  const buf = await readFile(join(root, "assets/screenshots", name));
  return `data:image/png;base64,${buf.toString("base64")}`;
}

/** Same jar paths as web/src/lib/og-shared.tsx */
function JarIcon({ size = 40, color = FG }) {
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

function Phone({ src, width = 200 }) {
  const height = Math.round(width * (2556 / 1180));
  return h(
    "div",
    {
      style: {
        display: "flex",
        width,
        height,
        borderRadius: 28,
        border: `6px solid ${BORDER}`,
        background: CARD,
        overflow: "hidden",
        boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
      },
    },
    h("img", {
      src,
      width: width - 12,
      height: height - 12,
      style: {
        objectFit: "cover",
        objectPosition: "top center",
      },
    })
  );
}

function Pill({ children, invert = false }) {
  return h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        background: invert ? FG : CARD,
        border: invert ? "none" : `1px solid ${BORDER}`,
        borderRadius: 999,
        color: invert ? BG : FG,
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        padding: "10px 16px",
      },
    },
    children
  );
}

async function main() {
  const fonts = await loadFonts();
  const [annotate, ios, pr] = await Promise.all([
    loadPng("annotate-frame.png"),
    loadPng("ios-poster.png"),
    loadPng("github-pr.png"),
  ]);

  const phoneW = 198;
  const phoneH = Math.round(phoneW * (2556 / 1180));

  const tree = h(
    "div",
    {
      style: {
        width: W,
        height: H,
        display: "flex",
        background: BG,
        fontFamily: "Space Grotesk",
        position: "relative",
        overflow: "hidden",
      },
    },
    h("div", {
      style: {
        position: "absolute",
        right: -80,
        top: -80,
        width: 420,
        height: 420,
        borderRadius: 420,
        background: "#161618",
        opacity: 0.9,
        display: "flex",
      },
    }),
    h("div", {
      style: {
        position: "absolute",
        left: -120,
        bottom: -140,
        width: 360,
        height: 360,
        borderRadius: 360,
        background: "#121214",
        display: "flex",
      },
    }),
    // left copy
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "48px 40px 48px 64px",
          width: 520,
          height: "100%",
          position: "relative",
        },
      },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 14 } },
        h(JarIcon, { size: 44, color: FG }),
        h(
          "span",
          {
            style: {
              color: FG,
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: "-0.04em",
            },
          },
          "vibejar"
        )
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            marginTop: 36,
            fontSize: 42,
            fontWeight: 700,
            letterSpacing: "-0.035em",
            lineHeight: 1.08,
          },
        },
        h(
          "span",
          {
            style: {
              color: MUTED,
              display: "flex",
              whiteSpace: "nowrap",
            },
          },
          "The screenshot tool that"
        ),
        h(
          "span",
          {
            style: {
              color: "#ffffff",
              display: "flex",
              whiteSpace: "nowrap",
            },
          },
          "fixes bugs"
        )
      ),
      h(
        "div",
        {
          style: {
            color: FAINT,
            display: "flex",
            fontSize: 20,
            fontWeight: 400,
            letterSpacing: "-0.01em",
            lineHeight: 1.4,
            marginTop: 22,
            maxWidth: 420,
          },
        },
        "MIT agent CLI + skill. Capture app is $88 once."
      ),
      h(
        "div",
        { style: { display: "flex", gap: 10, marginTop: 28 } },
        h(Pill, null, "Open agent · MIT"),
        h(Pill, { invert: true }, "App $88 once")
      )
    ),
    // right phones
    h(
      "div",
      {
        style: {
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: 56,
          paddingTop: 40,
          height: "100%",
          position: "relative",
        },
      },
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "flex-end",
            height: phoneH + 20,
            position: "relative",
            width: phoneW * 2.35,
          },
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              position: "absolute",
              left: 0,
              bottom: 24,
              opacity: 0.92,
            },
          },
          h(Phone, { src: annotate, width: phoneW - 18 })
        ),
        h(
          "div",
          {
            style: {
              display: "flex",
              position: "absolute",
              right: 0,
              bottom: 24,
              opacity: 0.92,
            },
          },
          h(Phone, { src: pr, width: phoneW - 18 })
        ),
        h(
          "div",
          {
            style: {
              display: "flex",
              position: "absolute",
              left: phoneW * 0.48,
              bottom: 0,
            },
          },
          h(Phone, { src: ios, width: phoneW + 8 })
        )
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
