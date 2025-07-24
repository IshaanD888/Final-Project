import { createContext, useContext } from "react";

export const ButtonSoundContext = createContext<() => void>(() => {});

export function useButtonSound() {
  return useContext(ButtonSoundContext);
}