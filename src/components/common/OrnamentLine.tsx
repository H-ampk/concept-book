type OrnamentVariant = "header" | "panel";

type Props = {
  variant: OrnamentVariant;
  className?: string;
};

export const OrnamentLine = ({ variant, className = "" }: Props) => {
  return (
    <div
      className={`ornament-line ornament-line-${variant} ${className}`.trim()}
      aria-hidden="true"
    >
      <span className="ornament-segment ornament-segment-left" />
      <span className="ornament-knot ornament-knot-left">✦</span>
      <span className="ornament-segment ornament-segment-mid" />
      <span className="ornament-glyph ornament-glyph-center">✶</span>
      <span className="ornament-segment ornament-segment-mid" />
      <span className="ornament-knot ornament-knot-right">✦</span>
      <span className="ornament-segment ornament-segment-right" />
    </div>
  );
};
