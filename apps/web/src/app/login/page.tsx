import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";

const devMode = process.env.DEV_AUTH === "true";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#1F1A17" }}>
      <div className="w-full max-w-sm space-y-6 rounded border p-8" style={{ background: "#282320", borderColor: "#3a3530" }}>
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "#f5f2ef" }}>PersonaLab</h1>
          <p className="text-[13px]" style={{ color: "rgba(245,242,239,0.5)" }}>Sign in to continue</p>
        </div>

        <div className="space-y-2">
          {devMode ? (
            <form
              action={async () => {
                "use server";
                await signIn("dev-admin", { redirectTo: "/" });
              }}
            >
              <Button type="submit" className="w-full">
                Continue as Dev Admin
              </Button>
            </form>
          ) : (
            <>
              <form
                action={async () => {
                  "use server";
                  await signIn("google", { redirectTo: "/" });
                }}
              >
                <Button type="submit" variant="outline" className="w-full gap-2">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                    />
                  </svg>
                  Continue with Google
                </Button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await signIn("github", { redirectTo: "/" });
                }}
              >
                <Button type="submit" variant="outline" className="w-full gap-2">
                  <Github className="h-4 w-4" />
                  Continue with GitHub
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
