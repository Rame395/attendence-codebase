import { useState } from "react";
import { getProfileImageUrl, type IProfileImage } from "../../lib/profileImage";

interface ICompanyAvatarProps {
  name?: string;
  logo?: string | IProfileImage | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  rounded?: string;
}

const sizeMap: Record<string, string> = {
  xs: "w-8 h-8 text-sm",
  sm: "w-10 h-10 text-base",
  md: "w-16 h-16 text-2xl",
  lg: "w-20 h-20 text-3xl",
  xl: "w-24 h-24 text-4xl",
};

// company ko default image (logo nahuda) - employee Avatar jastai pattern:
// logo cha bhane photo, natra company.svg, feri fail bhaye letter
const DEFAULT_COMPANY_LOGO = "/avatars/company.svg";

export default function CompanyAvatar({
  name = "C",
  logo,
  size = "sm",
  className = "",
  rounded = "rounded-xl",
}: ICompanyAvatarProps) {
  const src = getProfileImageUrl(logo);
  const letter = (name?.trim()?.charAt(0) || "C").toUpperCase();
  const [srcFailed, setSrcFailed] = useState(false);
  const [defaultFailed, setDefaultFailed] = useState(false);

  const activeSrc = src && !srcFailed ? src : DEFAULT_COMPANY_LOGO;

  if (!defaultFailed) {
    return (
      <img
        src={activeSrc}
        alt={name}
        onError={() => {
          if (src && !srcFailed) setSrcFailed(true);
          else setDefaultFailed(true);
        }}
        className={`${sizeMap[size]} ${rounded} object-cover shrink-0 bg-slate-100 ring-1 ring-border ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeMap[size]} ${rounded} bg-secondary text-primary flex items-center justify-center font-bold shrink-0 ring-1 ring-border ${className}`}
    >
      {letter}
    </div>
  );
}
