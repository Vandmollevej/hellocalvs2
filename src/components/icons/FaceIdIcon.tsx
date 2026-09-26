// Face ID-ikonet (brugerens reference: fire hjørner + ansigt). Med `animate`
// laver det med mellemrum den "scanne"-bevægelse, Face ID selv laver
// (klasser i globals.css; slås fra ved prefers-reduced-motion).
export function FaceIdIcon({ size = 28, animate = false }: { size?: number; animate?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 1200 1200"
      fill="none"
      stroke="currentColor"
      strokeWidth={50}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={animate ? "hf-faceid hf-faceid--animate" : "hf-faceid"}
    >
      <g className="hf-faceid-frame">
        <path d="M375 175H280a105 105 0 0 0-105 105v95" />
        <path d="M825 175h95a105 105 0 0 1 105 105v95" />
        <path d="M175 800v120a105 105 0 0 0 105 105h95" />
        <path d="M1025 800v120a105 105 0 0 1-105 105h-95" />
      </g>
      <g className="hf-faceid-face">
        <path d="M400 450v75" />
        <path d="M800 450v75" />
        <path d="M625 450v175a50 50 0 0 1-50 50h-25" />
        <path d="M442 775c95 67 221 67 316 0" />
      </g>
    </svg>
  );
}
