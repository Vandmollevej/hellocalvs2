import type { CameraDetection } from "@/lib/camera-detection-types";

// Draws the automatic "Produkt" camera detections on top of the frozen
// photo: a ring around a round plate, and the contour around any other
// object. The viewBox is the square frame the coordinates refer to, and
// `slice` mirrors the photo's `object-cover`, so the outlines stay on the
// objects when the viewfinder shrinks to make room for the result list.

const VIEWBOX = 1000;

export function CameraDetectionOverlay({ detections }: { detections: CameraDetection[] }) {
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      {detections.map((detection) => {
        const { shape } = detection;
        const common = {
          fill: "rgba(255,255,255,0.08)",
          stroke: "white",
          strokeWidth: 3,
          strokeLinejoin: "round" as const,
          vectorEffect: "non-scaling-stroke" as const,
          className: "hf-outline-in",
        };
        const labelX = shape.type === "ellipse" ? shape.cx * VIEWBOX : shape.points[0][0] * VIEWBOX;
        const labelY =
          shape.type === "ellipse"
            ? (shape.cy - shape.ry) * VIEWBOX
            : Math.min(...shape.points.map((point) => point[1])) * VIEWBOX;

        return (
          <g key={detection.id}>
            {shape.type === "ellipse" ? (
              <ellipse
                cx={shape.cx * VIEWBOX}
                cy={shape.cy * VIEWBOX}
                rx={shape.rx * VIEWBOX}
                ry={shape.ry * VIEWBOX}
                {...common}
              />
            ) : (
              <polygon
                points={shape.points.map(([x, y]) => `${x * VIEWBOX},${y * VIEWBOX}`).join(" ")}
                {...common}
              />
            )}
            <text
              x={labelX}
              y={Math.max(40, labelY - 14)}
              textAnchor={shape.type === "ellipse" ? "middle" : "start"}
              fill="white"
              stroke="rgba(0,0,0,0.55)"
              strokeWidth={6}
              paintOrder="stroke"
              fontSize={34}
              fontWeight={700}
            >
              {detection.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
