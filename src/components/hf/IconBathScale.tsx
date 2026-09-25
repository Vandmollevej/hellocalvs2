import { IconBathroomScale } from "@/components/icons/BathroomScale";

// The one shared "weight" icon: a bathroom (body) scale, never a kitchen/
// balance scale. Use this everywhere a weight icon appears — do not fall
// back to @tabler/icons-react's IconScale (a balance scale) for weight.
export function IconBathScale({
  size = 20,
  className = "",
}: {
  size?: number | string;
  className?: string;
}) {
  return <IconBathroomScale size={size} className={className} />;
}
