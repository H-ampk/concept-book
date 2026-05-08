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
      <span className="ornament-glyph ornament-glyph-owl">🦉</span>
      <span className="ornament-segment ornament-segment-mid" />
      <span className="ornament-glyph ornament-glyph-seal">✶</span>
      <span className="ornament-segment ornament-segment-mid" />
      <span className="ornament-glyph ornament-glyph-quill">✒</span>
      <span className="ornament-segment ornament-segment-right" />
    </div>
  );
};
