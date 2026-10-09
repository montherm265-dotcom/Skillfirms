import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Seo from "@/components/seo/Seo";

export default function PageNotFound() {
  return (
    <div className="section-pad flex flex-col items-center gap-4 py-24 text-center">
      <Seo title="Page not found" noindex canonical="/404" />
      <h1 className="font-display text-2xl font-bold">Page not found</h1>
      <Link to="/"><Button variant="outline">Back home</Button></Link>
    </div>
  );
}
