import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  children: ReactNode;
};

/** `document.body` 直下へ portal し、header / main の stacking context から外す */
export const ModalPortal = ({ children }: Props) => {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
};
