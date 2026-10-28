import { Suspense } from "react";
import { SolutionsScreen } from "@/components/SolutionsScreen";

export default function SolutionsPage() {
  return (
    <Suspense>
      <SolutionsScreen />
    </Suspense>
  );
}
