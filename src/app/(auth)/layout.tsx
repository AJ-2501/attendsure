import { AuthStage, AuthVisual, RoleSwitch } from "@/components/AuthChrome";

/** Shared sign-in frame: the brand panel and role switch stay mounted, so switching Student ↔ Admin animates. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-ink">
      <AuthVisual />
      <main className="auth-surface animate-sheet-up relative -mt-8 lg:mt-0 flex-1 lg:w-1/2 lg:flex-1 rounded-t-[28px] lg:rounded-none shadow-[0_-12px_40px_rgb(0_0_0/0.25)] lg:shadow-none px-6 sm:px-10 lg:px-12 xl:px-16 pt-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:py-12 flex flex-col justify-center items-center lg:overflow-y-auto">
        <div className="auth-card w-full max-w-md flex flex-col gap-6">
          <RoleSwitch />
          <AuthStage>{children}</AuthStage>
        </div>
      </main>
    </div>
  );
}
