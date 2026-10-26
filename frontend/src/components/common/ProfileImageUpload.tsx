import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { getProfileImageUrl, type IProfileImage } from "../../lib/profileImage";

interface IProfileImageUploadProps {
  name?: string;
  currentImage?: string | IProfileImage | null;
  file?: File | null;
  onChange?: (file: File | null) => void;
  onRemove?: () => void;
  uploading?: boolean;
  size?: "md" | "lg" | "xl";
  showRemove?: boolean;
  gender?: "male" | "female" | "other" | string | null;
  variant?: "employee" | "company";
}

const sizeMap: Record<string, string> = {
  md: "w-16 h-16 text-2xl",
  lg: "w-20 h-20 text-3xl",
  xl: "w-24 h-24 text-4xl",
};

// gender anusar dummy avatar (image nahuda) - male/female/other
const DEFAULT_AVATARS: Record<string, string> = {
  male: "/avatars/male.svg",
  female: "/avatars/female.svg",
  other: "/avatars/other.svg",
};

// company ko default image (logo nahuda) - employee Avatar jastai pattern
const DEFAULT_COMPANY_LOGO = "/avatars/company.svg";

// image select + instant preview - user/admin le photo upload garda
export default function ProfileImageUpload({
  name = "U",
  currentImage,
  file,
  onChange,
  onRemove,
  uploading = false,
  size = "xl",
  showRemove = true,
  gender,
  variant = "employee",
}: IProfileImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [srcFailed, setSrcFailed] = useState(false);
  const [defaultFailed, setDefaultFailed] = useState(false);

  // selected file cha bhane blob preview (memo + revoke - natra leak huncha), natra server image, natra letter
  const filePreview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);
  const serverUrl = getProfileImageUrl(currentImage);
  const preview = filePreview || serverUrl;
  const letter = (name?.trim()?.charAt(0) || (variant === "company" ? "C" : "U")).toUpperCase();
  // company variant ma default company image, employee ma gender dummy
  const defaultSrc = variant === "company" ? DEFAULT_COMPANY_LOGO : DEFAULT_AVATARS[gender || ""] || DEFAULT_AVATARS.other;
  // company letter fallback style (table sanga match), employee ko primary style
  const letterClass =
    variant === "company" ? "bg-secondary text-primary" : "bg-primary text-white";

  const handleFile = (f: File | undefined | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }
    if (f.size > 3 * 1024 * 1024) {
      toast.error("Image must be under 3MB");
      return;
    }
    onChange?.(f);
  };

  return (
    <div className="flex items-center gap-4">
      <div
        className={`relative ${sizeMap[size]} shrink-0`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
      >
        {preview && !srcFailed ? (
          <img
            src={preview}
            alt={name}
            onError={() => setSrcFailed(true)}
            className={`${sizeMap[size]} rounded-2xl object-cover bg-slate-100 ring-2 ${dragOver ? "ring-primary" : "ring-white/40"} shadow`}
          />
        ) : !defaultFailed ? (
          <img
            src={defaultSrc}
            alt={name}
            onError={() => setDefaultFailed(true)}
            className={`${sizeMap[size]} rounded-2xl object-cover bg-slate-100 ring-2 ${dragOver ? "ring-primary" : "ring-white/40"} shadow`}
          />
        ) : (
          <div
            className={`${sizeMap[size]} rounded-2xl ${letterClass} flex items-center justify-center font-bold ring-2 ${dragOver ? "ring-primary" : "ring-white/40"} shadow`}
          >
            {letter}
          </div>
        )}

        {/* uploading overlay */}
        {uploading && (
          <div className={`${sizeMap[size]} absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center`}>
            <Loader2 size={22} className="text-white animate-spin" />
          </div>
        )}

        {/* camera button */}
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          title="Upload photo"
          className="absolute -bottom-1.5 -right-1.5 size-8 rounded-full bg-white border border-border shadow flex items-center justify-center text-slate-700 hover:text-primary hover:border-primary transition-colors disabled:opacity-50"
        >
          <Camera size={15} />
        </button>

        {/* remove button - preview cha bhane matra */}
        {showRemove && preview && onRemove && !uploading && (
          <button
            type="button"
            onClick={onRemove}
            title="Remove photo"
            className="absolute -top-1.5 -right-1.5 size-6 rounded-full bg-red-500 text-white shadow flex items-center justify-center hover:bg-red-600 transition-colors"
          >
            <X size={13} />
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            // same file feri select garna milos
            e.target.value = "";
          }}
        />
      </div>

      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700">Profile photo</p>
      </div>
    </div>
  );
}
