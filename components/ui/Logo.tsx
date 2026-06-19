import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  href?: string;
}

const dims: Record<string, [number, number]> = {
  sm: [30, 19],
  md: [40, 25],
  lg: [54, 34],
};

export function Logo({ size = "md", href = "/" }: LogoProps) {
  const [iso, word] = dims[size];

  const inner = (
    <span className="mi-logo">
      <span
        className="mi-iso"
        style={{ width: iso, height: iso }}
      >
        <span className="t-m">M</span>
        <span className="t-plus">+</span>
        <span className="t-i">i</span>
        <span className="t-empty" />
      </span>
      <span className="mi-word" style={{ fontSize: word }}>
        <span className="w-med">Med</span>
        <span className="w-plus">+</span>
        <span className="w-inv">Inv</span>
      </span>
    </span>
  );

  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      {inner}
    </Link>
  );
}
