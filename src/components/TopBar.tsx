import { ProfileAvatarLink } from "@/components/ProfileAvatarLink";

// Samme højde, sidemargin og 44 px-slot som .hf-appbar, så profilcirklen
// står præcis samme sted og har samme størrelse som på sider med ScreenHeader.
export function TopBar() {
  return (
    <div data-top-bar className="hf-topbar">
      <ProfileAvatarLink outlined />
    </div>
  );
}
