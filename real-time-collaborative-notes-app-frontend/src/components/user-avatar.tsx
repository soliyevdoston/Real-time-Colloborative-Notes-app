import { AuthUser } from "@/lib/types";

type UserAvatarProps = {
  user: Pick<AuthUser, "name" | "avatarUrl">;
  size?: "sm" | "md" | "lg";
};

const SIZE_CLASS: Record<NonNullable<UserAvatarProps["size"]>, string> = {
  sm: "avatar avatar-sm",
  md: "avatar avatar-md",
  lg: "avatar avatar-lg",
};

const initialsFromName = (name: string): string => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "U";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
};

export const UserAvatar = ({ user, size = "md" }: UserAvatarProps) => {
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={user.name} className={SIZE_CLASS[size]} src={user.avatarUrl} />
    );
  }

  return <span className={SIZE_CLASS[size]}>{initialsFromName(user.name)}</span>;
};
