type OrnamentVariant = "header" | "panel";

type Props = {
  variant: OrnamentVariant;
  className?: string;
};

const assetUrl = (path: string): string =>
  `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;

export const OrnamentLine = ({ variant, className = "" }: Props) => {
  return (
    <div
      className={`ornament-line ornament-line-${variant} ${className}`.trim()}
      aria-hidden="true"
    >
      <img
        src={assetUrl("decorations/line.png")}
        alt=""
        aria-hidden="true"
        className="ornament-line-image"
        draggable={false}
      />
    </div>
  );
};
