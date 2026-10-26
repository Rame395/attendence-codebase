import { useState } from "react";
import { getProfileImageUrl, type IProfileImage } from "../../lib/profileImage";

interface IAvatarProps {
  name?: string;
  imageUrl?: string | IProfileImage | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  rounded?: string;
  gender?: "male" | "female" | "other" | string | null;
}

const sizeMap: Record<string, string> = {
  sm: "w-9 h-9 text-sm",
  md: "w-10 h-10 text-sm",
  lg: "w-16 h-16 text-2xl",
  xl: "w-20 h-20 text-3xl",
};

// gender anusar dummy avatar (image nahuda) - male/female/other
const DEFAULT_AVATARS: Record<string, string> = {
  male: "/avatars/male.svg",
  female: "/avatars/female.svg",
  other: "/avatars/other.svg",
};

// image cha bhane photo, natra gender dummy, feri fail bhaye letter - sabai thauma reuse garne
export default function Avatar({ name = "U", imageUrl, size = "md", className = "", rounded = "rounded-xl", gender }: IAvatarProps) {
  const src = getProfileImageUrl(imageUrl);
  const letter = (name?.trim()?.charAt(0) || "U").toUpperCase();
  const defaultSrc = DEFAULT_AVATARS[gender || ""] || DEFAULT_AVATARS.other;
  const [srcFailed, setSrcFailed] = useState(false);
  const [defaultFailed, setDefaultFailed] = useState(false);

  const activeSrc = src && !srcFailed ? src : defaultSrc;

  if (!defaultFailed) {
    return (
      <img
        src={activeSrc}
        alt={name}
        onError={() => {
          if (src && !srcFailed) setSrcFailed(true);
          else setDefaultFailed(true);
        }}
        className={`${sizeMap[size]} ${rounded} object-cover shrink-0 bg-slate-100 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeMap[size]} ${rounded} bg-primary text-white flex items-center justify-center font-bold shrink-0 ${className}`}
    >
      {letter}
    </div>
  );
}