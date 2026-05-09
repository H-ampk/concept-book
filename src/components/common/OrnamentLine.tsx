type OrnamentVariant = "header" | "panel";

type Props = {
  variant: OrnamentVariant;
  className?: string;
};

const assetUrl = (path: string): string =>
  `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;

/** 蛇・棘・蔦・封印円環モチーフの横長ライン（serpent-line.svg） */
const ORNAMENT_SRC = "decorations/serpent-line.svg";

export const OrnamentLine = ({ variant, className = "" }: Props) => {
  return (
    <div
      className={`ornament-line ornament-line-${variant} ${className}`.trim()}
      aria-hidden="true"
    >
      <img
        src={assetUrl(ORNAMENT_SRC)}
        alt=""
        aria-hidden="true"
        className="ornament-line-image"
        draggable={false}
      />
    </div>
  );
};
