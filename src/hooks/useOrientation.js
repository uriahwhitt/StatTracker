import { useState, useEffect } from "react";

function getOrientation() {
  if (screen.orientation) {
    return screen.orientation.type.startsWith("landscape") ? "landscape" : "portrait";
  }
  // Fallback for older browsers
  return window.innerWidth > window.innerHeight ? "landscape" : "portrait";
}

export function useOrientation() {
  const [orientation, setOrientation] = useState(getOrientation);

  useEffect(() => {
    function handleChange() {
      setOrientation(getOrientation());
    }

    if (screen.orientation) {
      screen.orientation.addEventListener("change", handleChange);
      return () => screen.orientation.removeEventListener("change", handleChange);
    } else {
      window.addEventListener("orientationchange", handleChange);
      window.addEventListener("resize", handleChange);
      return () => {
        window.removeEventListener("orientationchange", handleChange);
        window.removeEventListener("resize", handleChange);
      };
    }
  }, []);

  return orientation; // "portrait" | "landscape"
}
