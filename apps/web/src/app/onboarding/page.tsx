import { CreateHouseholdForm } from "@/components/household/create-household-form";

export default function OnboardingPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Create Household</h1>
          <p className="text-sm text-muted-foreground">
            You need a household to track shared expenses. Let's create one.
          </p>
        </div>
        <CreateHouseholdForm />
      </div>
    </div>
  );
}
